import { useCallback, useMemo } from "react";
import type { MouseEvent } from "react";
import { useIntl } from "react-intl";
import { ArrowUpRight } from "lucide-react";
import {
  Badge,
  FilePreview,
  FilePreviewBadge,
  FilePreviewCode,
  FilePreviewDocument,
  FilePreviewMedia,
  MarkdownLink,
  MessageAttachmentCommentSummary,
  MessageAttachmentSummary,
  MessageEmbed,
  MessageEmbedContent,
  MessageEmbedFooter,
  MessageEmbedHeader,
  PanelAction,
  Skeleton,
  messageCard,
} from "@botiverse/raft-ui";
import { ArtifactIcon, CommentIcon } from "@botiverse/ricons";
import { parseArtifactRef } from "@botiverse/raft-shared";
import type { ArtifactCard, ArtifactReference } from "@botiverse/raft-shared";

import { ARTIFACT_KIND_BADGE, artifactDeletedOf, formatArtifactDeleted, formatArtifactFacts, formatArtifactUpdated } from "./artifactFacts";
import type { ArtifactDeletedShown } from "./artifactFacts";
import { artifactUrl } from "./artifactLinks";
import { useArtifactOpenIntent } from "./artifactOpenIntent";
import { isPlainPrimaryClick, openArtifactCardInPlace } from "./openArtifactInPlace";
import { openArtifactWindow } from "./artifactWindow";
import ArtifactScopeLabel from "./ArtifactScopeLabel";
import { useArtifactCardPicture } from "./artifactCardPicture";
import { ArtifactCardExcerpt } from "./ArtifactCardExcerpt";

// The file badge on the glyph: the file type as people know it, not a word
// for the kind. A card has no file name (AttachmentTypeBadge reads one), so
// the badge comes from the kind.
export function KindGlyph({ card, timelineArtifactBadge }: { card: ArtifactCard; timelineArtifactBadge?: string }) {
  // Layout redesign (4.2): on the timeline every Artifact reads "ART", whatever its kind.
  const badge = timelineArtifactBadge ?? ARTIFACT_KIND_BADGE[card.kind];
  // The picture itself is the card's preview above; the glyph only names the type.
  return (
    <FilePreview>
      {card.kind === "html" ? (
        <FilePreviewCode />
      ) : card.kind === "image" || card.kind === "video" ? (
        <FilePreviewMedia />
      ) : (
        <FilePreviewDocument />
      )}
      {badge ? <FilePreviewBadge>{badge}</FilePreviewBadge> : null}
    </FilePreview>
  );
}

/**
 * The version tag: "v3". Given the latest of a card pinned to an older one, it says both, "v3 · latest v5"
 * (#proj-workspace:#250: the tag, not a sentence in the fact line, says the card isn't the latest).
 */
export function ArtifactVersionBadge({ version, latest }: { version: number; latest?: number }) {
  const { formatMessage } = useIntl();
  return (
    <Badge appearance="outline" variant="muted" className="shrink-0" data-testid="artifact-version-badge">
      {latest !== undefined && latest > version
        ? formatMessage({ id: "artifacts.card.versionBehind" }, { version, latest })
        : formatMessage({ id: "artifacts.card.version" }, { version })}
    </Badge>
  );
}


/**
 * What changed since the reader last looked (ArtifactCard `unseen`, from
 * core's summaries; #proj-workspace:#141), as the card marks it: others'
 * new comments, and a newer version than the one they last saw. Nothing
 * without it (never opened, an older Server, another surface's card) and
 * nothing on a preview (what the recipients will see is theirs). A pinned
 * card names its own version, so a newer one isn't marked beside it (it
 * would read as "this version is new").
 */
function unseenMarks(card: ArtifactCard, preview: boolean): { newerVersion: boolean; newComments: number } {
  const unseen = preview ? null : card.unseen ?? null;
  if (!unseen) return { newerVersion: false, newComments: 0 };
  return {
    newerVersion: unseen.newerVersion === true && !card.pinned,
    newComments: card.commentCount > 0 ? Math.max(0, Math.min(unseen.newComments, card.commentCount)) : 0,
  };
}

/** Between the sticker's parts, as the thread replies summary reads "4 replies · 1 new". */
const STICKER_SEPARATOR = " · ";

/**
 * What is new on the card, as ONE pink sticker beside the title (xxchan, #proj-workspace:72934211: one "new" signal;
 * Kirby's option B): the DS Badge for new activity, `accent`, saying what it is: "Updated", "2 new comments", or both
 * ("Updated · 2 new comments"), after "Mentions you" where the card knows it (`mentioned`, the home page's rows). The
 * comment count in the footer stays the plain gray count. It may shrink: its words truncate before the title gives
 * way (the title row wraps first), or, `twoLines` (a home tile, as narrow as 150px on a phone), take a second line first.
 */
