import { useState, useCallback } from "react";
import { eventBus } from "../utils/EventBus";

export interface TaskItem {
  id: string;
  status: string;
  isCompleted?: boolean;
  [key: string]: any;
}

export function useOptimisticTask<T extends TaskItem>(initialTasks: T[]) {
  const [tasks, setTasks] = useState<T[]>(initialTasks);

  const updateTaskOptimistically = useCallback(
    async (
      taskId: string,
      newStatus: string,
      mutationFn?: (taskId: string, newStatus: string) => Promise<any>
    ) => {
      let previousState: T[] = [];

      // 1. Instantly update local state & emit event bus notification (0ms response)
      setTasks((prev) => {
        previousState = prev;
        return prev.map((task) => {
          if (task.id === taskId) {
            return {
              ...task,
              status: newStatus,
              isCompleted: newStatus.toLowerCase() === "completed",
            };
          }
          return task;
        });
      });

      eventBus.emit("TASK_UPDATED", { taskId, status: newStatus });
      eventBus.emit("PROGRESS_NEEDS_RECALCULATION");

      // 2. Perform async API call if mutation function provided
      if (mutationFn) {
        try {
          await mutationFn(taskId, newStatus);
        } catch (error) {
          console.error(`[OptimisticTask] Mutation failed for task ${taskId}:`, error);
          // Rollback to previous state on failure
          setTasks(previousState);
          eventBus.emit("TASK_UPDATE_FAILED", { taskId, error });
          eventBus.emit("PROGRESS_NEEDS_RECALCULATION");
        }
      }
    },
    []
  );

  return {
    tasks,
    setTasks,
    updateTaskOptimistically,
  };
}
