import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalActionStatus, EntityType, LeaveApprovalMode, SystemRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ApprovalWorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultLeaveWorkflow(companyId: string) {
    const setting = await this.ensureLeaveSetting(companyId);
    const existing = await this.prisma.approvalWorkflow.findFirst({
      where: { companyId, entityType: EntityType.LEAVE_REQUEST, deletedAt: null }
    });

    const [managerRole, companyAdminRole] = await Promise.all([
      this.prisma.role.findUnique({
        where: { companyId_systemName: { companyId, systemName: SystemRole.MANAGER } },
        select: { id: true }
      }),
      this.prisma.role.findUnique({
        where: { companyId_systemName: { companyId, systemName: SystemRole.COMPANY_ADMIN } },
        select: { id: true }
      })
    ]);

    if (!managerRole || !companyAdminRole) {
      throw new BadRequestException("Default leave approval roles are not configured for this tenant");
    }

    const workflow = existing
      ? await this.prisma.approvalWorkflow.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            deletedAt: null,
            name: "Default Leave Request Approval",
            description:
              setting.approvalMode === LeaveApprovalMode.MANAGER_HR
                ? "Employee to manager to HR approval path"
                : "Employee to manager approval path"
          }
        })
      : await this.prisma.approvalWorkflow.create({
          data: {
            companyId,
            entityType: EntityType.LEAVE_REQUEST,
            name: "Default Leave Request Approval",
            description:
              setting.approvalMode === LeaveApprovalMode.MANAGER_HR
                ? "Employee to manager to HR approval path"
                : "Employee to manager approval path"
          }
        });

    await this.reconcileLeaveWorkflowSteps(companyId, workflow.id, setting.approvalMode, managerRole.id, companyAdminRole.id);

    return this.prisma.approvalWorkflow.findUniqueOrThrow({
      where: { id: workflow.id },
      include: { steps: { where: { deletedAt: null }, orderBy: { stepOrder: "asc" } } }
    });
  }

  async startWorkflow(companyId: string, entityType: EntityType, entityId: string) {
    const workflow =
      entityType === EntityType.LEAVE_REQUEST
        ? await this.ensureDefaultLeaveWorkflow(companyId)
        : await this.prisma.approvalWorkflow.findFirstOrThrow({
            where: { companyId, entityType, isActive: true, deletedAt: null },
            include: { steps: { where: { deletedAt: null }, orderBy: { stepOrder: "asc" } } }
          });

    const existing = await this.prisma.approvalAction.count({
      where: { companyId, workflowId: workflow.id, entityType, entityId, deletedAt: null }
    });

    if (!existing) {
      await this.prisma.approvalAction.createMany({
        data: workflow.steps.map((step) => ({
          companyId,
          workflowId: workflow.id,
          stepId: step.id,
          entityType,
          entityId,
          status: ApprovalActionStatus.PENDING
        }))
      });
    }

    return this.getActions(companyId, entityType, entityId);
  }

  async getActions(companyId: string, entityType: EntityType, entityId: string) {
    const actions = await this.prisma.approvalAction.findMany({
      where: { companyId, entityType, entityId, deletedAt: null },
      include: {
        step: {
          include: {
            approverRole: { select: { id: true, name: true, systemName: true } },
            approverUser: { select: { id: true, name: true, email: true } }
          }
        },
        actor: { select: { id: true, name: true, email: true } }
      }
    });

    return actions.sort((a, b) => (a.step?.stepOrder ?? 0) - (b.step?.stepOrder ?? 0));
  }

  async approveNext(companyId: string, entityType: EntityType, entityId: string, actorId: string, comment?: string) {
    const action = await this.nextPendingAction(companyId, entityType, entityId);
    await this.ensureCanAct(companyId, actorId, action.step);

    const updated = await this.prisma.approvalAction.update({
      where: { id: action.id },
      data: {
        actorId,
        status: ApprovalActionStatus.APPROVED,
        comment
      }
    });

    const remaining = await this.prisma.approvalAction.count({
      where: { companyId, entityType, entityId, status: ApprovalActionStatus.PENDING, deletedAt: null }
    });

    return { action: updated, complete: remaining === 0 };
  }

  async rejectNext(companyId: string, entityType: EntityType, entityId: string, actorId: string, comment?: string) {
    const action = await this.nextPendingAction(companyId, entityType, entityId);
    await this.ensureCanAct(companyId, actorId, action.step);

    const updated = await this.prisma.approvalAction.update({
      where: { id: action.id },
      data: {
        actorId,
        status: ApprovalActionStatus.REJECTED,
        comment
      }
    });

    await this.prisma.approvalAction.updateMany({
      where: { companyId, entityType, entityId, status: ApprovalActionStatus.PENDING, deletedAt: null },
      data: { status: ApprovalActionStatus.CANCELLED }
    });

    return { action: updated, complete: true };
  }

  async ensureCanActOnNext(companyId: string, entityType: EntityType, entityId: string, actorId: string) {
    const action = await this.nextPendingAction(companyId, entityType, entityId);
    await this.ensureCanAct(companyId, actorId, action.step);

    return action;
  }

  async nextApproverUserIds(companyId: string, entityType: EntityType, entityId: string) {
    const action = await this.nextPendingAction(companyId, entityType, entityId).catch(() => null);

    if (!action?.step) {
      return [];
    }

    if (action.step.approverUserId) {
      return [action.step.approverUserId];
    }

    if (!action.step.approverRoleId) {
      return [];
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { companyId, roleId: action.step.approverRoleId, deletedAt: null, user: { deletedAt: null } },
      select: { userId: true }
    });

    return [...new Set(userRoles.map((userRole) => userRole.userId))];
  }

  async configureLeaveWorkflow(companyId: string, approvalMode: LeaveApprovalMode) {
    const setting = await this.prisma.leaveSetting.upsert({
      where: { companyId },
      update: { approvalMode, deletedAt: null },
      create: { companyId, approvalMode }
    });
    const workflow = await this.ensureDefaultLeaveWorkflow(companyId);

    return { setting, workflow };
  }

  private ensureLeaveSetting(companyId: string) {
    return this.prisma.leaveSetting.upsert({
      where: { companyId },
      update: { deletedAt: null },
      create: { companyId, approvalMode: LeaveApprovalMode.MANAGER_HR }
    });
  }

  private async reconcileLeaveWorkflowSteps(
    companyId: string,
    workflowId: string,
    approvalMode: LeaveApprovalMode,
    managerRoleId: string,
    hrRoleId: string
  ) {
    await this.prisma.approvalStep.upsert({
      where: { companyId_workflowId_stepOrder: { companyId, workflowId, stepOrder: 1 } },
      update: { name: "Manager Approval", approverRoleId: managerRoleId, approverUserId: null, deletedAt: null },
      create: { companyId, workflowId, stepOrder: 1, name: "Manager Approval", approverRoleId: managerRoleId }
    });

    if (approvalMode === LeaveApprovalMode.MANAGER_HR) {
      await this.prisma.approvalStep.upsert({
        where: { companyId_workflowId_stepOrder: { companyId, workflowId, stepOrder: 2 } },
        update: { name: "HR Approval", approverRoleId: hrRoleId, approverUserId: null, deletedAt: null },
        create: { companyId, workflowId, stepOrder: 2, name: "HR Approval", approverRoleId: hrRoleId }
      });
      return;
    }

    await this.prisma.approvalStep.updateMany({
      where: { companyId, workflowId, stepOrder: { gt: 1 }, deletedAt: null },
      data: { deletedAt: new Date() }
    });
  }

  private async nextPendingAction(companyId: string, entityType: EntityType, entityId: string) {
    const actions = await this.getActions(companyId, entityType, entityId);
    const action = actions.find((item) => item.status === ApprovalActionStatus.PENDING);

    if (!action) {
      throw new NotFoundException("No pending approval action found");
    }

    return action;
  }

  private async ensureCanAct(
    companyId: string,
    actorId: string,
    step: Awaited<ReturnType<ApprovalWorkflowsService["getActions"]>>[number]["step"]
  ) {
    if (!step) {
      throw new BadRequestException("Approval step is not configured");
    }

    if (step.approverUserId && step.approverUserId === actorId) {
      return;
    }

    if (step.approverRoleId) {
      const userRole = await this.prisma.userRole.findFirst({
        where: { companyId, userId: actorId, roleId: step.approverRoleId, deletedAt: null },
        select: { id: true }
      });

      if (userRole) {
        return;
      }
    }

    throw new ForbiddenException("User cannot act on this approval step");
  }
}
