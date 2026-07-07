import { Suspense } from "react";
import { LoadingState } from "@/components/states";
import { EmailView } from "@/features/email/email-view";

export default function EmailPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading..." />}>
      <EmailView />
    </Suspense>
  );
}
