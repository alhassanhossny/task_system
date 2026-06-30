import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Locale, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(companyId: string, dto: CreateUserDto) {
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, companyId, deletedAt: null }
      });

      if (!department) {
        throw new BadRequestException("Department does not belong to tenant");
      }
    }

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

    return user;
  }

  private publicSelect() {
    return {
      id: true,
      companyId: true,
      departmentId: true,
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
