import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSavedFilterDto } from "./dto/create-saved-filter.dto";
import { SavedFilterQueryDto } from "./dto/saved-filter-query.dto";
import { UpdateSavedFilterDto } from "./dto/update-saved-filter.dto";

@Injectable()
export class SavedFiltersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, userId: string, query: SavedFilterQueryDto) {
    return this.prisma.savedFilter.findMany({
      where: {
        companyId,
        userId,
        entityType: query.entityType,
        deletedAt: null
      },
      orderBy: [{ entityType: "asc" }, { name: "asc" }]
    });
  }

  create(companyId: string, userId: string, dto: CreateSavedFilterDto) {
    return this.prisma.savedFilter.upsert({
      where: {
        companyId_userId_entityType_name: {
          companyId,
          userId,
          entityType: dto.entityType,
          name: dto.name
        }
      },
      update: {
        filterJson: dto.filterJson as Prisma.InputJsonValue,
        deletedAt: null
      },
      create: {
        companyId,
        userId,
        entityType: dto.entityType,
        name: dto.name,
        filterJson: dto.filterJson as Prisma.InputJsonValue
      }
    });
  }

  async update(companyId: string, userId: string, id: string, dto: UpdateSavedFilterDto) {
    await this.ensureOwned(companyId, userId, id);

    return this.prisma.savedFilter.update({
      where: { id },
      data: {
        name: dto.name,
        entityType: dto.entityType,
        filterJson: dto.filterJson as Prisma.InputJsonValue | undefined
      }
    });
  }

  async remove(companyId: string, userId: string, id: string) {
    await this.ensureOwned(companyId, userId, id);

    await this.prisma.savedFilter.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return { success: true };
  }

  private async ensureOwned(companyId: string, userId: string, id: string) {
    const savedFilter = await this.prisma.savedFilter.findFirst({
      where: { id, companyId, userId, deletedAt: null },
      select: { id: true }
    });

    if (!savedFilter) {
      throw new NotFoundException("Saved filter not found");
    }

    return savedFilter;
  }
}
