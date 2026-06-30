import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { EmailProvider, EmailProviderMessage, EmailProviderResult } from "./email-provider";

@Injectable()
export class SmtpProvider implements EmailProvider {
  async send(message: EmailProviderMessage): Promise<EmailProviderResult> {
    if (!message.to.length) {
      return {
        provider: "smtp",
        accepted: [],
        rejected: []
      };
    }

    throw new ServiceUnavailableException("SMTP worker is not implemented yet. Queue email jobs through Phase 2D/Phase 3 email delivery.");
  }
}
