import { SetMetadata } from "@nestjs/common";

export const PLATFORM_PERMISSIONS_KEY = "platform_permissions";

export const PlatformPermission = (...permissions: string[]) => SetMetadata(PLATFORM_PERMISSIONS_KEY, permissions);
