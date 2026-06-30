import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { SmtpSettingsController } from "./smtp-settings.controller";
import { SmtpSettingsService } from "./smtp-settings.service";

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [SmtpSettingsController],
  providers: [SmtpSettingsService],
  exports: [SmtpSettingsService]
})
export class SmtpSettingsModule {}
