import { Injectable } from "@nestjs/common";
import { EntityType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommentDto } from "./dto/create-comment.dto";

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  findByEntity(companyId: string, entityType: EntityType, entityId: string) {
    return this.prisma.comment.findMany({
      where: { companyId, entityType, entityId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  create(companyId: string, userId: string, dto: CreateCommentDto) {
    return this.prisma.comment.create({
      data: {
        companyId,
        userId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        content: dto.content
      }
    });
  }
}
