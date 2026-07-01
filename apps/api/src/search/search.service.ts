import { Injectable } from "@nestjs/common";
import { EntityType, Prisma, SearchIndex } from "@prisma/client";
import { PERMISSIONS } from "../common/constants";
import { RequestUser } from "../common/types/request-user";
import { PrismaService } from "../prisma/prisma.service";
import { SearchQueryDto, SearchType } from "./dto/search-query.dto";

const SEARCHABLE_TYPES = [EntityType.TASK, EntityType.USER, EntityType.LEAVE_REQUEST, EntityType.DEPARTMENT] as const;
type SearchableEntityType = (typeof SEARCHABLE_TYPES)[number];

interface SearchMetadata {
  subtitle: string;
  url: string;
}

interface RankedSearchIndex extends SearchIndex {
  score: number;
}

export interface SearchResult {
  id: string;
  type: SearchableEntityType;
  title: string;
  subtitle: string;
  url: string;
  highlight: string;
  updatedAt: Date;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(companyId: string, user: RequestUser, query: SearchQueryDto) {
    const term = (query.q ?? "").trim();
    const limit = query.limit ?? 10;
    const page = query.page ?? 1;
    const requestedTypes = this.resolveTypes(query.type ?? "ALL");

    if (!term || !requestedTypes.length) {
      return { results: [], total: 0, page, limit };
    }

    await this.rememberSearch(companyId, user.id, term);

    const conditions: Prisma.SearchIndexWhereInput[] = [
      { title: { contains: term, mode: "insensitive" } },
      { content: { contains: term, mode: "insensitive" } }
    ];
    if (this.isUuid(term)) {
      conditions.unshift({ entityId: term });
    }

    const candidates = await this.prisma.searchIndex.findMany({
      where: {
        companyId,
        deletedAt: null,
        entityType: { in: requestedTypes },
        OR: conditions
      },
      orderBy: { updatedAt: "desc" },
      take: 200
    });

    const accessible = await this.filterAccessible(companyId, user, candidates);
    const ranked = accessible
      .map((item) => ({ ...item, score: this.score(item, term) }))
      .sort((a, b) => b.score - a.score || b.updatedAt.getTime() - a.updatedAt.getTime());
    const total = ranked.length;
    const pageItems = ranked.slice((page - 1) * limit, page * limit);
    const metadata = await this.metadata(companyId, pageItems);

    return {
      results: pageItems.map((item) => {
        const key = this.key(item.entityType as SearchableEntityType, item.entityId);
        const meta = metadata.get(key) ?? this.fallbackMetadata(item.entityType as SearchableEntityType, item.entityId, item.content);

        return {
          id: item.entityId,
          type: item.entityType as SearchableEntityType,
          title: item.title,
          subtitle: meta.subtitle,
          url: meta.url,
          highlight: this.highlight(item.content || item.title, term),
          updatedAt: item.updatedAt
        };
      }),
      total,
      page,
      limit
    };
  }

