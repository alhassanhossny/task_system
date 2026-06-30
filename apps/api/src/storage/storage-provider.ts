export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");

export interface StorageProvider {
  normalizeKey(filePath: string): string;
  getObjectUrl(filePath: string): Promise<string | null>;
}
