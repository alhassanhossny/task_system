export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailProviderMessage {
  from: EmailAddress;
  to: EmailAddress[];
  subject: string;
  html?: string;
  text?: string;
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
