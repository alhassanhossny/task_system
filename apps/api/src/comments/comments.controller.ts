import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { CommentsService } from "./comments.service";
import { CommentQueryDto } from "./dto/comment-query.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";

@ApiBearerAuth()
@ApiTags("comments")
@Controller("comments")
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @RequirePermissions(PERMISSIONS.commentsRead)
  @Get()
  findByEntity(@TenantId() tenantId: string, @Query() query: CommentQueryDto) {
    return this.commentsService.findByEntity(tenantId, query.entityType, query.entityId);
  }

  @RequirePermissions(PERMISSIONS.commentsWrite)
  @Post()
  create(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Body() dto: CreateCommentDto) {
    return this.commentsService.create(tenantId, user.id, dto);
  }
}
