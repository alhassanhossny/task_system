import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CompanyPlan, CompanyStatus, Locale, SystemRole } from "@prisma/client";
import { RequestUser } from "../common/types/request-user";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCompanyDto } from "./dto/create-company.dto";

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: RequestUser, tenantId: string) {
    const where = user.roles.includes(SystemRole.SUPER_ADMIN) ? { deletedAt: null } : { id: tenantId, deletedAt: null };
    return this.prisma.company.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        defaultLocale: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        defaultLocale: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    return company;
  }

  async findOneForUser(user: RequestUser, id: string) {
    if (!user.roles.includes(SystemRole.SUPER_ADMIN) && user.companyId !== id) {
      throw new ForbiddenException("Cannot access another company");
    }

    return this.findOne(id);
  }

  create(dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        plan: dto.plan ?? CompanyPlan.STARTER,
        status: dto.status ?? CompanyStatus.TRIAL,
        defaultLocale: dto.defaultLocale ?? Locale.AR
      }
    });
  }
}
