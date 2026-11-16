import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { MessageCircleQuestion } from "lucide-react";
import { IconTile, InboxItem, InboxItemBody, InboxItemContent, InboxItemHeading, InboxItemLeading, InboxItemSender, InboxItemTitle, InboxItemTrigger } from "@botiverse/raft-ui";
import { InboxItemLine, InboxItemListGroup } from "@botiverse/raft-ui/wip";

import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useAgentStore } from "../../store/agentStore";
import { openQuestions, useForMeStore } from "./forMeStore";
import type { ForMeQuestion } from "./forMeStore";
import { InboxRowDone } from "./InboxRowDone";

/**
 * For me (task #10 item 7): question cards asked of me, still open. Reading one does not handle it: it leaves once
 * answered, withdrawn or expired (the server's list), or by its Done. A row opens the card in its conversation.
 */
export function InboxQuestions() {
  const questions = useForMeStore((s) => s.questions);
  const doneAt = useForMeStore((s) => s.doneAt);
  const open = useMemo(() => openQuestions(questions, doneAt), [doneAt, questions]);
  if (open.length === 0) return null;
  return (
    <InboxItemListGroup className="pb-1" data-testid="inbox-questions">
      {open.map((question) => <QuestionRow key={question.messageId} question={question} />)}
    </InboxItemListGroup>
  );
}

/**
 * Where a question card opens: its message in its channel; one asked in a thread opens that thread over its
 * channel, one in a task's conversation the channel (never the sub-conversation as if it were a channel, which
 * showed "thread-…" and no way to write).
 */
function openQuestion(nav: ReturnType<typeof useAppNavigate>, question: ForMeQuestion) {
  const parent = question.parentChannelId;
  if (!parent) {
    nav.toMessage(question.channelId, question.messageId);
    return;
  }
  const routeKind = question.parentChannelType === "dm" ? "dm" : "channel";
  if (question.parentMessageId) nav.toThreadMessage(parent, question.parentMessageId, question.messageId, routeKind);
  else if (routeKind === "dm") nav.toDm(parent);
  else nav.toChannel(parent);
}

function QuestionRow({ question }: { question: ForMeQuestion }) {
  const { formatMessage } = useIntl();
  const nav = useAppNavigate();
  const asker = useAgentStore((s) => {
    const agent = question.askedByAgentId ? s.agents.find((a) => a.id === question.askedByAgentId) : null;
    return agent ? agent.displayName || agent.name : null;
  });
  const open = useCallback(() => openQuestion(nav, question), [nav, question]);
  const done = useCallback(() => void useForMeStore.getState().markDone([`card:${question.messageId}`]), [question.messageId]);
  const title = asker ? formatMessage({ id: "inbox.question.titleFrom" }, { name: asker }) : formatMessage({ id: "inbox.question.title" });
  const body = question.title || question.firstQuestion || question.reason || "";
  return (
    <InboxItem density="compact" data-layout="list" data-testid={`inbox-question-${question.messageId}`}>
      <InboxItemTrigger aria-label={title} onClick={open} />
      <InboxItemLeading><IconTile><MessageCircleQuestion aria-hidden /></IconTile></InboxItemLeading>
      <InboxItemContent>
        <InboxItemHeading><InboxItemTitle>{title}</InboxItemTitle></InboxItemHeading>
        <InboxItemLine>
          {/* The title only, one line (Anna 11/16): a long task title is its whole brief. */}
          <InboxItemBody className="line-clamp-1">
            {question.reason && question.reason !== body ? <InboxItemSender>{question.reason}</InboxItemSender> : null}
            {body}
          </InboxItemBody>
        </InboxItemLine>
        <InboxRowDone phone={false} label={formatMessage({ id: "inbox.forMe.doneRow" }, { title })} onDone={done} />
      </InboxItemContent>
    </InboxItem>
  );
}
