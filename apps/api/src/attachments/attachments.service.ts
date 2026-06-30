import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAttachmentDto } from "./dto/create-attachment.dto";

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findByEntity(companyId: string, entityType: CreateAttachmentDto["entityType"], entityId: string) {
    return this.prisma.attachment.findMany({
      where: { companyId, entityType, entityId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  async create(companyId: string, actorId: string, dto: CreateAttachmentDto) {
    const uploadedById = dto.uploadedById ?? actorId;
    const uploader = await this.prisma.user.findFirst({
      where: { id: uploadedById, companyId, deletedAt: null },
      select: { id: true }
    });

    if (!uploader) {
      throw new BadRequestException("Uploader does not belong to tenant");
    }

    return this.prisma.attachment.create({
      data: {
        companyId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        fileName: dto.fileName,
        filePath: dto.filePath,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        uploadedById
      }
    });
  }
}
