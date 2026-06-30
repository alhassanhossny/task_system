import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EntityType, Prisma, TaskStatus } from "@prisma/client";
import { AttachmentsService } from "../attachments/attachments.service";
import { CommentsService } from "../comments/comments.service";
import { DomainEventBus } from "../domain-events/domain-event-bus.service";
import { PrismaService } from "../prisma/prisma.service";
import { AssignTaskDto } from "./dto/assign-task.dto";
import { CreateTaskAttachmentDto } from "./dto/create-task-attachment.dto";
import { CreateTaskCommentDto } from "./dto/create-task-comment.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { TaskQueryDto } from "./dto/task-query.dto";
import { UpdateTaskStatusDto } from "./dto/update-task-status.dto";
import { UpdateTaskWatchersDto } from "./dto/update-task-watchers.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
    private readonly commentsService: CommentsService,
    private readonly attachmentsService: AttachmentsService
  ) {}

  findAll(companyId: string, query: TaskQueryDto) {
    return this.prisma.task.findMany({
      where: this.buildWhere(companyId, query),
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      include: this.taskInclude()
    });
  }

  async findOne(companyId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.taskDetailInclude()
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const activities = await this.prisma.activity.findMany({
      where: {
        companyId,
        deletedAt: null,
        metadata: {
          path: ["taskId"],
          equals: id
        }
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return { ...task, activities };
  }

  async create(companyId: string, actorId: string, dto: CreateTaskDto) {
    await this.validateDepartment(companyId, dto.departmentId);
    await this.validateUsers(companyId, [...(dto.assigneeIds ?? []), ...(dto.watcherIds ?? [])]);

    const assigneeIds = this.uniqueIds(dto.assigneeIds ?? []);
    const watcherIds = this.uniqueIds([...(dto.watcherIds ?? []), actorId, ...assigneeIds]);

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await this.createTaskWithNumber(tx, companyId, {
        companyId,
        createdById: actorId,
        departmentId: dto.departmentId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        estimatedHours: dto.estimatedHours,
        status: assigneeIds.length ? TaskStatus.ASSIGNED : TaskStatus.NEW
      });

      await this.syncTaskAssignees(tx, companyId, created.id, assigneeIds);
      await this.syncTaskWatchers(tx, companyId, created.id, watcherIds);

      return tx.task.findUniqueOrThrow({
        where: { id: created.id },
        include: this.taskDetailInclude()
      });
    });

    this.publishTaskEvent("TASK_CREATED", companyId, actorId, task.id, {
      taskId: task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      description: task.description,
      assigneeIds
    });

    if (assigneeIds.length) {
      this.publishTaskEvent("TASK_ASSIGNED", companyId, actorId, task.id, {
        taskId: task.id,
        taskNumber: task.taskNumber,
        title: task.title,
        assigneeIds
      });
    }

    return task;
  }

  async update(companyId: string, actorId: string, id: string, dto: UpdateTaskDto) {
    await this.ensureTask(companyId, id);
    await this.validateDepartment(companyId, dto.departmentId === null ? undefined : dto.departmentId);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        departmentId: dto.departmentId,
        dueAt: dto.dueAt === undefined ? undefined : dto.dueAt ? new Date(dto.dueAt) : null,
        estimatedHours: dto.estimatedHours,
        actualHours: dto.actualHours
      },
      include: this.taskDetailInclude()
    });

    this.publishTaskEvent("TASK_UPDATED", companyId, actorId, task.id, {
      taskId: task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      description: task.description
    });

    return task;
  }

  async assign(companyId: string, actorId: string, id: string, dto: AssignTaskDto) {
    const existing = await this.ensureTask(companyId, id);
    const assigneeIds = this.uniqueIds(dto.assigneeIds);
    await this.validateUsers(companyId, assigneeIds);

    const task = await this.prisma.$transaction(async (tx) => {
      await this.syncTaskAssignees(tx, companyId, id, assigneeIds);
      await this.addTaskWatchers(tx, companyId, id, assigneeIds);

      if (assigneeIds.length && existing.status === TaskStatus.NEW) {
        await tx.task.update({
          where: { id },
          data: { status: TaskStatus.ASSIGNED }
        });
      }

      return tx.task.findUniqueOrThrow({
        where: { id },
        include: this.taskDetailInclude()
      });
    });

    this.publishTaskEvent("TASK_ASSIGNED", companyId, actorId, task.id, {
      taskId: task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      assigneeIds
    });

    return task;
  }

  async updateWatchers(companyId: string, actorId: string, id: string, dto: UpdateTaskWatchersDto) {
    await this.ensureTask(companyId, id);
    const watcherIds = this.uniqueIds(dto.watcherIds);
    await this.validateUsers(companyId, watcherIds);

    const task = await this.prisma.$transaction(async (tx) => {
      await this.syncTaskWatchers(tx, companyId, id, watcherIds);

      return tx.task.findUniqueOrThrow({
        where: { id },
        include: this.taskDetailInclude()
      });
    });

    this.publishTaskEvent("TASK_UPDATED", companyId, actorId, task.id, {
      taskId: task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      watcherIds
    });

    return task;
  }

  async updateStatus(companyId: string, actorId: string, id: string, dto: UpdateTaskStatusDto) {
    await this.ensureTask(companyId, id);
    const completed = dto.status === TaskStatus.COMPLETED;

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status: dto.status,
        actualHours: dto.actualHours,
        completedAt: completed ? new Date() : null
      },
      include: this.taskDetailInclude()
    });

    this.publishTaskEvent(completed ? "TASK_COMPLETED" : "TASK_UPDATED", companyId, actorId, task.id, {
      taskId: task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      description: task.description,
      status: task.status
    });

    return task;
  }

  async softDelete(companyId: string, actorId: string, id: string) {
    const task = await this.ensureTask(companyId, id);
    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    this.publishTaskEvent("TASK_DELETED", companyId, actorId, id, {
      taskId: id,
      taskNumber: task.taskNumber,
      title: task.title
    });

    return { success: true };
  }

  async findComments(companyId: string, id: string) {
    await this.ensureTask(companyId, id);
    return this.commentsService.findByEntity(companyId, EntityType.TASK, id);
  }

  async addComment(companyId: string, actorId: string, id: string, dto: CreateTaskCommentDto) {
    const task = await this.ensureTask(companyId, id);
    const comment = await this.commentsService.create(companyId, actorId, {
      entityType: EntityType.TASK,
      entityId: id,
      content: dto.content
    });

    this.publishTaskEvent("TASK_COMMENTED", companyId, actorId, id, {
      taskId: id,
      taskNumber: task.taskNumber,
      title: task.title,
      commentId: comment.id
    });

    return comment;
  }

  async findAttachments(companyId: string, id: string) {
    await this.ensureTask(companyId, id);
    return this.attachmentsService.findByEntity(companyId, EntityType.TASK, id);
  }

  async addAttachment(companyId: string, actorId: string, id: string, dto: CreateTaskAttachmentDto) {
    const task = await this.ensureTask(companyId, id);
    const attachment = await this.attachmentsService.create(companyId, actorId, {
      entityType: EntityType.TASK,
      entityId: id,
      fileName: dto.fileName,
      filePath: dto.filePath,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      uploadedById: dto.uploadedById
    });

    this.publishTaskEvent("TASK_ATTACHMENT_ADDED", companyId, actorId, id, {
      taskId: id,
      taskNumber: task.taskNumber,
      title: task.title,
      attachmentId: attachment.id
    });

    return attachment;
  }

  private async ensureTask(companyId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, companyId, deletedAt: null }
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    return task;
  }

  private buildWhere(companyId: string, query: TaskQueryDto): Prisma.TaskWhereInput {
    return {
      companyId,
      deletedAt: null,
      status: query.status,
      priority: query.priority,
      departmentId: query.departmentId,
      dueAt:
        query.dueFrom || query.dueTo
          ? {
              gte: query.dueFrom ? new Date(query.dueFrom) : undefined,
              lte: query.dueTo ? new Date(query.dueTo) : undefined
            }
          : undefined,
      assignees: query.assignedToId
        ? {
            some: {
              userId: query.assignedToId,
              deletedAt: null
            }
          }
        : undefined,
      OR: query.search
        ? [
            { taskNumber: { contains: query.search, mode: "insensitive" } },
            { title: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } }
          ]
        : undefined
    };
  }

  private async createTaskWithNumber(tx: Prisma.TransactionClient, companyId: string, data: Omit<Prisma.TaskUncheckedCreateInput, "taskNumber">) {
    const count = await tx.task.count({ where: { companyId } });

    for (let offset = 1; offset <= 20; offset += 1) {
      const taskNumber = `TASK-${String(count + offset).padStart(5, "0")}`;

      try {
        return await tx.task.create({
          data: {
            ...data,
            taskNumber
          }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          continue;
        }

        throw error;
      }
    }

    throw new BadRequestException("Could not allocate task number");
  }

  private async validateDepartment(companyId: string, departmentId?: string | null) {
    if (!departmentId) {
      return;
    }

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, deletedAt: null },
      select: { id: true }
    });

    if (!department) {
      throw new BadRequestException("Department does not belong to tenant");
    }
  }

  private async validateUsers(companyId: string, userIds: string[]) {
    const uniqueIds = this.uniqueIds(userIds);

    if (!uniqueIds.length) {
      return;
    }

    const users = await this.prisma.user.findMany({
      where: { companyId, id: { in: uniqueIds }, deletedAt: null },
      select: { id: true }
    });

    if (users.length !== uniqueIds.length) {
      throw new BadRequestException("One or more users do not belong to tenant");
    }
  }

  private async syncTaskAssignees(tx: Prisma.TransactionClient, companyId: string, taskId: string, userIds: string[]) {
    const uniqueIds = this.uniqueIds(userIds);

    await tx.taskAssignee.updateMany({
      where: {
        companyId,
        taskId,
        deletedAt: null,
        userId: { notIn: uniqueIds }
      },
      data: { deletedAt: new Date() }
    });

    for (const userId of uniqueIds) {
      await tx.taskAssignee.upsert({
        where: {
          companyId_taskId_userId: {
            companyId,
            taskId,
            userId
          }
        },
        update: { deletedAt: null },
        create: { companyId, taskId, userId }
      });
    }
  }

  private async syncTaskWatchers(tx: Prisma.TransactionClient, companyId: string, taskId: string, userIds: string[]) {
    const uniqueIds = this.uniqueIds(userIds);

    await tx.taskWatcher.updateMany({
      where: {
        companyId,
        taskId,
        deletedAt: null,
        userId: { notIn: uniqueIds }
      },
      data: { deletedAt: new Date() }
    });

    for (const userId of uniqueIds) {
      await tx.taskWatcher.upsert({
        where: {
          companyId_taskId_userId: {
            companyId,
            taskId,
            userId
          }
        },
        update: { deletedAt: null },
        create: { companyId, taskId, userId }
      });
    }
  }

  private async addTaskWatchers(tx: Prisma.TransactionClient, companyId: string, taskId: string, userIds: string[]) {
    for (const userId of this.uniqueIds(userIds)) {
      await tx.taskWatcher.upsert({
        where: {
          companyId_taskId_userId: {
            companyId,
            taskId,
            userId
          }
        },
        update: { deletedAt: null },
        create: { companyId, taskId, userId }
      });
    }
  }

  private uniqueIds(ids: string[]) {
    return [...new Set(ids.filter(Boolean))];
  }

  private publishTaskEvent(name: string, companyId: string, actorId: string, taskId: string, payload: Record<string, unknown>) {
    this.eventBus.publish({
      name,
      companyId,
      actorId,
      entityType: EntityType.TASK,
      entityId: taskId,
      payload
    });
  }

  private taskInclude() {
    return {
      department: {
        select: {
          id: true,
          name: true,
          code: true
        }
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      assignees: {
        where: { deletedAt: null },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              jobTitle: true
            }
          }
        }
      },
      _count: {
        select: {
          assignees: true,
          watchers: true
        }
      }
    } as const;
  }

  private taskDetailInclude() {
    return {
      ...this.taskInclude(),
      watchers: {
        where: { deletedAt: null },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              jobTitle: true
            }
          }
        }
      }
    } as const;
  }
}
