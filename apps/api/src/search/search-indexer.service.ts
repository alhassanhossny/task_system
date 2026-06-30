import { Injectable } from "@nestjs/common";
import { EntityType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface SearchIndexInput {
  companyId: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  content: string;
}

@Injectable()
export class SearchIndexer {
  constructor(private readonly prisma: PrismaService) {}

  index(input: SearchIndexInput) {
    return this.prisma.searchIndex.upsert({
      where: {
        companyId_entityType_entityId: {
          companyId: input.companyId,
          entityType: input.entityType,
          entityId: input.entityId
        }
      },
      update: {
        title: input.title,
        content: input.content,
        deletedAt: null
      },
      create: input
    });
  }

  remove(companyId: string, entityType: EntityType, entityId: string) {
    return this.prisma.searchIndex.updateMany({
      where: { companyId, entityType, entityId, deletedAt: null },
      data: { deletedAt: new Date() }
    });
  }
}
