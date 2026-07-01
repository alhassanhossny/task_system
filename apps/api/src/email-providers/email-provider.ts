export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");

export interface EmailProviderAddress {
  email: string;
  name?: string;
}

export interface EmailProviderAttachment {
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
}

export interface EmailProviderMessage {
  companyId: string;
  from: EmailProviderAddress;
  replyTo?: EmailProviderAddress;
  to: EmailProviderAddress[];
  cc?: EmailProviderAddress[];
  bcc?: EmailProviderAddress[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailProviderAttachment[];
}

export interface EmailProviderResult {
  provider: string;
  externalId?: string;
  accepted: string[];
  rejected: string[];
}

export interface EmailProvider {
  send(message: EmailProviderMessage): Promise<EmailProviderResult>;
}
