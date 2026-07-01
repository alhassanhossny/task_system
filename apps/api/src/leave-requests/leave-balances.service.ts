import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EntityType, Prisma } from "@prisma/client";
import { DomainEventBus } from "../domain-events/domain-event-bus.service";
import { PrismaService } from "../prisma/prisma.service";
import { LeaveBalanceQueryDto } from "./dto/leave-balance-query.dto";
import { UpdateLeaveBalanceDto } from "./dto/update-leave-balance.dto";
import { UpsertLeaveBalanceDto } from "./dto/upsert-leave-balance.dto";

type LeaveBalanceEventName = "LEAVE_ALLOCATED" | "LEAVE_BALANCE_UPDATED";

@Injectable()
export class LeaveBalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus
  ) {}

  findAll(companyId: string, query: LeaveBalanceQueryDto) {
    return this.prisma.leaveBalance.findMany({
      where: {
        companyId,
        deletedAt: null,
        employeeId: query.employeeId,
        year: query.year ?? new Date().getFullYear()
      },
      orderBy: [{ employee: { name: "asc" } }, { leaveType: { name: "asc" } }],
      include: this.include()
    });
  }

  findMine(companyId: string, employeeId: string, query: LeaveBalanceQueryDto) {
    return this.findAll(companyId, { ...query, employeeId });
  }

  async upsert(companyId: string, actorId: string | null, dto: UpsertLeaveBalanceDto) {
    await Promise.all([this.ensureUser(companyId, dto.employeeId), this.ensureLeaveType(companyId, dto.leaveTypeId)]);

    const usedDays = dto.usedDays ?? 0;
    this.ensureValidBalance(dto.allocatedDays, usedDays);

    const existing = await this.prisma.leaveBalance.findUnique({
      where: {
        companyId_employeeId_leaveTypeId_year: {
          companyId,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          year: dto.year
        }
      },
      select: { id: true }
    });

    const balance = await this.prisma.leaveBalance.upsert({
      where: {
        companyId_employeeId_leaveTypeId_year: {
          companyId,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          year: dto.year
        }
      },
      update: {
        allocatedDays: dto.allocatedDays,
        usedDays,
        remainingDays: dto.allocatedDays - usedDays,
        deletedAt: null
      },
      create: {
        companyId,
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        year: dto.year,
        allocatedDays: dto.allocatedDays,
        usedDays,
        remainingDays: dto.allocatedDays - usedDays
      },
      include: this.include()
    });

    this.publishBalanceEvent(existing ? "LEAVE_BALANCE_UPDATED" : "LEAVE_ALLOCATED", companyId, actorId, balance);

    return balance;
  }

  async update(companyId: string, actorId: string | null, id: string, dto: UpdateLeaveBalanceDto) {
    const existing = await this.ensureBalance(companyId, id);
    const allocatedDays = dto.allocatedDays ?? Number(existing.allocatedDays);
    const usedDays = dto.usedDays ?? Number(existing.usedDays);
    this.ensureValidBalance(allocatedDays, usedDays);

    const balance = await this.prisma.leaveBalance.update({
      where: { id },
      data: {
        allocatedDays,
        usedDays,
        remainingDays: allocatedDays - usedDays
      },
      include: this.include()
    });

    this.publishBalanceEvent("LEAVE_BALANCE_UPDATED", companyId, actorId, balance);

    return balance;
  }

  async ensureAvailable(
    companyId: string,
    employeeId: string,
    leaveType: { id: string; annualAllowanceDays: number | null },
    year: number,
    durationDays: number
  ) {
    if (!leaveType.annualAllowanceDays) {
      return;
    }

    const balance = await this.ensureOpeningBalance(companyId, employeeId, leaveType.id, year, leaveType.annualAllowanceDays);

    if (Number(balance.remainingDays) < durationDays) {
      throw new BadRequestException("Leave balance is not sufficient for this request");
    }
  }

  async consumeApproved(
    tx: Prisma.TransactionClient,
    companyId: string,
    leave: { employeeId: string; leaveTypeId: string | null; startsAt: Date; durationDays: Prisma.Decimal | number }
  ) {
    if (!leave.leaveTypeId) {
      return null;
    }

    const leaveType = await tx.leaveType.findFirst({
      where: { companyId, id: leave.leaveTypeId, deletedAt: null }
    });

    if (!leaveType?.annualAllowanceDays) {
      return null;
    }

    const year = leave.startsAt.getFullYear();
    const balance = await tx.leaveBalance.upsert({
      where: {
        companyId_employeeId_leaveTypeId_year: {
          companyId,
          employeeId: leave.employeeId,
          leaveTypeId: leave.leaveTypeId,
          year
        }
      },
      update: { deletedAt: null },
      create: {
        companyId,
        employeeId: leave.employeeId,
        leaveTypeId: leave.leaveTypeId,
        year,
        allocatedDays: leaveType.annualAllowanceDays,
        usedDays: 0,
        remainingDays: leaveType.annualAllowanceDays
      }
    });
    const durationDays = Number(leave.durationDays);
    const remainingDays = Number(balance.remainingDays);

    if (remainingDays < durationDays) {
      throw new BadRequestException("Leave balance is not sufficient for approval");
    }

    return tx.leaveBalance.update({
      where: { id: balance.id },
      data: {
        usedDays: Number(balance.usedDays) + durationDays,
        remainingDays: remainingDays - durationDays
      },
      include: this.include()
    });
  }

  publishBalanceUpdated(companyId: string, actorId: string | null, balance: Awaited<ReturnType<LeaveBalancesService["consumeApproved"]>>) {
    if (balance) {
      this.publishBalanceEvent("LEAVE_BALANCE_UPDATED", companyId, actorId, balance);
    }
  }

  private async ensureOpeningBalance(companyId: string, employeeId: string, leaveTypeId: string, year: number, allocatedDays: number) {
    return this.prisma.leaveBalance.upsert({
      where: {
        companyId_employeeId_leaveTypeId_year: {
          companyId,
          employeeId,
          leaveTypeId,
          year
        }
      },
      update: { deletedAt: null },
      create: {
        companyId,
        employeeId,
        leaveTypeId,
        year,
        allocatedDays,
        usedDays: 0,
        remainingDays: allocatedDays
      }
    });
  }

  private async ensureBalance(companyId: string, id: string) {
    const balance = await this.prisma.leaveBalance.findFirst({
      where: { companyId, id, deletedAt: null }
    });

    if (!balance) {
      throw new NotFoundException("Leave balance not found");
    }

    return balance;
  }

  private async ensureLeaveType(companyId: string, id: string) {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { companyId, id, isActive: true, deletedAt: null }
    });

    if (!leaveType) {
      throw new BadRequestException("Leave type does not belong to tenant");
    }

    return leaveType;
  }

  private async ensureUser(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { companyId, id, deletedAt: null },
      select: { id: true }
    });

    if (!user) {
      throw new BadRequestException("Employee does not belong to tenant");
    }
  }

  private ensureValidBalance(allocatedDays: number, usedDays: number) {
    if (usedDays > allocatedDays) {
      throw new BadRequestException("Used leave days cannot exceed allocated days");
    }
  }

  private publishBalanceEvent(
    name: LeaveBalanceEventName,
    companyId: string,
    actorId: string | null,
    balance: {
      id: string;
      employeeId: string;
      leaveTypeId: string;
      year: number;
      allocatedDays: Prisma.Decimal | number;
      usedDays: Prisma.Decimal | number;
      remainingDays: Prisma.Decimal | number;
    }
  ) {
    this.eventBus.publish({
      name,
      companyId,
      actorId,
      entityType: EntityType.USER,
      entityId: balance.employeeId,
      payload: {
        balanceId: balance.id,
        employeeId: balance.employeeId,
        leaveTypeId: balance.leaveTypeId,
        year: balance.year,
        allocatedDays: Number(balance.allocatedDays),
        usedDays: Number(balance.usedDays),
        remainingDays: Number(balance.remainingDays)
      }
    });
  }

  private include() {
    return {
      employee: { select: { id: true, name: true, email: true, jobTitle: true } },
      leaveType: { select: { id: true, name: true, code: true, isPaid: true } }
    } as const;
  }
}
