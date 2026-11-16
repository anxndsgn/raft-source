import { Button, Field, FieldError, FieldLabel, Input, RadioGroup, RadioGroupItem, Spinner, Textarea } from "@botiverse/raft-ui";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useIntl } from "react-intl";
import api from "../../../api/client";
import { mcpAppErrorMessage } from "../../../components/settings/mcpApps/mcpAppApi";
import type { McpAppView, McpProbeResult } from "../../../components/settings/mcpApps/mcpAppApi";
import { useMcpOAuthSignIn } from "../../../components/settings/mcpApps/useMcpOAuthSignIn";
import type { McpOAuthOutcome } from "../../../components/settings/mcpApps/useMcpOAuthSignIn";
import Banner from "../../../components/ui/Banner";
import DialogCard from "../../../components/ui/DialogCard";
import { DialogCardFooter, DialogCommit } from "../../../components/ui/NarrowDialog";
import { useAgentStore } from "../../../store/agentStore";
import { useServerStore } from "../../../store/serverStore";
import { McpAgentPicker } from "./McpAgentPicker";
import { saveMcpAppAgents } from "./mcpAppAgentsApi";
import { authorizationValue, bearerKey, parsePastedMcp } from "./mcpPastedConfig";
import type { PastedMcpServer } from "./mcpPastedConfig";

const PROBE_DELAY_MS = 450;
const DEFAULT_HEADER = "Authorization";

type ProbeState =
  | { status: "idle" }
  | { status: "probing"; url: string }
  | { status: "done"; url: string; result: McpProbeResult }
  | { status: "failed"; url: string; message: string };

function nameFrom(result: McpProbeResult | null, server: PastedMcpServer | null): string {
  const fromServer = result?.serverInfo?.name?.trim();
  if (fromServer) return fromServer.slice(0, 120);
  if (server?.name) return server.name.slice(0, 120);
  try {
    const host = new URL(server?.url ?? "").hostname.replace(/^(www|mcp|api)\./, "");
    const word = host.split(".")[0] ?? "";
    return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
  } catch {
    return "";
  }
}

/**
 * Sign-in for the App being added (OAuth): the App is saved as soon as the
 * address says it needs a sign-in, with no Agents, so the sign-in has
 * something to belong to and its window opens from the person's own click;
 * Add then names it and hands it to the checked Agents. Closing without Add
 * removes it.
 */
function QuickAddSignIn({ appId, label, onConnected, onError }: { appId: string; label: string; onConnected: () => void; onError: (message: string) => void }) {
  const { formatMessage } = useIntl();
  const handleOutcome = useCallback((outcome: McpOAuthOutcome) => {
    if (outcome.kind === "connected") onConnected();
    else onError(formatMessage({ id: outcome.kind === "closed" ? "apps.cap.add.signInClosed" : "apps.cap.add.signInFailed" }));
  }, [formatMessage, onConnected, onError]);
  const handleStartError = useCallback((error: unknown) => onError(mcpAppErrorMessage(error, formatMessage)), [formatMessage, onError]);
  const { start, openSignInPage, blockedUrl, waiting, starting } = useMcpOAuthSignIn({ appId, onOutcome: handleOutcome, onStartError: handleStartError });
  const handleStart = useCallback(() => {
    void start({ name: label, makeDefault: true });
  }, [label, start]);
  return (
    <div className="flex items-center gap-2" data-testid="mcp-quick-add-signin-row">
      {blockedUrl ? (
        <Button type="button" variant="outline" size="md" onClick={openSignInPage}>{formatMessage({ id: "apps.cap.add.openSignIn" })}</Button>
      ) : (
        <Button type="button" variant="outline" size="md" disabled={waiting || starting} onClick={handleStart} data-testid="mcp-quick-add-signin">
          {waiting || starting ? <Spinner size="sm" aria-hidden="true" /> : null}
          {formatMessage({ id: waiting ? "apps.cap.add.signingIn" : "apps.cap.add.signIn" }, { name: label })}
        </Button>
      )}
    </div>
  );
}

/**
 * Add MCP in one screen (task #18, Anna's spec v1.0): paste an address or an
 * `mcpServers` configuration; it is checked at once; only what this server
 * needs appears (nothing, a key, or Sign in); pick the Agents; one Add saves
 * the App, its first Connection and its Agents.
 */
