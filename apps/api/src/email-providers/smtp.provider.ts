import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SmtpEncryption } from "@prisma/client";
import { createDecipheriv, createHash } from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import { PrismaService } from "../prisma/prisma.service";
import { EmailProvider, EmailProviderAddress, EmailProviderMessage, EmailProviderResult } from "./email-provider";

type SmtpSocket = net.Socket | tls.TLSSocket;

@Injectable()
export class SmtpProvider implements EmailProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async send(message: EmailProviderMessage): Promise<EmailProviderResult> {
    const setting = await this.prisma.smtpSetting.findFirst({
      where: { companyId: message.companyId, deletedAt: null }
    });

    if (!setting) {
      throw new ServiceUnavailableException("SMTP settings are required before sending email");
    }

    const allRecipients = [...message.to, ...(message.cc ?? []), ...(message.bcc ?? [])];

    if (!allRecipients.length) {
      return {
        provider: "smtp",
        accepted: [],
        rejected: []
      };
    }

    if (this.config.get<string>("SMTP_DELIVERY_MODE") === "mock") {
      return {
        provider: "smtp:mock",
        externalId: `mock-${Date.now()}`,
        accepted: allRecipients.map((recipient) => recipient.email),
        rejected: []
      };
    }

    const from = {
      email: message.from.email || setting.fromEmail,
      name: message.from.name || setting.fromName
    };
    const password = setting.passwordEncrypted ? this.decrypt(setting.passwordEncrypted) : undefined;
    let socket = await this.connect(setting.host, setting.port, setting.encryption);
    const smtp = new SmtpSession(socket);

    try {
      await smtp.read([220]);
      await smtp.command(`EHLO ${this.hostname()}`, [250]);

      if (setting.encryption === SmtpEncryption.STARTTLS) {
        await smtp.command("STARTTLS", [220]);
        socket = tls.connect({ socket, servername: setting.host });
        await new Promise<void>((resolve, reject) => {
          socket.once("secureConnect", resolve);
          socket.once("error", reject);
        });
        smtp.replaceSocket(socket);
        await smtp.command(`EHLO ${this.hostname()}`, [250]);
      }

      if (setting.username && password) {
        await smtp.command(`AUTH PLAIN ${Buffer.from(`\0${setting.username}\0${password}`).toString("base64")}`, [235, 503]);
      }

      await smtp.command(`MAIL FROM:<${from.email}>`, [250]);

      const accepted: string[] = [];
      const rejected: string[] = [];

      for (const recipient of allRecipients) {
        try {
          await smtp.command(`RCPT TO:<${recipient.email}>`, [250, 251]);
          accepted.push(recipient.email);
        } catch {
          rejected.push(recipient.email);
        }
      }

      if (!accepted.length) {
        throw new ServiceUnavailableException("SMTP rejected all recipients");
      }

      await smtp.command("DATA", [354]);
      await smtp.command(`${this.buildData(from, message)}\r\n.`, [250]);
      await smtp.command("QUIT", [221]);

      return {
        provider: "smtp",
        accepted,
        rejected
      };
    } finally {
      socket.destroy();
    }
  }

  private connect(host: string, port: number, encryption: SmtpEncryption) {
    return new Promise<SmtpSocket>((resolve, reject) => {
      const socket =
        encryption === SmtpEncryption.SSL_TLS
          ? tls.connect({ host, port, servername: host })
          : net.connect({
              host,
              port
            });

      socket.setTimeout(15000);
      socket.once(encryption === SmtpEncryption.SSL_TLS ? "secureConnect" : "connect", () => resolve(socket));
      socket.once("timeout", () => reject(new ServiceUnavailableException("SMTP connection timed out")));
      socket.once("error", reject);
    });
  }

  private buildData(from: EmailProviderAddress, message: EmailProviderMessage) {
    const headers = [
      `From: ${this.formatAddress(from)}`,
      `To: ${message.to.map((recipient) => this.formatAddress(recipient)).join(", ")}`,
      message.cc?.length ? `Cc: ${message.cc.map((recipient) => this.formatAddress(recipient)).join(", ")}` : null,
      message.replyTo ? `Reply-To: ${this.formatAddress(message.replyTo)}` : null,
      `Subject: ${this.encodeHeader(message.subject)}`,
      "MIME-Version: 1.0"
    ].filter(Boolean);

    if (message.attachments?.length) {
      const boundary = `taskflow-${Date.now().toString(36)}`;
      const attachmentSummary = message.attachments
        .map((attachment) => `${attachment.fileName} (${attachment.mimeType}, ${attachment.fileSize} bytes): ${attachment.filePath}`)
        .join("\n");

      return [
        ...headers,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/html; charset=utf-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        this.escapeData(message.html ?? message.text ?? ""),
        `--${boundary}`,
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: 8bit",
        "Content-Disposition: inline",
        "",
        this.escapeData(`Linked attachments:\n${attachmentSummary}`),
        `--${boundary}--`
      ].join("\r\n");
    }

    return [
      ...headers,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      this.escapeData(message.html ?? message.text ?? "")
    ].join("\r\n");
  }

  private formatAddress(address: EmailProviderAddress) {
    return address.name ? `${this.encodeHeader(address.name)} <${address.email}>` : address.email;
  }

  private encodeHeader(value: string) {
    return /^[\x00-\x7F]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
  }

  private escapeData(value: string) {
    return value.replace(/\r?\n\./g, "\r\n..");
  }

  private decrypt(value: string) {
    const [version, iv, authTag, encrypted] = value.split(":");

    if (version !== "v1" || !iv || !authTag || !encrypted) {
      throw new ServiceUnavailableException("Unsupported SMTP password format");
    }

    const decipher = createDecipheriv("aes-256-gcm", this.key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(authTag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  }

  private key() {
    const secret = this.config.get<string>("SMTP_ENCRYPTION_KEY") ?? this.config.get<string>("JWT_SECRET", "change-me-in-production");
    return createHash("sha256").update(secret).digest();
  }

  private hostname() {
    return this.config.get<string>("SMTP_HELO_HOST", "taskflow.local");
  }
}

class SmtpSession {
  private buffer = "";

  constructor(private socket: SmtpSocket) {}

  replaceSocket(socket: SmtpSocket) {
    this.socket = socket;
    this.buffer = "";
  }

  async command(command: string, expected: number[]) {
    this.socket.write(`${command}\r\n`);
    return this.read(expected);
  }

  read(expected: number[]) {
    return new Promise<string>((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        const lines = this.buffer.split(/\r?\n/).filter(Boolean);
        const lastLine = lines.at(-1);

        if (!lastLine || !/^\d{3} /.test(lastLine)) {
          return;
        }

        this.socket.off("data", onData);
        this.socket.off("error", onError);
        const code = Number(lastLine.slice(0, 3));
        const response = this.buffer;
        this.buffer = "";

        if (expected.includes(code)) {
          resolve(response);
          return;
        }

        reject(new ServiceUnavailableException(`SMTP command failed: ${lastLine}`));
      };

      const onError = (error: Error) => {
        this.socket.off("data", onData);
        this.socket.off("error", onError);
        reject(error);
      };

      this.socket.on("data", onData);
      this.socket.once("error", onError);
    });
  }
}