  recent(companyId: string, userId: string) {
    return this.prisma.recentSearch.findMany({
      where: { companyId, userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20
    });
  }

  private resolveTypes(type: SearchType): SearchableEntityType[] {
    if (type === "ALL") {
      return [...SEARCHABLE_TYPES];
    }

    return SEARCHABLE_TYPES.includes(type as SearchableEntityType) ? [type as SearchableEntityType] : [];
  }

  private async rememberSearch(companyId: string, userId: string, query: string) {
    const normalized = query.slice(0, 250);

    await this.prisma.recentSearch.upsert({
      where: {
        companyId_userId_query: {
          companyId,
          userId,
          query: normalized
        }
      },
      update: {
        createdAt: new Date(),
        deletedAt: null
      },
      create: {
        companyId,
        userId,
        query: normalized
      }
    });

    const stale = await this.prisma.recentSearch.findMany({
      where: { companyId, userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      skip: 20,
      select: { id: true }
    });

    if (stale.length) {
      await this.prisma.recentSearch.deleteMany({
        where: { id: { in: stale.map((item) => item.id) } }
      });
    }
  }

  private async filterAccessible(companyId: string, user: RequestUser, items: SearchIndex[]) {
    const byType = new Map<SearchableEntityType, string[]>();

    for (const item of items) {
      if (!SEARCHABLE_TYPES.includes(item.entityType as SearchableEntityType)) {
        continue;
      }

      const type = item.entityType as SearchableEntityType;
      byType.set(type, [...(byType.get(type) ?? []), item.entityId]);
    }

    const allowed = new Set<string>();

    await Promise.all(
      [...byType.entries()].map(async ([type, ids]) => {
        const entityIds = await this.accessibleIds(companyId, user, type, [...new Set(ids)]);
        for (const id of entityIds) {
          allowed.add(this.key(type, id));
        }
      })
    );

    return items.filter((item) => allowed.has(this.key(item.entityType as SearchableEntityType, item.entityId)));
  }

  private async accessibleIds(companyId: string, user: RequestUser, type: SearchableEntityType, ids: string[]) {
    if (!ids.length || !this.canReadType(user, type)) {
      return [];
    }

    if (type === EntityType.TASK) {
      const globalRead = user.permissions.includes(PERMISSIONS.tasksRead);
      const rows = await this.prisma.task.findMany({
        where: {
          companyId,
          id: { in: ids },
          deletedAt: null,
          assignees: globalRead
            ? undefined
            : {
                some: {
                  deletedAt: null,
                  user: { managerId: user.id, deletedAt: null }
                }
              }
        },
        select: { id: true }
      });
      return rows.map((row) => row.id);
    }

    if (type === EntityType.USER) {
      const globalRead = user.permissions.includes(PERMISSIONS.usersRead);
      const rows = await this.prisma.user.findMany({
        where: {
          companyId,
          id: { in: ids },
          deletedAt: null,
          managerId: globalRead ? undefined : user.id
        },
        select: { id: true }
      });
      return rows.map((row) => row.id);
    }

    if (type === EntityType.LEAVE_REQUEST) {
      const globalRead = user.permissions.includes(PERMISSIONS.leaveRequestsRead);
      const rows = await this.prisma.leaveRequest.findMany({
        where: {
          companyId,
          id: { in: ids },
          deletedAt: null,
          employee: globalRead ? undefined : { managerId: user.id, deletedAt: null }
        },
        select: { id: true }
      });
      return rows.map((row) => row.id);
    }

    const rows = await this.prisma.department.findMany({
      where: { companyId, id: { in: ids }, deletedAt: null },
      select: { id: true }
    });
    return rows.map((row) => row.id);
  }

  private canReadType(user: RequestUser, type: SearchableEntityType) {
    if (type === EntityType.TASK) {
      return user.permissions.includes(PERMISSIONS.tasksRead) || user.permissions.includes(PERMISSIONS.tasksViewTeam);
    }

    if (type === EntityType.USER) {
      return user.permissions.includes(PERMISSIONS.usersRead) || user.permissions.includes(PERMISSIONS.usersViewTeam);
    }

    if (type === EntityType.LEAVE_REQUEST) {
      return user.permissions.includes(PERMISSIONS.leaveRequestsRead) || user.permissions.includes(PERMISSIONS.leaveRequestsViewTeam);
    }

    return user.permissions.includes(PERMISSIONS.departmentsRead);
  }

  private score(item: SearchIndex, term: string) {
    const q = this.normalize(term);
    const title = this.normalize(item.title);
    const content = this.normalize(item.content);
    const lines = item.content.split(/\r?\n/).map((line) => this.normalize(line));
    let score = 0;

    if (this.normalize(item.entityId) === q) score += 1000;
    if (title === q) score += 850;
    if (lines.some((line) => line === q)) score += 750;
    if (title.startsWith(q)) score += 650;
    if (title.includes(q)) score += 450;
    if (content.includes(q)) score += 150;
    if (item.entityType === EntityType.TASK && /^task-\d+/i.test(term)) score += 80;
    if (item.entityType === EntityType.LEAVE_REQUEST && /^(lr|pr)-\d+/i.test(term)) score += 80;

    return score;
  }

  private async metadata(companyId: string, items: RankedSearchIndex[]) {
    const map = new Map<string, SearchMetadata>();
    const idsByType = new Map<SearchableEntityType, string[]>();

    for (const item of items) {
      const type = item.entityType as SearchableEntityType;
      idsByType.set(type, [...(idsByType.get(type) ?? []), item.entityId]);
    }

    await Promise.all([
      this.taskMetadata(companyId, idsByType.get(EntityType.TASK) ?? [], map),
      this.userMetadata(companyId, idsByType.get(EntityType.USER) ?? [], map),
      this.leaveMetadata(companyId, idsByType.get(EntityType.LEAVE_REQUEST) ?? [], map),
      this.departmentMetadata(companyId, idsByType.get(EntityType.DEPARTMENT) ?? [], map)
    ]);

    return map;
  }

  private async taskMetadata(companyId: string, ids: string[], map: Map<string, SearchMetadata>) {
    if (!ids.length) return;

    const tasks = await this.prisma.task.findMany({
      where: { companyId, id: { in: ids }, deletedAt: null },
      include: {
        department: { select: { name: true, code: true } },
        assignees: { where: { deletedAt: null }, include: { user: { select: { name: true } } } }
      }
    });

    for (const task of tasks) {
      map.set(this.key(EntityType.TASK, task.id), {
        subtitle: [task.taskNumber, task.department?.name, task.assignees.map((assignee) => assignee.user.name).join(", ")].filter(Boolean).join(" · "),
        url: `/tasks/list?taskId=${task.id}`
      });
    }
  }

  private async userMetadata(companyId: string, ids: string[], map: Map<string, SearchMetadata>) {
    if (!ids.length) return;

    const users = await this.prisma.user.findMany({
      where: { companyId, id: { in: ids }, deletedAt: null },
      include: {
        department: { select: { name: true, code: true } },
        manager: { select: { name: true } }
      }
    });

    for (const user of users) {
      map.set(this.key(EntityType.USER, user.id), {
        subtitle: [user.email, user.jobTitle, user.department?.name, user.manager?.name ? `Manager: ${user.manager.name}` : null].filter(Boolean).join(" · "),
        url: `/employees?userId=${user.id}`
      });
    }
  }

  private async leaveMetadata(companyId: string, ids: string[], map: Map<string, SearchMetadata>) {
    if (!ids.length) return;

    const leaves = await this.prisma.leaveRequest.findMany({
      where: { companyId, id: { in: ids }, deletedAt: null },
      include: {
        employee: { select: { name: true, manager: { select: { name: true } } } },
        department: { select: { name: true } }
      }
    });

    for (const leave of leaves) {
      map.set(this.key(EntityType.LEAVE_REQUEST, leave.id), {
        subtitle: [leave.requestNumber, leave.employee.name, leave.employee.manager?.name, leave.department?.name, leave.status].filter(Boolean).join(" · "),
        url: `/leaves?requestId=${leave.id}`
      });
    }
  }

  private async departmentMetadata(companyId: string, ids: string[], map: Map<string, SearchMetadata>) {
    if (!ids.length) return;

    const departments = await this.prisma.department.findMany({
      where: { companyId, id: { in: ids }, deletedAt: null },
      include: {
        manager: { select: { name: true } },
        _count: { select: { users: true, tasks: true, leaveRequests: true } }
      }
    });

    for (const department of departments) {
      map.set(this.key(EntityType.DEPARTMENT, department.id), {
        subtitle: [department.code, department.manager?.name, `${department._count.users} users`, `${department._count.tasks} tasks`].filter(Boolean).join(" · "),
        url: `/employees?departmentId=${department.id}`
      });
    }
  }

  private fallbackMetadata(type: SearchableEntityType, id: string, content: string): SearchMetadata {
    const firstLine = content.split(/\r?\n/).find(Boolean) ?? type;
    const urls: Record<SearchableEntityType, string> = {
      [EntityType.TASK]: `/tasks/list?taskId=${id}`,
      [EntityType.USER]: `/employees?userId=${id}`,
      [EntityType.LEAVE_REQUEST]: `/leaves?requestId=${id}`,
      [EntityType.DEPARTMENT]: `/employees?departmentId=${id}`
    };

    return { subtitle: firstLine, url: urls[type] };
  }

  private highlight(content: string, term: string) {
    const compact = content.replace(/\s+/g, " ").trim();
    const lower = compact.toLowerCase();
    const q = term.toLowerCase();
    const index = lower.indexOf(q);

    if (index < 0) {
      return compact.slice(0, 160);
    }

    const start = Math.max(0, index - 50);
    const end = Math.min(compact.length, index + term.length + 80);
    return `${start > 0 ? "..." : ""}${compact.slice(start, end)}${end < compact.length ? "..." : ""}`;
  }

  private normalize(value: string) {
    return value.toLowerCase().trim();
  }

  private key(type: SearchableEntityType, id: string) {
    return `${type}:${id}`;
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
