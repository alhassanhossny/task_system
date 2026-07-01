"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileText, Inbox, Mail, Paperclip, Plus, RefreshCw, Search, Send, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-store";
import { useUiText } from "@/features/prototype/use-ui-text";
import { Email, EmailFilters, EmailStatus, EmailTemplate, emailsService } from "./emails-service";

type EmailTab = "inbox" | "sent" | "drafts" | "queued" | "failed" | "templates";

const emailQueryKeys = {
  lists: ["emails"] as const,
  list: (filters: EmailFilters) => [...emailQueryKeys.lists, filters] as const,
  detail: (id: string | null) => ["email", id] as const,
  templates: ["email-templates"] as const,
  users: ["email-users"] as const
};

const statusByTab: Record<Exclude<EmailTab, "inbox" | "templates">, EmailStatus> = {
  sent: "SENT",
  drafts: "DRAFT",
  queued: "QUEUED",
  failed: "FAILED"
};

interface ComposeState {
  id?: string;
  subject: string;
  body: string;
  to: string;
  cc: string;
  bcc: string;
  replyTo: string;
  employeeId: string;
  templateId: string;
  attachmentName: string;
  attachmentPath: string;
  attachmentMime: string;
  attachmentSize: string;
}

const emptyCompose: ComposeState = {
  subject: "",
  body: "",
  to: "",
  cc: "",
  bcc: "",
  replyTo: "",
  employeeId: "",
  templateId: "",
  attachmentName: "",
  attachmentPath: "",
  attachmentMime: "application/pdf",
  attachmentSize: ""
};

