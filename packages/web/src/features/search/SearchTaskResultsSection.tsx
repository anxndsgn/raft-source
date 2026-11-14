import { useCallback, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { ListTodo } from "lucide-react";
import { SearchResultsList, SearchResultsSection, SearchResultsSectionHeading } from "@botiverse/raft-ui";

import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useTaskStore } from "../../store/taskStore";
import type { Task } from "../../store/taskStore";
import { openTaskInSidePanel } from "../../components/task/useOpenTask";

const TASK_PREVIEW_COUNT = 5;

/**
 * Layout redesign (7.2): the ⌘K panel's Tasks — this server's tasks whose
 * title matches — each opening its details in its channel's side panel.
 */
export function SearchTaskResultsSection({ query }: { query: string }) {
  const { formatMessage } = useIntl();
  const serverTasks = useTaskStore((s) => s.serverTasks);
  const loaded = useTaskStore((s) => s.serverTasksLoaded);
  const loadServerTasks = useTaskStore((s) => s.loadServerTasks);
  useEffect(() => {
    if (!loaded) void loadServerTasks();
  }, [loaded, loadServerTasks]);
  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () => (needle ? serverTasks.filter((t) => t.title.toLowerCase().includes(needle)).sort((a, b) => b.taskNumber - a.taskNumber).slice(0, TASK_PREVIEW_COUNT) : []),
    [needle, serverTasks],
  );
  if (matches.length === 0) return null;
  return (
    <SearchResultsSection>
      <SearchResultsSectionHeading>
        {formatMessage({ id: "search.tasks" })}
        <span className="font-mono text-mono-meta font-normal">{matches.length}</span>
      </SearchResultsSectionHeading>
      <SearchResultsList data-testid="search-task-results">
        {matches.map((task) => <SearchTaskRow key={task.id} task={task} />)}
      </SearchResultsList>
    </SearchResultsSection>
  );
}

function SearchTaskRow({ task }: { task: Task }) {
  const { formatMessage } = useIntl();
  const nav = useAppNavigate();
  const open = useCallback(() => {
    if (!openTaskInSidePanel(task, nav.toChannel)) nav.toChannel(task.channelId);
  }, [nav, task]);
  return (
    <button
      type="button"
      className="mx-2 flex items-center gap-3 rounded-container px-3 py-2 text-left hover:overlay-subtle"
      onClick={open}
      data-testid={`search-task-${task.taskNumber}`}
    >
      <ListTodo size={16} aria-hidden className="shrink-0 text-foreground-hint" />
      <span className="min-w-0 flex-1 truncate text-foreground">{task.title}</span>
      <span className="shrink-0 font-mono text-mono-meta text-foreground-hint">
        {formatMessage({ id: "search.taskWhere" }, { channel: task.channelName ?? "", number: task.taskNumber })}
      </span>
    </button>
  );
}
