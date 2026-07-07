import { Module } from "@nestjs/common";
import { AttachmentsModule } from "../attachments/attachments.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { EmailProvidersModule } from "../email-providers/email-providers.module";
import { PrismaModule } from "../prisma/prisma.module";
import { QueuesModule } from "../queues/queues.module";
import { SearchModule } from "../search/search.module";
import { EmailTemplatesController } from "./email-templates.controller";
import { EmailTemplatesService } from "./email-templates.service";
import { EmailWorker } from "./email.worker";
import { EmailEventsHandler } from "./events/email-events.handler";
import { EmailsController } from "./emails.controller";
import { EmailsService } from "./emails.service";

@Module({
  imports: [PrismaModule, DomainEventsModule, AttachmentsModule, QueuesModule, EmailProvidersModule, SearchModule],
  controllers: [EmailsController, EmailTemplatesController],
  providers: [EmailsService, EmailTemplatesService, EmailWorker, EmailEventsHandler],
  exports: [EmailsService, EmailTemplatesService]
})
export class EmailsModule {}
