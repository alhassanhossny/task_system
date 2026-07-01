import { Module } from "@nestjs/common";
import { LeaveRequestsModule } from "../leave-requests/leave-requests.module";
import { SearchModule } from "../search/search.module";
import { TeamEventsHandler } from "./events/team-events.handler";
import { TeamController } from "./team.controller";
import { TeamService } from "./team.service";

@Module({
  imports: [LeaveRequestsModule, SearchModule],
  controllers: [TeamController],
  providers: [TeamService, TeamEventsHandler],
  exports: [TeamService]
})
export class TeamModule {}
