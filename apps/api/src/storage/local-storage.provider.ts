import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StorageProvider } from "./storage-provider";

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly config: ConfigService) {}

  normalizeKey(filePath: string) {
    return filePath.replace(/^\/+/, "").replace(/\.\.(\/|\\)/g, "");
  }

  async getObjectUrl(filePath: string) {
    const publicBaseUrl = this.config.get<string>("STORAGE_PUBLIC_BASE_URL");

    if (!publicBaseUrl) {
      return null;
    }

    return `${publicBaseUrl.replace(/\/$/, "")}/${this.normalizeKey(filePath)}`;
  }
}
