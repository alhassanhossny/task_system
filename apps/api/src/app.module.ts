import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ActivitiesModule } from "./activities/activities.module";
import { AuditLogsModule } from "./audit-logs/audit-logs.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { TenantGuard } from "./common/guards/tenant.guard";
import { CompaniesModule } from "./companies/companies.module";
import { DepartmentsModule } from "./departments/departments.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RolesModule } from "./roles/roles.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    RolesModule,
    DepartmentsModule,
    AuditLogsModule,
    ActivitiesModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard }
  ]
})
export class AppModule {}
