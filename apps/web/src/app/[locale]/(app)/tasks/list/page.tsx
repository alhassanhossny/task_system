import { Suspense } from "react";
import { LoadingState } from "@/components/states";
import { TasksListView } from "@/features/tasks/tasks-list-view";

export default function TasksListPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading..." />}>
      <TasksListView />
    </Suspense>
  );
}
