import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EMAIL_PROVIDER } from "./email-provider";
import { SmtpProvider } from "./smtp.provider";

@Module({
  imports: [PrismaModule],
  providers: [
    SmtpProvider,
    {
      provide: EMAIL_PROVIDER,
      useExisting: SmtpProvider
    }
  ],
  exports: [EMAIL_PROVIDER]
})
export class EmailProvidersModule {}
