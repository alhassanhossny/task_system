import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PROVIDER, StorageProvider } from "../storage/storage-provider";
import { CreateAttachmentDto } from "./dto/create-attachment.dto";

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider
  ) {}

  async findByEntity(companyId: string, entityType: CreateAttachmentDto["entityType"], entityId: string) {
    const attachments = await this.prisma.attachment.findMany({
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

    return Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        objectUrl: await this.storage.getObjectUrl(attachment.filePath)
      }))
    );
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
        filePath: this.storage.normalizeKey(dto.filePath),
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        uploadedById
      }
    });
  }
}