export function EmailView() {
  const { lang } = useUiText();
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const context = useMemo(() => (accessToken && user ? { token: accessToken, companyId: user.companyId } : null), [accessToken, user]);
  const [tab, setTab] = useState<EmailTab>("inbox");
  const [search, setSearch] = useState("");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState<ComposeState>(emptyCompose);
  const [templateDraft, setTemplateDraft] = useState({ name: "", subject: "", body: "" });

  useEffect(() => {
    const emailId = searchParams.get("emailId");
    if (emailId) {
      setSelectedEmailId(emailId);
    }
  }, [searchParams]);

  const filters: EmailFilters = useMemo(
    () => ({
      status: tab !== "inbox" && tab !== "templates" ? statusByTab[tab] : undefined,
      search: search || undefined,
      limit: 50
    }),
    [tab, search]
  );

  const emailsQuery = useQuery({
    queryKey: emailQueryKeys.list(filters),
    queryFn: () => emailsService.list(context!, filters),
    enabled: Boolean(context) && tab !== "templates"
  });

  const templatesQuery = useQuery({
    queryKey: emailQueryKeys.templates,
    queryFn: () => emailsService.templates(context!),
    enabled: Boolean(context)
  });

  const usersQuery = useQuery({
    queryKey: emailQueryKeys.users,
    queryFn: () => emailsService.users(context!),
    enabled: Boolean(context)
  });

  const detailQuery = useQuery({
    queryKey: emailQueryKeys.detail(selectedEmailId),
    queryFn: () => emailsService.get(context!, selectedEmailId!),
    enabled: Boolean(context && selectedEmailId)
  });

  const createMutation = useMutation({
    mutationFn: async ({ values, queueAfterSave }: { values: ComposeState; queueAfterSave: boolean }) => {
      const created = await emailsService.create(context!, buildPayload(values));
      return queueAfterSave ? emailsService.queue(context!, created.id) : created;
    },
    onSuccess: (email) => {
      setComposeOpen(false);
      setCompose(emptyCompose);
      setSelectedEmailId(email.id);
      void invalidateEmailQueries();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ values, queueAfterSave }: { values: ComposeState; queueAfterSave: boolean }) => {
      const updated = await emailsService.update(context!, values.id!, buildPayload(values));
      return queueAfterSave ? emailsService.queue(context!, updated.id) : updated;
    },
    onSuccess: (email) => {
      setComposeOpen(false);
      setCompose(emptyCompose);
      setSelectedEmailId(email.id);
      void invalidateEmailQueries(email.id);
    }
  });

  const queueMutation = useMutation({
    mutationFn: (id: string) => emailsService.queue(context!, id),
    onSuccess: (email) => {
      setSelectedEmailId(email.id);
      void invalidateEmailQueries(email.id);
    }
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => emailsService.retry(context!, id),
    onSuccess: (email) => {
      setSelectedEmailId(email.id);
      void invalidateEmailQueries(email.id);
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => emailsService.cancel(context!, id),
    onSuccess: (email) => {
      setSelectedEmailId(email.id);
      void invalidateEmailQueries(email.id);
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => emailsService.remove(context!, id),
    onSuccess: () => {
      setSelectedEmailId(null);
      void invalidateEmailQueries();
    }
  });

  const createTemplateMutation = useMutation({
    mutationFn: () => emailsService.createTemplate(context!, templateDraft),
    onSuccess: () => {
      setTemplateDraft({ name: "", subject: "", body: "" });
      void queryClient.invalidateQueries({ queryKey: emailQueryKeys.templates });
    }
  });

  const removeTemplateMutation = useMutation({
    mutationFn: (id: string) => emailsService.removeTemplate(context!, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: emailQueryKeys.templates })
  });

  const emails = emailsQuery.data?.items ?? [];
  const selectedEmail = detailQuery.data ?? emails.find((email) => email.id === selectedEmailId) ?? null;
  const labels = copy(lang);

  function invalidateEmailQueries(id?: string) {
    void queryClient.invalidateQueries({ queryKey: emailQueryKeys.lists });
    void queryClient.invalidateQueries({ queryKey: emailQueryKeys.templates });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: emailQueryKeys.detail(id) });
    }
  }

  function openCompose(email?: Email) {
    if (email) {
      setCompose({
        ...emptyCompose,
        id: email.id,
        subject: email.subject,
        body: email.body,
        to: recipientsByKind(email, "TO"),
        cc: recipientsByKind(email, "CC"),
        bcc: recipientsByKind(email, "BCC"),
        replyTo: email.replyTo ?? "",
        templateId: email.template?.id ?? ""
      });
    } else {
      setCompose(emptyCompose);
    }
    setComposeOpen(true);
  }

  function applyTemplate(templateId: string) {
    const template = templatesQuery.data?.find((item) => item.id === templateId);
    setCompose((current) => ({
      ...current,
      templateId,
      subject: template?.subject ?? current.subject,
      body: template?.body ?? current.body
    }));
  }

  function submitCompose(queueAfterSave: boolean) {
    if (compose.id) {
      updateMutation.mutate({ values: compose, queueAfterSave });
      return;
    }
    createMutation.mutate({ values: compose, queueAfterSave });
  }

  if (!context) {
    return <ErrorState label={labels.signIn} />;
  }

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-background">
      <aside className="w-full lg:w-96 border-b lg:border-b-0 lg:border-e border-border bg-card flex flex-col min-h-0">
        <div className="p-3 border-b border-border space-y-3">
          <div className="grid grid-cols-3 gap-1">
            {(["inbox", "sent", "drafts", "queued", "failed", "templates"] as EmailTab[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setTab(key);
                  setSelectedEmailId(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  tab === key ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {tabIcon(key)}
                {labels.tabs[key]}
              </button>
            ))}
          </div>

          <button
            onClick={() => openCompose()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {labels.compose}
          </button>

          {tab !== "templates" && (
            <label className="relative block">
              <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={labels.search}
                className="w-full rounded-lg border border-border bg-background ps-9 pe-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === "templates" ? (
            <TemplatesPanel
              labels={labels}
              templates={templatesQuery.data ?? []}
              loading={templatesQuery.isLoading}
              error={templatesQuery.isError}
              draft={templateDraft}
              setDraft={setTemplateDraft}
              createPending={createTemplateMutation.isPending}
              onCreate={() => createTemplateMutation.mutate()}
              onDelete={(id) => removeTemplateMutation.mutate(id)}
            />
          ) : (
            <>
              {emailsQuery.isLoading && <LoadingState label={labels.loading} />}
              {emailsQuery.isError && <ErrorState label={labels.error} />}
              {!emailsQuery.isLoading && !emailsQuery.isError && !emails.length && <EmptyState label={labels.empty} />}
              {emails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => setSelectedEmailId(email.id)}
                  className={`w-full text-start flex gap-3 p-3.5 border-b border-border/60 transition-colors ${
                    selectedEmailId === email.id ? "bg-primary/5 border-e-2 border-e-primary" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{email.subject}</span>
                      <StatusBadge status={email.status} labels={labels} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{recipientPreview(email) || labels.noRecipients}</p>
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                      <span>{formatDate(email.sentAt ?? email.queuedAt ?? email.createdAt, lang)}</span>
                      {!!email._count?.attachments && (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          {email._count.attachments}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {tab === "templates" ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{labels.templateHint}</div>
        ) : selectedEmail ? (
          <EmailDetail
            email={selectedEmail}
            labels={labels}
            lang={lang}
            loading={detailQuery.isLoading}
            onEdit={() => openCompose(selectedEmail)}
            onQueue={() => queueMutation.mutate(selectedEmail.id)}
            onRetry={() => retryMutation.mutate(selectedEmail.id)}
            onCancel={() => cancelMutation.mutate(selectedEmail.id)}
            onDelete={() => removeMutation.mutate(selectedEmail.id)}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Mail className="w-14 h-14 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{labels.noEmailSelected}</p>
            </div>
          </div>
        )}
      </main>

      {composeOpen && (
        <ComposeModal
          labels={labels}
          compose={compose}
          templates={templatesQuery.data ?? []}
          users={usersQuery.data ?? []}
          pending={createMutation.isPending || updateMutation.isPending}
          onChange={setCompose}
          onClose={() => setComposeOpen(false)}
          onTemplate={applyTemplate}
          onSave={() => submitCompose(false)}
          onQueue={() => submitCompose(true)}
        />
      )}
    </div>
  );
}

function EmailDetail({
  email,
  labels,
  lang,
  loading,
  onEdit,
  onQueue,
  onRetry,
  onCancel,
  onDelete
}: {
  email: Email;
  labels: ReturnType<typeof copy>;
  lang: string;
  loading: boolean;
  onEdit: () => void;
  onQueue: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="px-4 md:px-6 py-4 border-b border-border bg-card flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={email.status} labels={labels} />
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>
          <h2 className="text-base font-semibold text-foreground truncate">{email.subject}</h2>
          <p className="text-xs text-muted-foreground mt-1">{recipientPreview(email)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(email.status === "DRAFT" || email.status === "FAILED") && (
            <button onClick={onEdit} className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium text-foreground transition-colors">
              {labels.edit}
            </button>
          )}
          {email.status === "DRAFT" && (
            <button onClick={onQueue} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Send className="w-4 h-4" />
              {labels.queue}
            </button>
          )}
          {email.status === "FAILED" && (
            <button onClick={onRetry} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
              <RefreshCw className="w-4 h-4" />
              {labels.retry}
            </button>
          )}
          {(email.status === "DRAFT" || email.status === "QUEUED") && (
            <button onClick={onCancel} className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium text-foreground transition-colors">
              {labels.cancel}
            </button>
          )}
          {email.status !== "QUEUED" && email.status !== "SENDING" && (
            <button onClick={onDelete} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/15 transition-colors">
              <Trash2 className="w-4 h-4" />
              {labels.delete}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {email.failureReason && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{email.failureReason}</span>
          </div>
        )}

        <div className="max-w-3xl space-y-4" dir={lang === "ar" ? "rtl" : "ltr"}>
          <section className="rounded-lg border border-border bg-card p-4">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{labels.from}</dt>
                <dd className="font-medium text-foreground">{email.createdBy?.name ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{labels.date}</dt>
                <dd className="font-medium text-foreground">{formatDate(email.sentAt ?? email.queuedAt ?? email.createdAt, lang)}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-xs text-muted-foreground">{labels.recipients}</dt>
                <dd className="font-medium text-foreground break-words">{recipientPreview(email)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <div className="text-sm text-foreground leading-7 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: email.body }} />
          </section>

          {!!email.attachments?.length && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">{labels.attachments}</h3>
              <div className="space-y-2">
                {email.attachments.map((link) => (
                  <div key={link.id} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-foreground truncate">{link.attachment.fileName}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(link.attachment.fileSize)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ComposeModal({
  labels,
  compose,
  templates,
  users,
  pending,
  onChange,
  onClose,
  onTemplate,
  onSave,
  onQueue
}: {
  labels: ReturnType<typeof copy>;
  compose: ComposeState;
  templates: EmailTemplate[];
  users: Array<{ id: string; name: string; email: string }>;
  pending: boolean;
  onChange: (value: ComposeState) => void;
  onClose: () => void;
  onTemplate: (templateId: string) => void;
  onSave: () => void;
  onQueue: () => void;
}) {
  const set = (patch: Partial<ComposeState>) => onChange({ ...compose, ...patch });

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="w-full md:max-w-3xl max-h-[92vh] overflow-hidden rounded-t-lg md:rounded-lg bg-card border border-border shadow-2xl flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{compose.id ? labels.editEmail : labels.compose}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={compose.templateId}
              onChange={(event) => onTemplate(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{labels.template}</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <select
              value={compose.employeeId}
              onChange={(event) => {
                const employee = users.find((item) => item.id === event.target.value);
                set({
                  employeeId: event.target.value,
                  to: employee ? mergeAddress(compose.to, employee.email) : compose.to
                });
              }}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{labels.employeeRecipient}</option>
              {users.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} - {employee.email}
                </option>
              ))}
            </select>
          </div>

          <input
            value={compose.to}
            onChange={(event) => set({ to: event.target.value })}
            placeholder={labels.to}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={compose.cc}
              onChange={(event) => set({ cc: event.target.value })}
              placeholder={labels.cc}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              value={compose.bcc}
              onChange={(event) => set({ bcc: event.target.value })}
              placeholder={labels.bcc}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <input
            value={compose.replyTo}
            onChange={(event) => set({ replyTo: event.target.value })}
            placeholder={labels.replyTo}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            value={compose.subject}
            onChange={(event) => set({ subject: event.target.value })}
            placeholder={labels.subject}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <textarea
            value={compose.body}
            onChange={(event) => set({ body: event.target.value })}
            placeholder={labels.body}
            rows={10}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-y"
          />

          <div className="rounded-lg border border-border bg-background p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Paperclip className="w-4 h-4" />
              {labels.attachmentMetadata}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input value={compose.attachmentName} onChange={(event) => set({ attachmentName: event.target.value })} placeholder={labels.fileName} className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none" />
              <input value={compose.attachmentPath} onChange={(event) => set({ attachmentPath: event.target.value })} placeholder={labels.filePath} className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none md:col-span-2" />
              <input value={compose.attachmentSize} onChange={(event) => set({ attachmentSize: event.target.value })} placeholder={labels.fileSize} className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none" />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onSave} disabled={pending} className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-semibold text-foreground disabled:opacity-60">
            {labels.saveDraft}
          </button>
          <button onClick={onQueue} disabled={pending} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
            <Send className="w-4 h-4" />
            {labels.queue}
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplatesPanel({
  labels,
  templates,
  loading,
  error,
  draft,
  setDraft,
  createPending,
  onCreate,
  onDelete
}: {
  labels: ReturnType<typeof copy>;
  templates: EmailTemplate[];
  loading: boolean;
  error: boolean;
  draft: { name: string; subject: string; body: string };
  setDraft: (draft: { name: string; subject: string; body: string }) => void;
  createPending: boolean;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  if (loading) return <LoadingState label={labels.loading} />;
  if (error) return <ErrorState label={labels.error} />;

  return (
    <div className="p-3 space-y-3">
      <div className="rounded-lg border border-border bg-background p-3 space-y-2">
        <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={labels.templateName} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none" />
        <input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} placeholder={labels.subject} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none" />
        <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder={labels.body} rows={4} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none resize-y" />
        <button onClick={onCreate} disabled={createPending || !draft.name || !draft.subject || !draft.body} className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold disabled:opacity-60">
          {labels.addTemplate}
        </button>
      </div>

      {templates.map((template) => (
        <div key={template.id} className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{template.name}</p>
              <p className="text-xs text-muted-foreground truncate mt-1">{template.subject}</p>
            </div>
            {!template.isSystem && (
              <button onClick={() => onDelete(template.id)} className="w-8 h-8 rounded-lg hover:bg-muted text-muted-foreground flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{template.body}</p>
        </div>
      ))}
    </div>
  );
}

function buildPayload(values: ComposeState) {
  const recipients = [
    ...parseAddresses(values.to).map((email) => ({ recipientKind: "TO" as const, email })),
    ...parseAddresses(values.cc).map((email) => ({ recipientKind: "CC" as const, email })),
    ...parseAddresses(values.bcc).map((email) => ({ recipientKind: "BCC" as const, email }))
  ];

  const attachments =
    values.attachmentName && values.attachmentPath
      ? [
          {
            fileName: values.attachmentName,
            filePath: values.attachmentPath,
            mimeType: values.attachmentMime || "application/octet-stream",
            fileSize: Number(values.attachmentSize || 1)
          }
        ]
      : undefined;

  return {
    subject: values.subject,
    body: values.body,
    templateId: values.templateId || undefined,
    replyTo: values.replyTo || undefined,
    recipients,
    attachments
  };
}

function parseAddresses(value: string) {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeAddress(current: string, email: string) {
  const addresses = new Set(parseAddresses(current));
  addresses.add(email);
  return [...addresses].join(", ");
}

function recipientsByKind(email: Email, kind: "TO" | "CC" | "BCC") {
  return email.recipients
    .filter((recipient) => recipient.recipientKind === kind)
    .map((recipient) => recipient.email)
    .join(", ");
}

function recipientPreview(email: Email) {
  return email.recipients.map((recipient) => `${recipient.recipientKind}: ${recipient.name ?? recipient.email}`).join(" · ");
}

function StatusBadge({ status, labels }: { status: EmailStatus; labels: ReturnType<typeof copy> }) {
  const tone: Record<EmailStatus, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    QUEUED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    SENDING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    SENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    FAILED: "bg-destructive/10 text-destructive",
    CANCELLED: "bg-muted text-muted-foreground"
  };

  return <span className={`px-2 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${tone[status]}`}>{labels.statuses[status]}</span>;
}

function tabIcon(tab: EmailTab) {
  const className = "w-3.5 h-3.5";
  if (tab === "inbox") return <Inbox className={className} />;
  if (tab === "sent") return <Send className={className} />;
  if (tab === "failed") return <AlertCircle className={className} />;
  if (tab === "templates") return <FileText className={className} />;
  return <Mail className={className} />;
}

function formatDate(value: string | null | undefined, lang: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function copy(lang: string) {
  const ar = lang === "ar";
  return {
    signIn: ar ? "سجّل الدخول لعرض البريد" : "Sign in to view emails",
    tabs: {
      inbox: ar ? "الوارد" : "Inbox",
      sent: ar ? "المرسل" : "Sent",
      drafts: ar ? "المسودات" : "Drafts",
      queued: ar ? "المجدول" : "Queued",
      failed: ar ? "الفاشل" : "Failed",
      templates: ar ? "القوالب" : "Templates"
    },
    statuses: {
      DRAFT: ar ? "مسودة" : "Draft",
      QUEUED: ar ? "في الانتظار" : "Queued",
      SENDING: ar ? "جار الإرسال" : "Sending",
      SENT: ar ? "مرسل" : "Sent",
      FAILED: ar ? "فشل" : "Failed",
      CANCELLED: ar ? "ملغي" : "Cancelled"
    } as Record<EmailStatus, string>,
    compose: ar ? "إنشاء بريد" : "Compose",
    editEmail: ar ? "تعديل البريد" : "Edit email",
    search: ar ? "ابحث في البريد..." : "Search emails...",
    empty: ar ? "لا توجد رسائل بريد" : "No emails found",
    error: ar ? "تعذر تحميل البريد" : "Could not load emails",
    loading: ar ? "جار التحميل..." : "Loading...",
    noEmailSelected: ar ? "اختر رسالة لعرض التفاصيل" : "Select an email to view details",
    noRecipients: ar ? "بدون مستلمين" : "No recipients",
    from: ar ? "المرسل" : "From",
    date: ar ? "التاريخ" : "Date",
    recipients: ar ? "المستلمون" : "Recipients",
    attachments: ar ? "المرفقات" : "Attachments",
    edit: ar ? "تعديل" : "Edit",
    queue: ar ? "إرسال" : "Queue send",
    retry: ar ? "إعادة المحاولة" : "Retry",
    cancel: ar ? "إلغاء" : "Cancel",
    delete: ar ? "حذف" : "Delete",
    template: ar ? "اختر قالبًا" : "Select template",
    employeeRecipient: ar ? "إضافة موظف" : "Add employee",
    to: ar ? "إلى" : "To",
    cc: ar ? "نسخة" : "CC",
    bcc: ar ? "نسخة مخفية" : "BCC",
    replyTo: ar ? "البريد للرد" : "Reply-To",
    subject: ar ? "الموضوع" : "Subject",
    body: ar ? "المحتوى" : "Body",
    attachmentMetadata: ar ? "بيانات المرفق" : "Attachment metadata",
    fileName: ar ? "اسم الملف" : "File name",
    filePath: ar ? "مسار الملف" : "File path",
    fileSize: ar ? "الحجم بالبايت" : "Size bytes",
    saveDraft: ar ? "حفظ كمسودة" : "Save draft",
    templateHint: ar ? "أنشئ القوالب واستخدمها من نافذة إنشاء البريد" : "Create templates and use them from the compose window",
    templateName: ar ? "اسم القالب" : "Template name",
    addTemplate: ar ? "إضافة قالب" : "Add template"
  };
}
