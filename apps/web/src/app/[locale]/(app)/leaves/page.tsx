import { Suspense } from "react";
import { LoadingState } from "@/components/states";
import { LeavesView } from "@/features/leaves/leaves-view";

export default function LeavesPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading..." />}>
      <LeavesView />
    </Suspense>
  );
}
