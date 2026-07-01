import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ActivitiesModule } from "./activities/activities.module";
import { AttachmentsModule } from "./attachments/attachments.module";
import { AuditLogsModule } from "./audit-logs/audit-logs.module";
import { AuthModule } from "./auth/auth.module";
import { CommentsModule } from "./comments/comments.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { TenantGuard } from "./common/guards/tenant.guard";
import { CompaniesModule } from "./companies/companies.module";
import { DepartmentsModule } from "./departments/departments.module";
import { DomainEventsModule } from "./domain-events/domain-events.module";
import { EmailProvidersModule } from "./email-providers/email-providers.module";
import { EmailsModule } from "./emails/emails.module";
import { HealthModule } from "./health/health.module";
import { LeaveRequestsModule } from "./leave-requests/leave-requests.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QueuesModule } from "./queues/queues.module";
import { RolesModule } from "./roles/roles.module";
import { SearchModule } from "./search/search.module";
import { SmtpSettingsModule } from "./smtp-settings/smtp-settings.module";
import { TasksModule } from "./tasks/tasks.module";
import { TeamModule } from "./team/team.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DomainEventsModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    RolesModule,
    DepartmentsModule,
    AuditLogsModule,
    ActivitiesModule,
    AttachmentsModule,
    CommentsModule,
    NotificationsModule,
    SmtpSettingsModule,
    QueuesModule,
    EmailProvidersModule,
    EmailsModule,
    SearchModule,
    TasksModule,
    LeaveRequestsModule,
    TeamModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard }
  ]
})
export class AppModule {}
