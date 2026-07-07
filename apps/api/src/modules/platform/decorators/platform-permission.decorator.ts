import { SetMetadata } from "@nestjs/common";
import { PLATFORM_PERMISSIONS_KEY } from "../../../common/constants";

export const PlatformPermission = (...permissions: string[]) => SetMetadata(PLATFORM_PERMISSIONS_KEY, permissions);
