import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET", "change-me-in-production"),
        signOptions: {
          expiresIn: parseJwtDuration(config.get<string>("JWT_EXPIRES_IN", "15m"))
        }
      })
    })
  ],
  controllers: [PlatformController],
  providers: [PlatformService]
})
export class PlatformModule {}

function parseJwtDuration(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 15 * 60;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60
  };

  return amount * multipliers[unit];
}