export function NewSticker({ mentioned = false, newerVersion, newComments, twoLines = false }: { mentioned?: boolean; newerVersion: boolean; newComments: number; twoLines?: boolean }) {
  const { formatMessage } = useIntl();
  if (!mentioned && !newerVersion && newComments === 0) return null;
  const parts = [
    mentioned ? { key: "mention", text: formatMessage({ id: "artifacts.card.mentioned" }), label: formatMessage({ id: "artifacts.card.mentionedLabel" }), testId: "artifact-card-mentioned" } : null,
    newerVersion ? { key: "version", text: formatMessage({ id: "artifacts.card.newVersion" }), label: formatMessage({ id: "artifacts.card.newVersionLabel" }), testId: "artifact-card-new-version" } : null,
    newComments > 0 ? { key: "comments", text: formatMessage({ id: "artifacts.dashboard.newComments" }, { count: newComments }), label: formatMessage({ id: "artifacts.card.newComments" }, { count: newComments }), testId: "artifact-card-new-comments" } : null,
  ].filter((part) => part !== null);
  const label = parts.map((part) => part.label).join("; ");
  return (
    <Badge variant="accent" className={`min-w-0 max-w-full ${twoLines ? "h-auto whitespace-normal" : ""}`} role="img" aria-label={label} data-testid="artifact-card-new">
      <span className={`min-w-0 ${twoLines ? "line-clamp-2" : "truncate"}`}>
        {parts.map((part, index) => (
          <span key={part.key} data-testid={part.testId}>{index > 0 ? STICKER_SEPARATOR : null}{part.text}</span>
        ))}
      </span>
    </Badge>
  );
}

/**
 * An Artifact referenced in a message, as this viewer may see it.
 *
 * - ok: the card (F12: title, description, the publish check's screenshot or
 *   else an optional publisher cover or else the start of the text above,
 *   useArtifactCardPicture; F37: the fact line per kind; F31 A: where it
 *   lives). The title is the link and its ::after covers the card, so "open
 *   in a new page" and the scope label stay separate controls.
 * - deleted (only ever sent to a viewer who could see it before it was
 *   deleted): a gray, dimmed card (DS States › Dimmed) with the title and who
 *   deleted it when. Nothing in it opens: no link, preview, comments or viewer.
 * - unavailable: only the id-only link, drawn as the message body draws any
 *   link (F11). No title, preview or home: nothing tells "no access" from
 *   "deleted". A status this client doesn't know (from a newer server) is
 *   drawn as unavailable.
 *
 * A plain click on it opens it in place, wherever the card is drawn
 * (openArtifactInPlace: the opening rule, #proj-workspace:#104); no surface
 * has to say where. Only outside the app shell (a public page) the link is
 * followed; its ↗ and Cmd/Ctrl or middle clicks open its own page.
 *
 * `preview`: the card as what is about to be sent (the Forward dialog), not
 * an entry point: its title is text, there is no ↗, nothing opens or takes
 * focus.
 *
 * What is new to this reader since they last looked (`card.unseen`, unseenMarks): one sticker after the version
 * badge, "Updated", "N new comments" or both (NewSticker); the footer's comment count stays plain.
 */
export default function ArtifactMessageCard({ reference, preview = false }: { reference: ArtifactReference; preview?: boolean }) {
  if (reference.status === "ok") return preview ? <OkCard card={reference.card} preview /> : <OkCard card={reference.card} />;
  if (reference.status === "deleted") {
    const deleted = artifactDeletedOf(reference);
    return deleted ? <ArtifactDeletedCard deleted={deleted} /> : null;
  }
  // Unavailable, and any status this client doesn't know (typed as
  // unavailable here, so its url is checked). Rebuilt from the id: the
  // canonical id-only address, whatever the payload carried.
  const parsed = typeof reference.url === "string" ? parseArtifactRef(reference.url) : null;
  if (parsed?.kind !== "id") return null;
  const url = artifactUrl(parsed.id, parsed.version ?? null);
  return (
    <MarkdownLink href={url} target="_blank" rel="noopener noreferrer" className="break-all" data-testid="artifact-link-fallback">
      {url}
    </MarkdownLink>
  );
}

/**
 * A deleted Artifact: the card's frame and glyph, gray and dimmed as the DS
 * draws something deleted (`grayscale` with `opacity-dimmed`), its title as
 * plain text and "Deleted by <name> <time>" under it. A `div`, not a link:
 * no hover, no focus, nothing opens. Its words are a step darker than a live
 * card's (`foreground`, `foreground-muted`), so they still read at 60%.
 */
