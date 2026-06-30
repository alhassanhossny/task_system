import { Module } from "@nestjs/common";
import { EMAIL_PROVIDER } from "./email-provider";
import { SmtpProvider } from "./smtp.provider";

@Module({
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
