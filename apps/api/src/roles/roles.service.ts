import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findRoles(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        rolePermissions: {
          where: { deletedAt: null },
          include: {
            permission: true
          }
        }
      }
    });
  }

  findPermissions(companyId: string) {
    return this.prisma.permission.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ subject: "asc" }, { action: "asc" }]
    });
  }
}
