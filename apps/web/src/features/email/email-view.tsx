"use client";

import { ArrowLeft, Inbox, Mail, Plus, Send, Star } from "lucide-react";
import { useState } from "react";
import { EMAILS } from "@/features/prototype/data";
import { useUiText } from "@/features/prototype/use-ui-text";

export function EmailView() {
  const { t, lang } = useUiText();
  const [selected, setSelected] = useState<number>(1);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const selectedEmail = EMAILS.find((email) => email.id === selected);

  return (
    <div className="flex h-full">
      <div className="w-80 flex-shrink-0 border-e border-border flex flex-col bg-card overflow-hidden">
        <div className="flex gap-1 p-2 border-b border-border">
          {(["inbox", "sent"] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                tab === tabKey ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tabKey === "inbox" ? <Inbox className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              {tabKey === "inbox" ? t.inbox : t.sent}
              {tabKey === "inbox" && <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">١</span>}
            </button>
          ))}
        </div>

        <div className="p-3 border-b border-border">
          <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            {t.compose}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {EMAILS.map((email) => (
            <div
              key={email.id}
              onClick={() => setSelected(email.id)}
              className={`flex gap-3 p-3.5 cursor-pointer border-b border-border/50 transition-colors ${
                selected === email.id ? "bg-primary/5 border-e-2 border-e-primary" : "hover:bg-muted/40"
              } ${!email.read ? "bg-blue-50/40 dark:bg-blue-900/10" : ""}`}
            >
              <div className={`w-9 h-9 ${email.color} rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5`}>
                {email.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`text-xs ${!email.read ? "font-bold text-foreground" : "font-medium text-foreground"} truncate`}>
                    {lang === "ar" ? email.from : email.fromEn}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{email.time}</span>
                </div>
                <p className={`text-xs truncate mb-0.5 ${!email.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {lang === "ar" ? email.subject : email.subjectEn}
                </p>
                <p className="text-[11px] text-muted-foreground/70 truncate">{email.preview}</p>
              </div>
              {email.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0 mt-1" />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {selectedEmail ? (
          <>
            <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground">{lang === "ar" ? selectedEmail.subject : selectedEmail.subjectEn}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.from}: {lang === "ar" ? selectedEmail.from : selectedEmail.fromEn} · {selectedEmail.fromEmail}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-sm font-medium text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t.reply}
                </button>
                <button className="p-2 rounded-xl hover:bg-muted transition-colors">
                  <Star className={`w-4 h-4 ${selectedEmail.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl" dir={lang === "ar" ? "rtl" : "ltr"}>
                <div className="flex items-center gap-3 mb-5 p-4 bg-card rounded-2xl border border-border">
                  <div className={`w-11 h-11 ${selectedEmail.color} rounded-full flex items-center justify-center text-white font-bold text-lg`}>
                    {selectedEmail.avatar}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground text-sm">{lang === "ar" ? selectedEmail.from : selectedEmail.fromEn}</p>
                    <p className="text-xs text-muted-foreground">{selectedEmail.fromEmail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{selectedEmail.time}</span>
                </div>
                <div className="text-sm text-foreground leading-loose whitespace-pre-line bg-card rounded-2xl border border-border p-6">
                  {lang === "ar" ? selectedEmail.body : selectedEmail.bodyEn}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Mail className="w-14 h-14 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t.noEmailSelected}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