export function QuickAddMcpDialog({ onClose, onAdded, onOpenFullEditor, onBrowseMarketplace, initialAgentId }: {
  onClose: () => void;
  onAdded: (appId: string) => void;
  /** The old editor, for what this screen does not do (an OAuth client to register). */
  onOpenFullEditor: () => void;
  onBrowseMarketplace: () => void;
  /** Opened from an Agent's capabilities: that Agent starts checked. */
  initialAgentId?: string;
}) {
  const { formatMessage } = useIntl();
  const storeAgents = useAgentStore((state) => state.agents);
  const serverId = useServerStore((state) => state.current?.id ?? null);
  // This server's own Agents: the store also keeps other servers' and external ones.
  const agents = useMemo(() => storeAgents
    .filter((agent) => !agent.deletedAt && !agent.external && !agent.raftbenchService && (!agent.serverId || agent.serverId === serverId))
    .map((agent) => ({ id: agent.id, name: agent.name, displayName: agent.displayName, avatarUrl: agent.avatarUrl }))
    .sort((left, right) => (left.displayName || left.name).localeCompare(right.displayName || right.name)), [serverId, storeAgents]);

  const [text, setText] = useState("");
  const [pick, setPick] = useState(0);
  const [probe, setProbe] = useState<ProbeState>({ status: "idle" });
  // What a person typed over what the server or the pasted configuration said; null: not edited.
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [keyEdit, setKeyEdit] = useState<string | null>(null);
  const [headerEdit, setHeaderEdit] = useState<string | null>(null);
  const [keyAsked, setKeyAsked] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [whenToUse, setWhenToUse] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialAgentId ? [initialAgentId] : []));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [keyError, setKeyError] = useState("");
  // OAuth: the App saved for the sign-in, and whether it signed in.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const draftRef = useRef<string | null>(null);
  const finished = useRef(false);
  const probeTimer = useRef<number | null>(null);
  const probeSeq = useRef(0);

  const parsed = useMemo(() => parsePastedMcp(text), [text]);
  const servers = useMemo(() => (parsed.kind === "servers" ? parsed.servers : []), [parsed]);
  const server = servers[Math.min(pick, servers.length - 1)] ?? null;
  const probeResult = probe.status === "done" && probe.url === server?.url ? probe.result : null;
  const outcome = probeResult?.outcome ?? null;
  // A pasted configuration's key (an Authorization Bearer, or another header) fills the key field.
  const configHeader = useMemo(() => {
    if (!server) return null;
    const bearer = bearerKey(server.headers);
    if (bearer) return { name: DEFAULT_HEADER, value: bearer };
    const [other] = Object.entries(server.headers);
    return other ? { name: other[0], value: other[1] } : null;
  }, [server]);
  const name = nameEdit ?? nameFrom(probeResult, server);
  const key = keyEdit ?? configHeader?.value ?? "";
  const headerName = headerEdit ?? configHeader?.name ?? DEFAULT_HEADER;
  const keyWanted = keyAsked || configHeader !== null;

  // The address is checked as soon as typing settles (no Validate button); the newest check wins.
  const scheduleProbe = useCallback((url: string | null) => {
    if (probeTimer.current !== null) window.clearTimeout(probeTimer.current);
    probeTimer.current = null;
    const seq = ++probeSeq.current;
    if (!url) {
      setProbe({ status: "idle" });
      return;
    }
    probeTimer.current = window.setTimeout(async () => {
      probeTimer.current = null;
      setProbe({ status: "probing", url });
      try {
        const { data } = await api.post<McpProbeResult>("/mcp/probe", { endpointUrl: url });
        if (seq === probeSeq.current) setProbe({ status: "done", url, result: data });
      } catch (probeError) {
        if (seq === probeSeq.current) setProbe({ status: "failed", url, message: mcpAppErrorMessage(probeError, formatMessage) });
      }
    }, PROBE_DELAY_MS);
  }, [formatMessage]);
  useEffect(() => () => {
    if (probeTimer.current !== null) window.clearTimeout(probeTimer.current);
    probeSeq.current += 1;
  }, []);

  // Closing without Add removes the App saved for a sign-in.
  const dropDraft = useCallback(() => {
    const id = draftRef.current;
    draftRef.current = null;
    if (id && !finished.current) void api.delete(`/mcp/apps/${encodeURIComponent(id)}`).catch(() => undefined);
  }, []);
  useEffect(() => dropDraft, [dropDraft]);
  const handleClose = useCallback(() => {
    dropDraft();
    onClose();
  }, [dropDraft, onClose]);

  const resetForServer = useCallback(() => {
    setNameEdit(null);
    setKeyEdit(null);
    setHeaderEdit(null);
    setKeyAsked(false);
    setError("");
    setKeyError("");
    if (draftRef.current) {
      dropDraft();
      setDraftId(null);
      setSignedIn(false);
    }
  }, [dropDraft]);
  const handleText = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setText(next);
    setPick(0);
    resetForServer();
    const pasted = parsePastedMcp(next);
    scheduleProbe(pasted.kind === "servers" ? pasted.servers[0]?.url ?? null : null);
  }, [resetForServer, scheduleProbe]);
  const handleName = useCallback((event: ChangeEvent<HTMLInputElement>) => setNameEdit(event.target.value), []);
  const handleKey = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setKeyEdit(event.target.value);
    setKeyError("");
  }, []);
  const handleHeaderName = useCallback((event: ChangeEvent<HTMLInputElement>) => setHeaderEdit(event.target.value), []);
  const handleDescription = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => setDescription(event.target.value), []);
  const handleWhenToUse = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => setWhenToUse(event.target.value), []);
  const toggleMore = useCallback(() => setMoreOpen((open) => !open), []);
  const wantKey = useCallback(() => setKeyAsked(true), []);
  const handlePick = useCallback((value: unknown) => {
    const index = Number(value) || 0;
    setPick(index);
    resetForServer();
    scheduleProbe(servers[index]?.url ?? null);
  }, [resetForServer, scheduleProbe, servers]);

  const needsKey = outcome === "headers" || (outcome === "ready" && keyWanted);
  const needsSignIn = outcome === "oauth";
  const manualClient = needsSignIn && probeResult?.oauth?.registration === "manual_required";
  const trimmedName = name.trim();
  const profile = useMemo(() => ({
    name: trimmedName,
    ...(description.trim() ? { description: description.trim() } : {}),
    ...(whenToUse.trim() ? { whenToUse: whenToUse.trim() } : {}),
  }), [description, trimmedName, whenToUse]);

  // An address that needs a sign-in: save the App for it now (see QuickAddSignIn).
  const draftUrl = needsSignIn && !manualClient && server ? server.url : null;
  const draftName = nameFrom(probeResult, server);
  useEffect(() => {
    if (!draftUrl || draftRef.current || !draftName) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.post<McpAppView>("/mcp/apps", {
          source: { kind: "url", endpointUrl: draftUrl },
          profile: { name: draftName },
          authKind: "oauth",
          agentIds: [],
        });
        if (cancelled) {
          void api.delete(`/mcp/apps/${encodeURIComponent(data.id)}`).catch(() => undefined);
          return;
        }
        draftRef.current = data.id;
        setDraftId(data.id);
      } catch (createError) {
        if (!cancelled) setError(mcpAppErrorMessage(createError, formatMessage));
      }
    })();
    return () => { cancelled = true; };
  }, [draftName, draftUrl, formatMessage]);
  const handleSignedIn = useCallback(() => setSignedIn(true), []);
  // A failed or closed sign-in keeps the saved App: Sign in again retries on it.
  const handleSignInError = useCallback((message: string) => setError(message), []);

  const canAdd = Boolean(server && trimmedName && !submitting && probeResult && !manualClient
    && (needsSignIn ? signedIn : true)
    && (outcome !== "headers" || key.trim()));

  const handleSubmit = useCallback(async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canAdd || !server) return;
    setSubmitting(true);
    setError("");
    setKeyError("");
    try {
      if (needsSignIn && draftId) {
        await api.patch(`/mcp/apps/${encodeURIComponent(draftId)}`, { profile });
        await saveMcpAppAgents(draftId, [...selected]);
        finished.current = true;
        onAdded(draftId);
        return;
      }
      const header = headerName.trim() || DEFAULT_HEADER;
      const withKey = needsKey && key.trim();
      const { data } = await api.post<McpAppView>("/mcp/apps", {
        source: { kind: "url", endpointUrl: server.url },
        profile,
        authKind: withKey ? "headers" : "none",
        ...(withKey ? {
          requiredHeaderNames: [header],
          headers: { [header]: header.toLowerCase() === "authorization" ? authorizationValue(key) : key.trim() },
        } : {}),
        agentIds: [...selected],
      });
      finished.current = true;
      onAdded(data.id);
    } catch (addError) {
      const message = mcpAppErrorMessage(addError, formatMessage);
      const code = (addError as { response?: { data?: { code?: string } } })?.response?.data?.code ?? "";
      if (/credential|header/.test(code)) setKeyError(message);
      else setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [canAdd, draftId, formatMessage, headerName, key, needsKey, needsSignIn, onAdded, profile, selected, server]);

  const probing = probe.status === "probing" && probe.url === server?.url;
  const probeFailed = probe.status === "failed" && probe.url === server?.url ? probe.message : null;
  const unreachable = outcome === "unreachable";
  const fieldError = parsed.kind === "invalid"
    ? formatMessage({ id: "apps.cap.add.invalid" })
    : parsed.kind === "servers" && servers.length === 0
      ? formatMessage({ id: "apps.cap.add.localOnly" })
      : unreachable
        ? formatMessage({ id: "apps.cap.add.unreachable" })
        : probeFailed;
  let found: string | null = null;
  if (outcome === "ready") found = formatMessage({ id: "apps.cap.add.foundReady" }, { count: probeResult?.tools?.count ?? 0 });
  else if (outcome === "headers") found = formatMessage({ id: "apps.cap.add.foundKey" });
  else if (outcome === "oauth") found = formatMessage({ id: "apps.cap.add.foundSignIn" }, { name: trimmedName || server?.url || "" });
  const ready = Boolean(probeResult && !unreachable);

  return (
    <DialogCard
      title={formatMessage({ id: "apps.cap.add.title" })}
      onClose={handleClose}
      narrow="sheet"
      maxWidthClass="max-w-[520px]"
      testId="mcp-quick-add"
    >
      <form onSubmit={handleSubmit} className="stack-y-4">
        <Field invalid={Boolean(fieldError)}>
          <FieldLabel>{formatMessage({ id: "apps.cap.add.addressLabel" })}</FieldLabel>
          <Textarea
            value={text}
            onChange={handleText}
            autoFocus
            rows={text.includes("\n") ? 6 : 1}
            placeholder={formatMessage({ id: "apps.cap.add.addressPlaceholder" })}
            // One line for an address; a pasted configuration grows it.
            className={text.includes("\n") ? "font-mono" : "min-h-0 resize-none font-mono"}
            data-testid="mcp-quick-add-address"
          />
          {fieldError ? <FieldError match data-testid="mcp-quick-add-address-error">{fieldError}</FieldError> : null}
          {probing ? (
            <p className="flex items-center gap-1.5 text-footnote text-foreground-hint" data-testid="mcp-quick-add-probing">
              <Spinner size="sm" aria-hidden="true" />{formatMessage({ id: "apps.cap.add.checking" })}
            </p>
          ) : found ? (
            <p className="flex items-center gap-1.5 text-footnote text-success-strong" data-testid="mcp-quick-add-found">
              <Check aria-hidden size={14} />{found}
            </p>
          ) : null}
          {parsed.kind === "servers" && parsed.localOnly.length > 0 && servers.length > 0 ? (
            <p className="text-footnote text-foreground-hint">{formatMessage({ id: "apps.cap.add.localSkipped" }, { names: parsed.localOnly.join(", ") })}</p>
          ) : null}
          {!text.trim() ? (
            <p className="text-footnote text-foreground-hint">
              {formatMessage({ id: "apps.cap.add.orMarketplace" })}{" "}
              <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={onBrowseMarketplace} data-testid="mcp-quick-add-marketplace">
                {formatMessage({ id: "apps.cap.add.browseMarketplace" })}
              </button>
            </p>
          ) : null}
        </Field>

        {servers.length > 1 ? (
          <Field>
            <FieldLabel>{formatMessage({ id: "apps.cap.add.pickServer" })}</FieldLabel>
            <RadioGroup value={String(Math.min(pick, servers.length - 1))} onValueChange={handlePick} data-testid="mcp-quick-add-servers">
              {servers.map((item, index) => (
                <label key={`${item.name ?? ""}-${item.url}`} className="flex items-center gap-2 text-body">
                  <RadioGroupItem value={String(index)} />
                  <span className="font-medium">{item.name ?? item.url}</span>
                  <span className="min-w-0 truncate font-mono text-mono-meta text-foreground-hint">{item.url}</span>
                </label>
              ))}
            </RadioGroup>
          </Field>
        ) : null}

        {ready ? (
          <>
            <Field>
              <FieldLabel>{formatMessage({ id: "apps.cap.add.nameLabel" })}</FieldLabel>
              <Input value={name} onChange={handleName} maxLength={120} data-testid="mcp-quick-add-name" />
            </Field>

            {needsKey ? (
              <Field invalid={Boolean(keyError)}>
                <FieldLabel>{headerName.toLowerCase() === "authorization" ? formatMessage({ id: "apps.cap.add.keyLabel" }) : headerName}</FieldLabel>
                <Input
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={handleKey}
                  placeholder={formatMessage({ id: headerName.toLowerCase() === "authorization" ? "apps.cap.add.keyPlaceholder" : "apps.cap.add.keyPlaceholderOther" })}
                  data-testid="mcp-quick-add-key"
                />
                {keyError ? <FieldError match data-testid="mcp-quick-add-key-error">{keyError}</FieldError> : null}
              </Field>
            ) : outcome === "ready" ? (
              <button type="button" className="self-start text-footnote text-foreground-muted underline underline-offset-2" onClick={wantKey} data-testid="mcp-quick-add-want-key">
                {formatMessage({ id: "apps.cap.add.needKey" })}
              </button>
            ) : null}

            {needsSignIn ? (
              manualClient ? (
                <div className="stack-y-2" data-testid="mcp-quick-add-manual-client">
                  <p className="text-footnote text-foreground-muted">{formatMessage({ id: "apps.cap.add.manualClient" })}</p>
                  <Button type="button" variant="outline" size="md" onClick={onOpenFullEditor}>{formatMessage({ id: "apps.cap.add.openFullEditor" })}</Button>
                </div>
              ) : signedIn ? (
                <p className="flex items-center gap-1.5 text-footnote text-success-strong" data-testid="mcp-quick-add-signed-in">
                  <Check aria-hidden size={14} />{formatMessage({ id: "apps.cap.add.signedIn" }, { name: trimmedName })}
                </p>
              ) : (
                <div className="stack-y-1">
                  {draftId ? (
                    <QuickAddSignIn appId={draftId} label={trimmedName || draftName} onConnected={handleSignedIn} onError={handleSignInError} />
                  ) : (
                    <Button type="button" variant="outline" size="md" disabled data-testid="mcp-quick-add-signin-preparing">
                      <Spinner size="sm" aria-hidden="true" />
                      {formatMessage({ id: "apps.cap.add.signIn" }, { name: trimmedName || draftName })}
                    </Button>
                  )}
                  <p className="text-footnote text-foreground-hint">{formatMessage({ id: "apps.cap.add.signInHint" })}</p>
                </div>
              )
            ) : null}

            <McpAgentPicker agents={agents} selected={selected} onChange={setSelected} disabled={submitting} testId="mcp-quick-add-agents" />

            <div className="stack-y-3">
              <button type="button" className="flex items-center gap-1 text-footnote font-medium text-foreground-muted" onClick={toggleMore} aria-expanded={moreOpen} data-testid="mcp-quick-add-more">
                {moreOpen ? <ChevronDown aria-hidden size={14} /> : <ChevronRight aria-hidden size={14} />}
                {formatMessage({ id: "apps.cap.add.more" })}
              </button>
              {moreOpen ? (
                <div className="stack-y-3" data-testid="mcp-quick-add-more-fields">
                  <Field>
                    <FieldLabel>{formatMessage({ id: "apps.cap.add.descriptionLabel" })}</FieldLabel>
                    <Textarea value={description} onChange={handleDescription} rows={2} data-testid="mcp-quick-add-description" />
                  </Field>
                  <Field>
                    <FieldLabel>{formatMessage({ id: "apps.cap.add.whenToUseLabel" })}</FieldLabel>
                    <Textarea value={whenToUse} onChange={handleWhenToUse} rows={2} placeholder={formatMessage({ id: "apps.cap.add.whenToUsePlaceholder" })} data-testid="mcp-quick-add-when" />
                  </Field>
                  {needsKey ? (
                    <Field>
                      <FieldLabel>{formatMessage({ id: "apps.cap.add.headerLabel" })}</FieldLabel>
                      <Input value={headerName} onChange={handleHeaderName} className="font-mono" data-testid="mcp-quick-add-header" />
                    </Field>
                  ) : null}
                  <p className="text-footnote text-foreground-hint">{formatMessage({ id: "apps.cap.add.moreLater" })}</p>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {error ? <Banner intent="warning" density="sm" data-testid="mcp-quick-add-error">{error}</Banner> : null}

        <DialogCardFooter className="items-center">
          <Button size="lg" variant="ghost" type="button" onClick={handleClose}>
            {formatMessage({ id: "common.confirm.cancel" })}
          </Button>
          <DialogCommit>
            {(inHead) => (
              <Button size={inHead ? "md" : "lg"} variant="primary" type="submit" disabled={!canAdd} data-testid="mcp-quick-add-submit">
                {submitting ? formatMessage({ id: "apps.cap.add.adding" }) : formatMessage({ id: needsSignIn && !signedIn ? "apps.cap.add.addAfterSignIn" : "apps.cap.add.submit" })}
              </Button>
            )}
          </DialogCommit>
        </DialogCardFooter>
      </form>
    </DialogCard>
  );
}
