import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.department.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  async create(companyId: string, dto: CreateDepartmentDto) {
    if (dto.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: dto.managerId, companyId, deletedAt: null }
      });

      if (!manager) {
        throw new BadRequestException("Manager does not belong to tenant");
      }
    }

    return this.prisma.department.create({
      data: {
        companyId,
        name: dto.name,
        code: dto.code,
        managerId: dto.managerId,
        description: dto.description
      }
    });
  }
}
