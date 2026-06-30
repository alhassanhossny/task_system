import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SearchIndexer } from "./search-indexer.service";

@Module({
  imports: [PrismaModule],
  providers: [SearchIndexer],
  exports: [SearchIndexer]
})
export class SearchModule {}
