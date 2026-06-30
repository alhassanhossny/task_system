import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center text-muted-foreground">
      <Loader2 className="me-2 h-4 w-4 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center text-red-500">
      <AlertCircle className="me-2 h-4 w-4" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center text-muted-foreground">
      <Inbox className="mb-2 h-8 w-8 opacity-30" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
