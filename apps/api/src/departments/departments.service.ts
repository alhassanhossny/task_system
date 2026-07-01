import { BadRequestException, Injectable } from "@nestjs/common";
import { EntityType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SearchIndexer } from "../search/search-indexer.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndexer: SearchIndexer
  ) {}

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

    const department = await this.prisma.department.create({
      data: {
        companyId,
        name: dto.name,
        code: dto.code,
        managerId: dto.managerId,
        description: dto.description
      },
      include: {
        manager: { select: { name: true, email: true } }
      }
    });

    await this.searchIndexer.index({
      companyId,
      entityType: EntityType.DEPARTMENT,
      entityId: department.id,
      title: department.name,
      content: [department.name, department.code, department.description, department.manager?.name, department.manager?.email].filter(Boolean).join("\n")
    });

    return department;
  }
}
