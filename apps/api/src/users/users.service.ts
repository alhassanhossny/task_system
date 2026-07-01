import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EntityType, Locale, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DomainEventBus } from "../domain-events/domain-event-bus.service";
import { PrismaService } from "../prisma/prisma.service";
import { SearchIndexer } from "../search/search-indexer.service";
import { CreateUserDto } from "./dto/create-user.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
    private readonly searchIndexer: SearchIndexer
  ) {}

  findAll(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: this.publicSelect()
    });
  }

  async findOne(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { companyId, id, deletedAt: null },
      select: this.publicSelect()
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async create(companyId: string, actorId: string | null, dto: CreateUserDto) {
    await Promise.all([this.validateDepartment(companyId, dto.departmentId), this.validateManager(companyId, dto.managerId)]);

    const passwordHash = await bcrypt.hash(dto.password ?? "TempPass123!", 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          companyId,
          email: dto.email.toLowerCase(),
          passwordHash,
          name: dto.name,
          jobTitle: dto.jobTitle,
          departmentId: dto.departmentId,
          managerId: dto.managerId,
          locale: dto.locale ?? Locale.AR,
          status: dto.status ?? UserStatus.INVITED
        },
        select: this.publicSelect()
      });

      if (dto.roleIds?.length) {
        const roles = await tx.role.findMany({
          where: { companyId, id: { in: dto.roleIds }, deletedAt: null },
          select: { id: true }
        });

        if (roles.length !== dto.roleIds.length) {
          throw new BadRequestException("One or more roles do not belong to tenant");
        }

        await tx.userRole.createMany({
          data: roles.map((role) => ({
            companyId,
            userId: created.id,
            roleId: role.id
          })),
          skipDuplicates: true
        });
      }

      return created;
    });

    if (dto.managerId) {
      this.eventBus.publish({
        name: "TEAM_MEMBER_ASSIGNED",
        companyId,
        actorId,
        entityType: EntityType.USER,
        entityId: user.id,
        payload: {
          employeeId: user.id,
          managerId: dto.managerId
        }
      });
    }

    await this.indexUser(companyId, user.id);

    return user;
  }

  private async indexUser(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { companyId, id: userId, deletedAt: null },
      include: {
        department: { select: { name: true, code: true } },
        manager: { select: { name: true, email: true } }
      }
    });

    if (!user) {
      return;
    }

    await this.searchIndexer.index({
      companyId,
      entityType: EntityType.USER,
      entityId: user.id,
      title: user.name,
      content: [user.name, user.email, user.jobTitle, user.department?.name, user.department?.code, user.manager?.name, user.manager?.email]
        .filter(Boolean)
        .join("\n")
    });
  }

  private async validateDepartment(companyId: string, departmentId?: string) {
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

  private async validateManager(companyId: string, managerId?: string) {
    if (!managerId) {
      return;
    }

    const manager = await this.prisma.user.findFirst({
      where: { id: managerId, companyId, deletedAt: null },
      select: { id: true }
    });

    if (!manager) {
      throw new BadRequestException("Manager does not belong to tenant");
    }
  }

  private publicSelect() {
    return {
      id: true,
      companyId: true,
      departmentId: true,
      managerId: true,
      email: true,
      name: true,
      jobTitle: true,
      locale: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true
        }
      },
      manager: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      userRoles: {
        where: { deletedAt: null },
        select: {
          role: {
            select: {
              id: true,
              name: true,
              systemName: true
            }
          }
        }
      }
    } as const;
  }
}
