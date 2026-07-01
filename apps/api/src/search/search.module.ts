import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SavedFiltersController } from "./saved-filters.controller";
import { SavedFiltersService } from "./saved-filters.service";
import { SearchController } from "./search.controller";
import { SearchIndexer } from "./search-indexer.service";
import { SearchService } from "./search.service";

@Module({
  imports: [PrismaModule],
  controllers: [SearchController, SavedFiltersController],
  providers: [SearchIndexer, SearchService, SavedFiltersService],
  exports: [SearchIndexer]
})
export class SearchModule {}
