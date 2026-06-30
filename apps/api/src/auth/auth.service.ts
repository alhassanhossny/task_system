import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Locale, SystemRole, User, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";

type UserWithAccess = User & {
  userRoles: Array<{
    role: {
      systemName: SystemRole;
      rolePermissions: Array<{
        permission: {
          action: string;
          subject: string;
        };
      }>;
    };
  }>;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        companyId: dto.companyId,
        status: UserStatus.ACTIVE,
        deletedAt: null
      },
      include: this.accessInclude()
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return this.issueSession(user);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        deletedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          include: this.accessInclude()
        }
      }
    });

    if (!stored || stored.user.status !== UserStatus.ACTIVE || stored.user.deletedAt) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() }
    });

    return this.issueSession(stored.user);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() }
    });

    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.accessInclude()
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return this.serializeUser(user);
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.accessInclude()
    });

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("User is not active");
    }

    return this.serializeUser(user);
  }

  private async issueSession(user: UserWithAccess) {
    const serialized = this.serializeUser(user);
    const accessToken = await this.jwt.signAsync({
      sub: serialized.id,
      companyId: serialized.companyId,
      email: serialized.email,
      roles: serialized.roles,
      permissions: serialized.permissions
    });

    const refreshToken = randomUUID();
    await this.prisma.refreshToken.create({
      data: {
        companyId: serialized.companyId,
        userId: serialized.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.refreshExpiry()
      }
    });

    return {
      accessToken,
      refreshToken,
      user: serialized
    };
  }

  private serializeUser(user: UserWithAccess) {
    const roles = user.userRoles.map((userRole) => userRole.role.systemName);
    const permissions = new Set<string>();

    for (const userRole of user.userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissions.add(`${rolePermission.permission.subject}:${rolePermission.permission.action}`);
      }
    }

    return {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      name: user.name,
      locale: user.locale === Locale.AR ? "ar" : "en",
      roles,
      permissions: [...permissions]
    };
  }

  private accessInclude() {
    return {
      userRoles: {
        where: { deletedAt: null },
        include: {
          role: {
            include: {
              rolePermissions: {
                where: { deletedAt: null },
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    } as const;
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private refreshExpiry() {
    const value = this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "7d");
    const amount = Number.parseInt(value, 10);
    const days = Number.isFinite(amount) ? amount : 7;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
