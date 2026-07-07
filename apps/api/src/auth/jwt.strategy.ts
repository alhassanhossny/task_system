import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";

interface JwtPayload {
  sub: string;
  platformAdmin?: boolean;
  switchSessionId?: string;
  actingCompanyId?: string;
  originalCompanyId?: string | null;
  permissions?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET", "change-me-in-production")
    });
  }

  validate(payload: JwtPayload) {
    return this.authService.validateUser(payload.sub, payload);
  }
}
