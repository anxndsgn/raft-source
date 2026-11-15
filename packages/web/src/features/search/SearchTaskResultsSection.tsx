import { useCallback, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { ListTodo } from "lucide-react";
import { SearchEntityResult, SearchEntityResultContent, SearchEntityResultDescription, SearchEntityResultHeader, SearchEntityResultIcon, SearchEntityResultLeading, SearchEntityResultTitle, SearchResultsList, SearchResultsSection, SearchResultsSectionHeading } from "@botiverse/raft-ui";

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
  // raft-ui SearchEntityResult, as ⌘K's other rows: the task's mark, its title, where it is.
  return (
    <SearchEntityResult type="button" onClick={open} data-testid={`search-task-${task.taskNumber}`}>
      <SearchEntityResultLeading>
        <SearchEntityResultIcon><ListTodo size={14} aria-hidden="true" /></SearchEntityResultIcon>
      </SearchEntityResultLeading>
      <SearchEntityResultContent>
        <SearchEntityResultHeader><SearchEntityResultTitle>{task.title}</SearchEntityResultTitle></SearchEntityResultHeader>
        <SearchEntityResultDescription>
          {formatMessage({ id: "search.taskWhere" }, { channel: task.channelName ?? "", number: task.taskNumber })}
        </SearchEntityResultDescription>
      </SearchEntityResultContent>
    </SearchEntityResult>
  );
}
