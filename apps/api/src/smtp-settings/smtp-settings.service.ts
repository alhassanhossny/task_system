import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertSmtpSettingDto } from "./dto/upsert-smtp-setting.dto";

@Injectable()
export class SmtpSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async findCurrent(companyId: string) {
    const setting = await this.prisma.smtpSetting.findFirst({
      where: { companyId, deletedAt: null }
    });

    return setting ? this.sanitize(setting) : null;
  }

  async upsert(companyId: string, dto: UpsertSmtpSettingDto) {
    const existing = await this.prisma.smtpSetting.findUnique({
      where: { companyId }
    });

    const passwordEncrypted = dto.password ? this.encrypt(dto.password) : existing?.passwordEncrypted;

    const setting = await this.prisma.smtpSetting.upsert({
      where: { companyId },
      update: {
        host: dto.host,
        port: dto.port,
        username: dto.username,
        passwordEncrypted,
        encryption: dto.encryption,
        fromName: dto.fromName,
        fromEmail: dto.fromEmail,
        deletedAt: null
      },
      create: {
        companyId,
        host: dto.host,
        port: dto.port,
        username: dto.username,
        passwordEncrypted,
        encryption: dto.encryption,
        fromName: dto.fromName,
        fromEmail: dto.fromEmail
      }
    });

    return this.sanitize(setting);
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return ["v1", iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(":");
  }

  private key() {
    const secret = this.config.get<string>("SMTP_ENCRYPTION_KEY") ?? this.config.get<string>("JWT_SECRET", "change-me-in-production");
    return createHash("sha256").update(secret).digest();
  }

  private sanitize(setting: {
    id: string;
    companyId: string;
    host: string;
    port: number;
    username: string | null;
    passwordEncrypted: string | null;
    encryption: string;
    fromName: string;
    fromEmail: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }) {
    return {
      id: setting.id,
      companyId: setting.companyId,
      host: setting.host,
      port: setting.port,
      username: setting.username,
      hasPassword: Boolean(setting.passwordEncrypted),
      encryption: setting.encryption,
      fromName: setting.fromName,
      fromEmail: setting.fromEmail,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
      deletedAt: setting.deletedAt
    };
  }
}