export function ArtifactDeletedCard({ deleted }: { deleted: ArtifactDeletedShown }) {
  const intl = useIntl();
  const { title, meta } = messageCard();
  return (
    <MessageEmbed size="item" className="grayscale opacity-dimmed" data-testid="artifact-card-deleted">
      <MessageEmbedHeader className="flex min-w-0 items-start gap-2.5">
        <FilePreview>
          <FilePreviewDocument />
        </FilePreview>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className={title({ className: "min-w-0 break-words" })} data-testid="artifact-card-deleted-title">
            {deleted.title}
          </p>
          <p className={meta()} data-testid="artifact-card-deleted-meta">
            {formatArtifactDeleted(deleted, intl)}
          </p>
        </div>
      </MessageEmbedHeader>
    </MessageEmbed>
  );
}

function OkCard({ card, preview = false }: { card: ArtifactCard; preview?: boolean }) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const handleOpen = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainPrimaryClick(event)) return;
    if (openArtifactCardInPlace(card, event.currentTarget)) event.preventDefault();
  }, [card]);
  const facts = formatArtifactFacts(card.kind, card.facts, intl);
  const url = artifactUrl(card.id, card.pinned ? card.version : null);
  // The comment count opens the Artifact on its comments; outside the app shell, its page (the title's link).
  const handleOpenComments = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    if (!openArtifactCardInPlace(card, event.currentTarget, true)) openArtifactWindow(url, card.id);
  }, [card, url]);
  const target = useMemo(() => ({ id: card.id, version: card.pinned ? card.version : null }), [card.id, card.pinned, card.version]);
  // The title's ::after covers the card: pressing, hovering or focusing it is intent to open.
  const intent = useArtifactOpenIntent(target, card);
  const [picture, pictureRef] = useArtifactCardPicture(card);
  const meta = formatArtifactUpdated(card, intl);
  const marks = unseenMarks(card, preview);
  const parts = messageCard();
  // Raft redesign (conversation spec): with a mouse the title is Semi Bold 13/17.
  const titleClass = parts.title({ className: "min-w-0 flex-[1_1_8rem] break-words md:pointer-fine:text-[13px] md:pointer-fine:leading-[17px] md:pointer-fine:font-semibold" });
  const versionText = formatMessage({ id: "artifacts.card.version" }, { version: card.version });
  // With a mouse the version joins the facts line ("Markdown · v3 · Opens in the workspace") and the tag goes.
  // The separator is drawn by CSS (" · "), the same one the facts message uses.
  const versionInFacts = <span className="hidden md:pointer-fine:inline after:content-['_·_'] after:whitespace-pre">{versionText}</span>;
  return (
    // A preview is inert as a whole: where it lives (a chip that explains itself) takes no focus there either.
    // Pressable as a whole (the title's ::after), so it shows hover and press as a file card
    // does (raft-ui MessageEmbed `interactive`); a preview opens nothing, so it doesn't.
    <MessageEmbed ref={pictureRef} size="item" interactive={!preview} className="relative" data-testid="artifact-card" data-artifact-id={card.id} inert={preview || undefined}>
      {/* A screenshot or a publisher's cover: 16:10, at most 192 px tall (max-h-48, cut from the top: the page's top and first screen), as the DS link card and near the conversation's other media; the home page's tile, a browsing grid, shows it whole. A Markdown version's excerpt follows its words, up to the same 192 px. */}
      {/* Until a screenshot is read (only once the card nears the screen; off screen too, the card says there is one), its place is kept (an empty box), so the conversation doesn't move when it comes; one that can't be read gives the place back. */}
      {picture?.loading ? (
        <MessageEmbedContent>
          <div className="aspect-[16/10] max-h-48 w-full border-b border-line-hairline bg-fill-muted" data-testid="artifact-card-cover-pending" />
        </MessageEmbedContent>
      ) : picture?.src ? (
        <MessageEmbedContent>
          <img
            src={picture.src}
            alt=""
            className="block aspect-[16/10] max-h-48 w-full border-b border-line-hairline object-cover object-top"
            data-testid="artifact-card-cover"
            data-cover={picture.screenshot ? "screenshot" : "publisher"}
          />
        </MessageEmbedContent>
      ) : picture?.excerpt ? (
        <MessageEmbedContent>
          <ArtifactCardExcerpt text={picture.excerpt} blocks={picture.excerptBlocks} fit="content" testId="artifact-card-excerpt" />
        </MessageEmbedContent>
      ) : null}
      <MessageEmbedHeader className="flex min-w-0 items-start gap-2.5">
        {/* Raft redesign: with a mouse Eva's 24px artifact icon, no ART tag and no tile. */}
        <span className="contents md:pointer-fine:hidden">
          <KindGlyph card={card} timelineArtifactBadge="ART" />
        </span>
        <ArtifactIcon aria-hidden className="hidden size-6 shrink-0 text-foreground md:pointer-fine:block" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          {/* The title keeps at least 8rem: the version and the sticker wrap under it before it shrinks further (Kirby, #12873). */}
          <div className="flex min-w-0 flex-wrap items-start gap-x-1.5 gap-y-1">
            {/* The title is messageCard's (raft-ui): its link keeps the title's ink and is underlined on hover. */}
            {preview ? (
              <p data-testid="artifact-card-title" className={titleClass}>
                {card.title}
              </p>
            ) : (
              <p className={titleClass}>
                <a
                  href={url}
                  onClick={handleOpen}
                  {...intent}
                  data-testid="artifact-card-title"
                  className="no-underline after:absolute after:inset-0 after:rounded-container focus-visible:after:shadow-focus"
                >
                  {card.title}
                </a>
              </p>
            )}
            <span className="flex min-w-0 max-w-full items-center gap-1 pt-px">
              <span className="contents md:pointer-fine:hidden">
                <ArtifactVersionBadge version={card.version} latest={card.pinned ? card.latestVersion : undefined} />
              </span>
              <NewSticker newerVersion={marks.newerVersion} newComments={marks.newComments} />
            </span>
          </div>
          {/* Layout redesign (4.2): where it opens — the workspace — under the title. */}
          <p className={parts.meta({ className: "md:pointer-fine:text-[12px] md:pointer-fine:leading-4 md:pointer-fine:text-foreground-hint" })} data-testid="artifact-card-facts">
            {/* One run of text: the meta row is a flex row with a gap, which would widen the space after the dot. */}
            <span>
              {facts
                ? formatMessage({ id: "artifacts.card.factsOpensInWorkspace" }, { facts: <>{facts}<span className="hidden md:pointer-fine:inline before:content-['_·_'] before:whitespace-pre">{versionText}</span></> })
                : <>{versionInFacts}{formatMessage({ id: "artifacts.card.opensInWorkspace" })}</>}
            </span>
          </p>
          {card.description ? (
            <p className={`${facts ? "line-clamp-1" : "line-clamp-2"} text-callout break-words text-foreground-muted`}>{card.description}</p>
          ) : null}
        </div>
        {preview ? null : (
          <PanelAction
            // Raft redesign: with a mouse it shows only while the card is hovered or it has focus.
            className="relative z-raised -mt-1 -mr-1 md:pointer-fine:opacity-0 md:pointer-fine:group-hover:opacity-100 md:pointer-fine:focus-visible:opacity-100"
            nativeButton={false}
            // Layout redesign (4.2): opens in the workspace (the viewer's head still opens a new page).
            render={<a href={url} onClick={handleOpen} aria-label={formatMessage({ id: "artifacts.card.opensInWorkspace" })} data-testid="artifact-card-open-in-workspace" />}
          >
            <ArrowUpRight aria-hidden />
          </PanelAction>
        )}
      </MessageEmbedHeader>
      {/* Raft redesign: with a mouse no source line (where it lives, when it changed); only a comment count keeps the footer. */}
      <MessageEmbedFooter className={card.commentCount > 0 ? "flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1" : "flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 md:pointer-fine:hidden"}>
        <span className="contents md:pointer-fine:hidden">
          <ArtifactScopeLabel home={card.home} fromAnotherServer={card.fromAnotherServer} onCard />
          {meta ? <span className="min-w-0 truncate font-mono text-mono-meta text-foreground-hint">{meta}</span> : null}
        </span>
        {card.commentCount > 0 ? (
          // Over the title's ::after: the count opens the Artifact on its comments (a preview opens nothing); its focus ring is the app's fallback one (index.css).
          <button
            type="button"
            onClick={preview ? undefined : handleOpenComments}
            className="relative z-raised flex items-center rounded-control"
            data-testid="artifact-card-comments"
          >
            <MessageAttachmentSummary
              render={<MessageAttachmentCommentSummary />}
              className="mt-0 pr-0"
              aria-label={formatMessage({ id: "artifacts.card.comments" }, { count: card.commentCount })}
            >
              <CommentIcon aria-hidden />
              {card.commentCount}
            </MessageAttachmentSummary>
          </button>
        ) : null}
      </MessageEmbedFooter>
    </MessageEmbed>
  );
}

/** While a reference resolves: a Skeleton in the card's shape. */
export function ArtifactMessageCardLoading() {
  const { formatMessage } = useIntl();
  return (
    <MessageEmbed size="item" aria-busy="true" aria-label={formatMessage({ id: "artifacts.card.loading" })}>
      <MessageEmbedHeader className="flex items-start gap-2.5">
        <Skeleton className="size-8 rounded-control" />
        <div className="grid flex-1 gap-2 pt-1">
          <Skeleton variant="line" className="w-3/5" />
          <Skeleton variant="line" className="w-4/5" />
        </div>
      </MessageEmbedHeader>
    </MessageEmbed>
  );
}
