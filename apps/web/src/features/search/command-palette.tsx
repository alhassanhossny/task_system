"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarDays, Clock, FileText, Filter, Loader2, Search, User, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/features/auth/auth-store";
import type { Lang, UiText } from "@/features/prototype/types";
import { searchService, type SavedFilter, type SearchEntityType, type SearchResult } from "./search-service";

const SEARCH_TYPES: SearchEntityType[] = ["ALL", "TASK", "USER", "LEAVE_REQUEST", "DEPARTMENT"];

export function CommandPalette({ open, onOpen, onClose, lang, t }: { open: boolean; onOpen: () => void; onClose: () => void; lang: Lang; t: UiText }) {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [type, setType] = useState<SearchEntityType>("ALL");
  const [activeIndex, setActiveIndex] = useState(0);
  const context = useMemo(() => (accessToken && user ? { token: accessToken, companyId: user.companyId } : null), [accessToken, user]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!open) {
          onOpen();
        }
      }

      if (event.key === "Escape" && open) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onOpen, open]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 180);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery, type, open]);

  const searchQuery = useQuery({
    queryKey: ["global-search", debouncedQuery, type],
    queryFn: () => searchService.search(context!, { q: debouncedQuery, type, limit: 12 }),
    enabled: Boolean(open && context && debouncedQuery)
  });
  const recentQuery = useQuery({
    queryKey: ["global-search", "recent"],
    queryFn: () => searchService.recent(context!),
    enabled: Boolean(open && context)
  });
  const savedFiltersQuery = useQuery({
    queryKey: ["global-search", "saved-filters"],
    queryFn: () => searchService.savedFilters(context!),
    enabled: Boolean(open && context)
  });

  const results = searchQuery.data?.results ?? [];
  const groupedResults = groupResults(results);
  const savedFilters = savedFiltersQuery.data ?? [];
  const presets = useMemo(() => buildPresets(lang, user?.id), [lang, user?.id]);
  const selectableItems = [
    ...results.map((result) => ({ kind: "result" as const, id: `${result.type}:${result.id}`, result })),
    ...(!debouncedQuery ? presets.map((preset) => ({ kind: "preset" as const, id: `preset:${preset.id}`, preset })) : []),
    ...(!debouncedQuery ? savedFilters.map((filter) => ({ kind: "filter" as const, id: `filter:${filter.id}`, filter })) : []),
    ...(!debouncedQuery ? (recentQuery.data ?? []).map((recent) => ({ kind: "recent" as const, id: `recent:${recent.id}`, query: recent.query })) : [])
  ];

  function closeAndReset() {
    onClose();
    setQuery("");
    setDebouncedQuery("");
    setType("ALL");
  }

  function openUrl(url: string) {
    closeAndReset();
    router.push(`/${lang}${url}`);
  }

  function openSavedFilter(filter: SavedFilter) {
    const path = filterPath(filter);
    openUrl(path);
  }

  function chooseActive() {
    const item = selectableItems[activeIndex];
    if (!item) return;

    if (item.kind === "result") {
      openUrl(item.result.url);
      return;
    }

    if (item.kind === "filter") {
      openSavedFilter(item.filter);
      return;
    }

    if (item.kind === "preset") {
      openUrl(item.preset.url);
      return;
    }

    setQuery(item.query);
  }

  function onPanelKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!selectableItems.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % selectableItems.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + selectableItems.length) % selectableItems.length);
    }

    if (event.key === "Enter") {
      event.preventDefault();
      chooseActive();
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm p-3 sm:p-6" onClick={closeAndReset}>
      <div
        role="dialog"
        aria-modal="true"
        className="mx-auto mt-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onPanelKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.globalSearch}
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          {searchQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button onClick={closeAndReset} className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={lang === "ar" ? "إغلاق" : "Close"}>
            <X className="mx-auto h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
          {SEARCH_TYPES.map((option) => (
            <button
              key={option}
              onClick={() => setType(option)}
              className={`h-8 rounded-full px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                type === option ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {typeLabel(lang, option)}
            </button>
          ))}
        </div>

        <div className="max-h-[min(68vh,620px)] overflow-y-auto p-3">
          {debouncedQuery && searchQuery.isLoading && <SearchMessage label={lang === "ar" ? "جاري البحث..." : "Searching..."} />}
          {debouncedQuery && searchQuery.isError && <SearchMessage label={lang === "ar" ? "تعذر تحميل النتائج" : "Could not load results"} />}
          {debouncedQuery && !searchQuery.isLoading && !searchQuery.isError && !results.length && <SearchMessage label={lang === "ar" ? "لا توجد نتائج" : "No results"} />}

          {debouncedQuery && !!results.length && (
            <div className="space-y-4">
              {[...groupedResults.entries()].map(([groupType, groupItems]) => (
                <SearchGroup key={groupType} title={typeLabel(lang, groupType)}>
                  {groupItems.map((result) => (
                    <ResultRow
                      key={`${result.type}:${result.id}`}
                      result={result}
                      lang={lang}
                      active={selectableItems[activeIndex]?.id === `${result.type}:${result.id}`}
                      onSelect={() => openUrl(result.url)}
                    />
                  ))}
                </SearchGroup>
              ))}
            </div>
          )}

          {!debouncedQuery && (
            <div className="space-y-4">
              <SearchGroup title={lang === "ar" ? "اختصارات العمل" : "Presets"}>
                {presets.map((preset) => {
                  const Icon = preset.type === "TASK" ? FileText : CalendarDays;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => openUrl(preset.url)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors ${
                        selectableItems[activeIndex]?.id === `preset:${preset.id}` ? "bg-primary/10" : "hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground truncate">{preset.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{preset.subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </SearchGroup>

              <SearchGroup title={lang === "ar" ? "الفلاتر المحفوظة" : "Saved Filters"}>
                {!savedFilters.length && <SearchMessage label={lang === "ar" ? "لا توجد فلاتر محفوظة" : "No saved filters"} compact />}
                {savedFilters.slice(0, 8).map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => openSavedFilter(filter)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors ${
                      selectableItems[activeIndex]?.id === `filter:${filter.id}` ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                  >
                    <Filter className="h-4 w-4 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground truncate">{filter.name}</div>
                      <div className="text-xs text-muted-foreground">{typeLabel(lang, filter.entityType)}</div>
                    </div>
                  </button>
                ))}
              </SearchGroup>

              <SearchGroup title={lang === "ar" ? "عمليات البحث الأخيرة" : "Recent Searches"}>
                {!(recentQuery.data ?? []).length && <SearchMessage label={lang === "ar" ? "لا توجد عمليات بحث حديثة" : "No recent searches"} compact />}
                {(recentQuery.data ?? []).slice(0, 8).map((recent) => (
                  <button
                    key={recent.id}
                    onClick={() => setQuery(recent.query)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors ${
                      selectableItems[activeIndex]?.id === `recent:${recent.id}` ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{recent.query}</span>
                  </button>
                ))}
              </SearchGroup>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="px-2 pb-2 text-xs font-bold uppercase text-muted-foreground">{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function ResultRow({ result, lang, active, onSelect }: { result: SearchResult; lang: Lang; active: boolean; onSelect: () => void }) {
  const Icon = iconFor(result.type);

  return (
    <button onClick={onSelect} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors ${active ? "bg-primary/10" : "hover:bg-muted"}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{result.title}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{typeLabel(lang, result.type)}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{result.subtitle || result.highlight}</p>
      </div>
    </button>
  );
}

function SearchMessage({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`text-center text-sm text-muted-foreground ${compact ? "py-3" : "py-10"}`}>{label}</div>;
}

function groupResults(results: SearchResult[]) {
  const groups = new Map<Exclude<SearchEntityType, "ALL">, SearchResult[]>();

  for (const result of results) {
    groups.set(result.type, [...(groups.get(result.type) ?? []), result]);
  }

  return groups;
}

function iconFor(type: Exclude<SearchEntityType, "ALL">) {
  const icons = {
    TASK: FileText,
    USER: User,
    LEAVE_REQUEST: CalendarDays,
    DEPARTMENT: Building2
  };

  return icons[type];
}

function typeLabel(lang: Lang, type: SearchEntityType) {
  const labels: Record<SearchEntityType, [string, string]> = {
    ALL: ["الكل", "All"],
    TASK: ["المهام", "Tasks"],
    USER: ["الموظفون", "Employees"],
    LEAVE_REQUEST: ["الإجازات", "Leave Requests"],
    DEPARTMENT: ["الأقسام", "Departments"]
  };

  return lang === "ar" ? labels[type][0] : labels[type][1];
}

function filterPath(filter: SavedFilter) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter.filterJson)) {
    if (value) {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : "";

  if (filter.entityType === "TASK") return `/tasks/list${suffix}`;
  if (filter.entityType === "LEAVE_REQUEST") return `/leaves${suffix}`;
  if (filter.entityType === "USER") return `/employees${suffix}`;
  if (filter.entityType === "DEPARTMENT") return `/employees${suffix}`;
  return `/dashboard${suffix}`;
}

function buildPresets(lang: Lang, userId?: string) {
  const me = userId ?? "";
  const today = new Date().toISOString().slice(0, 10);

  return [
    {
      id: "my-open-tasks",
      type: "TASK" as const,
      name: lang === "ar" ? "مهامي المفتوحة" : "My Open Tasks",
      subtitle: lang === "ar" ? "المهام المسندة لي" : "Tasks assigned to me",
      url: `/tasks/list?assignedToId=${encodeURIComponent(me)}`
    },
    {
      id: "assigned-to-me",
      type: "TASK" as const,
      name: lang === "ar" ? "مسندة لي" : "Assigned To Me",
      subtitle: lang === "ar" ? "كل المهام الخاصة بي" : "All of my assigned tasks",
      url: `/tasks/list?assignedToId=${encodeURIComponent(me)}`
    },
    {
      id: "overdue-tasks",
      type: "TASK" as const,
      name: lang === "ar" ? "المهام المتأخرة" : "Overdue Tasks",
      subtitle: lang === "ar" ? "تاريخ الاستحقاق قبل اليوم" : "Due before today",
      url: `/tasks/list?dueTo=${today}`
    },
    {
      id: "completed-tasks",
      type: "TASK" as const,
      name: lang === "ar" ? "المهام المكتملة" : "Completed Tasks",
      subtitle: lang === "ar" ? "مهام منتهية" : "Finished work",
      url: "/tasks/list?status=COMPLETED"
    },
    {
      id: "my-leave-requests",
      type: "LEAVE_REQUEST" as const,
      name: lang === "ar" ? "طلباتي" : "My Requests",
      subtitle: lang === "ar" ? "طلبات الإجازة الخاصة بي" : "My time-off requests",
      url: `/leaves?employeeId=${encodeURIComponent(me)}`
    },
    {
      id: "pending-approvals",
      type: "LEAVE_REQUEST" as const,
      name: lang === "ar" ? "موافقات معلقة" : "Pending Approvals",
      subtitle: lang === "ar" ? "طلبات تحتاج إجراء" : "Requests awaiting action",
      url: "/leaves?status=PENDING"
    },
    {
      id: "approved-requests",
      type: "LEAVE_REQUEST" as const,
      name: lang === "ar" ? "طلبات معتمدة" : "Approved Requests",
      subtitle: lang === "ar" ? "إجازات تمت الموافقة عليها" : "Approved time off",
      url: "/leaves?status=APPROVED"
    },
    {
      id: "rejected-requests",
      type: "LEAVE_REQUEST" as const,
      name: lang === "ar" ? "طلبات مرفوضة" : "Rejected Requests",
      subtitle: lang === "ar" ? "طلبات لم تتم الموافقة عليها" : "Rejected time off",
      url: "/leaves?status=REJECTED"
    },
    {
      id: "team-requests",
      type: "LEAVE_REQUEST" as const,
      name: lang === "ar" ? "طلبات الفريق" : "Team Requests",
      subtitle: lang === "ar" ? "إجازات الأعضاء المباشرين" : "Direct-report leave requests",
      url: "/team"
    }
  ];
}
