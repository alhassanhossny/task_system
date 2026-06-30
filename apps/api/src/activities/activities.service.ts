import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, limit: number) {
    return this.prisma.activity.findMany({
      where: { companyId, deletedAt: null },
      take: Math.min(Math.max(limit, 1), 100),
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }
}
