import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmailTemplateDto } from "./dto/create-email-template.dto";
import { UpdateEmailTemplateDto } from "./dto/update-email-template.dto";

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.emailTemplate.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }]
    });
  }

  async create(companyId: string, actorId: string, dto: CreateEmailTemplateDto) {
    return this.prisma.emailTemplate.create({
      data: {
        companyId,
        createdById: actorId,
        name: dto.name,
        subject: dto.subject,
        body: dto.body,
        isSystem: dto.isSystem ?? false
      }
    });
  }

  async update(companyId: string, id: string, dto: UpdateEmailTemplateDto) {
    await this.ensureTemplate(companyId, id);

    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        subject: dto.subject,
        body: dto.body,
        isSystem: dto.isSystem
      }
    });
  }

  async remove(companyId: string, id: string) {
    const template = await this.ensureTemplate(companyId, id);

    if (template.isSystem) {
      throw new BadRequestException("System email templates cannot be deleted");
    }

    await this.prisma.emailTemplate.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return { success: true };
  }

  private async ensureTemplate(companyId: string, id: string) {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, companyId, deletedAt: null }
    });

    if (!template) {
      throw new NotFoundException("Email template not found");
    }

    return template;
  }
}
