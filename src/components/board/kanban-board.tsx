"use client";

import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { SortableTaskCard, TaskCardContent, taskCardClass } from "@/components/board/task-card";
import { STATUS_DOT } from "@/components/shared/badges";
import { STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { groupByStatus } from "@/lib/task-filters";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types";

type ColumnIds = Record<TaskStatus, string[]>;

interface DragState {
  activeId: string;
  /** Working copy of the column order while a card is being dragged. */
  columns: ColumnIds;
}

function isStatus(id: string): id is TaskStatus {
  return (TASK_STATUSES as string[]).includes(id);
}

function findColumn(columns: ColumnIds, id: string): TaskStatus | undefined {
  if (isStatus(id)) return id;
  return TASK_STATUSES.find((status) => columns[status].includes(id));
}

interface KanbanBoardProps {
  /** Tasks to show (already filtered by team and toolbar filters). */
  tasks: Task[];
  canMoveTask: (task: Task) => boolean;
  onOpenTask: (taskId: string) => void;
  /** `order` is the new sort position within the target column. */
  onMoveTask: (taskId: string, status: TaskStatus, order: number) => void;
  /** When provided, each column shows an "add task" button (admins). */
  onAddTask?: (status: TaskStatus) => void;
}

export function KanbanBoard({
  tasks,
  canMoveTask,
  onOpenTask,
  onMoveTask,
  onAddTask,
}: KanbanBoardProps) {
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const baseColumns = useMemo(() => groupByStatus(tasks), [tasks]);

  const [drag, setDragState] = useState<DragState | null>(null);
  // Mirror of `drag` for event handlers, which can fire between renders.
  const dragRef = useRef<DragState | null>(null);
  const setDrag = useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDragState(next);
  }, []);

  const columns = useMemo<Record<TaskStatus, Task[]>>(() => {
    if (!drag) return baseColumns;
    const resolve = (ids: string[]) =>
      ids.map((id) => taskById.get(id)).filter((task): task is Task => Boolean(task));
    return {
      todo: resolve(drag.columns.todo),
      in_progress: resolve(drag.columns.in_progress),
      in_review: resolve(drag.columns.in_review),
      done: resolve(drag.columns.done),
    };
  }, [drag, baseColumns, taskById]);

  const sensors = useSensors(
    // A small movement threshold keeps plain clicks opening the task.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press-and-hold on touch screens so the board can still be scrolled.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter is reserved for opening the task, so Space picks up and drops.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  /**
   * Prefer the card under the pointer. If the pointer is over a column but not
   * a card (a gap, or the space below the list), snap to the nearest card in
   * that column. Keyboard dragging has no pointer and falls back to corners.
   */
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length === 0) return closestCorners(args);

    const cardHits = pointerHits.filter((hit) => !isStatus(String(hit.id)));
    if (cardHits.length > 0) return cardHits;

    const columnId = String(pointerHits[0].id);
    const current = dragRef.current;
    if (!current || !isStatus(columnId)) return pointerHits;

    const cardsInColumn = args.droppableContainers.filter((container) =>
      current.columns[columnId].includes(String(container.id)),
    );
    if (cardsInColumn.length === 0) return pointerHits;
    return closestCenter({ ...args, droppableContainers: cardsInColumn });
  }, []);

  function handleDragStart({ active }: DragStartEvent) {
    setDrag({
      activeId: String(active.id),
      columns: {
        todo: baseColumns.todo.map((task) => task.id),
        in_progress: baseColumns.in_progress.map((task) => task.id),
        in_review: baseColumns.in_review.map((task) => task.id),
        done: baseColumns.done.map((task) => task.id),
      },
    });
  }

  /** Moves the card into another column's working list as it is dragged over. */
  function handleDragOver({ active, over }: DragOverEvent) {
    const current = dragRef.current;
    if (!current || !over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const from = findColumn(current.columns, activeId);
    const to = findColumn(current.columns, overId);
    if (!from || !to || from === to) return;

    const target = current.columns[to];
    let index = target.length;
    if (!isStatus(overId)) {
      const overIndex = target.indexOf(overId);
      const translated = active.rect.current.translated;
      const isBelow = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
      index = overIndex + (isBelow ? 1 : 0);
    }

    setDrag({
      activeId,
      columns: {
        ...current.columns,
        [from]: current.columns[from].filter((id) => id !== activeId),
        [to]: [...target.slice(0, index), activeId, ...target.slice(index)],
      },
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const current = dragRef.current;
    setDrag(null);
    if (!current || !over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const task = taskById.get(activeId);
    const status = findColumn(current.columns, activeId);
    if (!task || !status) return;

    let list = current.columns[status];
    if (!isStatus(overId) && findColumn(current.columns, overId) === status) {
      const oldIndex = list.indexOf(activeId);
      const newIndex = list.indexOf(overId);
      if (oldIndex !== newIndex) list = arrayMove(list, oldIndex, newIndex);
    }

    const unchanged =
      task.status === status &&
      list.length === baseColumns[status].length &&
      list.every((id, i) => baseColumns[status][i]?.id === id);
    if (unchanged) return;

    // Place the card between its new neighbours without renumbering the column.
    const index = list.indexOf(activeId);
    const previous = taskById.get(list[index - 1]);
    const next = taskById.get(list[index + 1]);
    const order =
      previous && next
        ? (previous.order + next.order) / 2
        : previous
          ? previous.order + 1
          : next
            ? next.order - 1
            : 0;

    onMoveTask(activeId, status, order);
  }

  const activeTask = drag ? taskById.get(drag.activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDrag(null)}
    >
      <div className="flex h-full min-w-max gap-3 lg:min-w-0">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={columns[status]}
            canMoveTask={canMoveTask}
            onOpenTask={onOpenTask}
            onAddTask={onAddTask}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: "ease-out" }}>
        {activeTask && (
          <div className={cn(taskCardClass, "cursor-grabbing shadow-lg ring-1 ring-brand-navy/15")}>
            <TaskCardContent task={activeTask} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  canMoveTask: (task: Task) => boolean;
  onOpenTask: (taskId: string) => void;
  onAddTask?: (status: TaskStatus) => void;
}

function KanbanColumn({ status, tasks, canMoveTask, onOpenTask, onAddTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const ids = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const label = STATUS_LABELS[status];

  return (
    <section
      aria-label={`${label}, ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
      className={cn(
        "relative flex max-h-full w-[280px] shrink-0 flex-col rounded-xl bg-[#e9edf0] transition-shadow lg:w-auto lg:min-w-[240px] lg:flex-1",
        isOver && "ring-2 ring-brand-slate/40",
      )}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 px-3">
        <span className={cn("size-2 rounded-full", STATUS_DOT[status])} aria-hidden />
        <h2 className="text-[13px] font-semibold text-foreground">{label}</h2>
        <span className="rounded-md bg-white/70 px-1.5 text-[11px] font-medium text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
        {onAddTask && (
          <button
            type="button"
            onClick={() => onAddTask(status)}
            aria-label={`Add task to ${label}`}
            title={`Add task to ${label}`}
            className="ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        )}
      </header>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              movable={canMoveTask(task)}
              onOpen={onOpenTask}
            />
          ))}
          {tasks.length === 0 && (
            <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-brand-slate/30 px-3 py-6 text-center text-xs text-muted-foreground">
              No tasks
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
