import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateNotificationDto } from "./dto/create-notification.dto";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findForUser(companyId: string, userId: string, options: { unreadOnly?: boolean; limit?: number }) {
    return this.prisma.notification.findMany({
      where: {
        companyId,
        userId,
        deletedAt: null,
        ...(options.unreadOnly ? { isRead: false } : {})
      },
      take: Math.min(Math.max(options.limit ?? 20, 1), 100),
      orderBy: { createdAt: "desc" }
    });
  }

  async create(companyId: string, dto: CreateNotificationDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, companyId, deletedAt: null },
      select: { id: true }
    });

    if (!user) {
      throw new BadRequestException("Notification user does not belong to tenant");
    }

    return this.prisma.notification.create({
      data: {
        companyId,
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        entityType: dto.entityType,
        entityId: dto.entityId
      }
    });
  }

  async markRead(companyId: string, userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, companyId, userId, deletedAt: null }
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: notification.readAt ?? new Date()
      }
    });
  }

  async markAllRead(companyId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { companyId, userId, isRead: false, deletedAt: null },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return { updated: result.count };
  }
}
