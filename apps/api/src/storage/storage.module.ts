import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LocalStorageProvider } from "./local-storage.provider";
import { STORAGE_PROVIDER } from "./storage-provider";

@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useExisting: LocalStorageProvider
    }
  ],
  exports: [STORAGE_PROVIDER]
})
export class StorageModule {}
