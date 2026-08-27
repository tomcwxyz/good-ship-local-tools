"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type UiMessage = { role: "user" | "assistant"; content: string };
type SpaceOption = { id: string; name: string; description?: string | null };
type DecisionCandidate = { title: string; proposedOutcome: string; whyItMayNeedDecision: string; evidence: string[]; suggestedReviewDate?: string };
type TraceEntry = { toolCallId: string; toolName: string; product: "Tending" | "Swells" | "Glade" | "Other"; kind: "read" | "write" | "review"; status: "pending" | "completed" | "declined" | "failed"; summary: string };
type PendingApproval = { toolCallId: string; toolName: string; product: string; title: string; detail: string; approveLabel: string; selectedSpaceId?: string; spaceOptions?: SpaceOption[]; reviewOnly?: boolean; decisionCandidate?: DecisionCandidate };
type Status = { mode: "direct-api" | "remote-mcp"; model: boolean; state: boolean; tending: boolean; swells: boolean; glade: boolean };

const starters = [
  "What seems to deserve attention across relationships, current signals and open decisions?",
  "Prepare me for my next important conversation. What should I remember and what wider changes might be relevant?",
  "What commitments or decisions look as though they may need following up?",
];

export default function Home() {
  const [key, setKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [state, setState] = useState<string>();
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [approvalSpaceId, setApprovalSpaceId] = useState("");
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.sessionStorage.getItem("attention-pilot-key");
    if (saved) { setKey(saved); setKeyInput(saved); void loadStatus(saved); }
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, pending, busy]);

  const configured = useMemo(() => status && status.model && status.state && status.tending && status.swells && status.glade, [status]);

  async function loadStatus(candidate: string) {
    setError("");
    const response = await fetch("/api/status", { headers: { "x-pilot-key": candidate } });
    if (!response.ok) {
      setStatus(null);
      setError(response.status === 401 ? "That pilot key was not accepted." : "Could not read pilot status.");
      return false;
    }
    setStatus(await response.json() as Status);
    return true;
  }

  async function unlock(event: FormEvent) {
    event.preventDefault();
    const candidate = keyInput.trim();
    if (candidate && await loadStatus(candidate)) {
      window.sessionStorage.setItem("attention-pilot-key", candidate);
      setKey(candidate);
    }
  }

  async function callAgent(body: Record<string, unknown>) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-pilot-key": key },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Agent request failed");
    return data as
      | { type: "message"; message: string; state: string; trace?: TraceEntry[] }
      | { type: "approval"; pending: PendingApproval; state: string; trace?: TraceEntry[] };
  }

  function absorb(data: Awaited<ReturnType<typeof callAgent>>) {
    setState(data.state);
    setTrace(data.trace ?? []);
    if (data.type === "approval") {
      setPending(data.pending);
      setApprovalSpaceId(data.pending.selectedSpaceId ?? data.pending.spaceOptions?.[0]?.id ?? "");
      return;
    }
    setPending(null);
    setApprovalSpaceId("");
    setMessages((current) => [...current, { role: "assistant", content: data.message }]);
  }

  async function send(text = input) {
    const message = text.trim();
    if (!message || busy || pending) return;
    setBusy(true); setError(""); setInput("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    try { absorb(await callAgent({ message, state })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function resolveApproval(approved: boolean) {
    if (!pending || !state || busy) return;
    setBusy(true); setError("");
    try {
      absorb(await callAgent({
        state,
        approval: {
          toolCallId: pending.toolCallId,
          approved,
          ...(approved && pending.toolName === "swells_create_observation" && approvalSpaceId ? { spaceId: approvalSpaceId } : {}),
        },
      }));
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  function clearConversation() {
    setMessages([]); setState(undefined); setPending(null); setApprovalSpaceId(""); setTrace([]); setError("");
  }

  if (!key) return (
    <main className="gate">
      <section className="gate-card">
        <p className="eyebrow">The Good Ship · experiment</p>
        <h1>attention</h1>
        <p className="lede">One agent across relationships, sensing and decisions.</p>
        <form onSubmit={unlock}>
          <label htmlFor="pilot-key">Pilot access key</label>
          <div className="gate-row">
            <input id="pilot-key" type="password" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} autoFocus />
            <button type="submit">Enter</button>
          </div>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="eyebrow">The Good Ship · experiment</p><h1>attention</h1></div>
        <button className="text-button" onClick={clearConversation}>Clear conversation</button>
      </header>

      <section className="question"><p>What deserves attention — and what should happen next?</p></section>
      <section className="status-row" aria-label="Connected capabilities">
        <StatusPill label="Tending" on={Boolean(status?.tending)} />
        <StatusPill label="Swells" on={Boolean(status?.swells)} />
        <StatusPill label="Glade" on={Boolean(status?.glade)} />
        <span className="mode">{status?.mode === "remote-mcp" ? "remote MCP" : "cloud APIs"}</span>
      </section>

      {!configured && <section className="warning"><strong>The cloud pilot is not fully configured.</strong> Check the deployment environment variables before testing.</section>}

      <section className="conversation">
        {messages.length === 0 && !pending && (
          <div className="welcome">
            <h2>Ask about the work, not the apps.</h2>
            <p>The agent can draw on relationship memory in Tending, sensing in Swells and governance context in Glade, then tell you what seems worth noticing or doing.</p>
            <div className="starters">{starters.map((starter) => <button key={starter} onClick={() => void send(starter)}>{starter}</button>)}</div>
          </div>
        )}

        {messages.map((message, index) => (
          <article className={`message ${message.role}`} key={index}>
            <div className="message-label">{message.role === "user" ? "You" : "Attention"}</div>
            <div className="message-body">{message.content}</div>
          </article>
        ))}

        {pending && (
          <article className="approval">
            <div className="approval-product">{pending.product}</div>
            <h3>{pending.title}</h3><p>{pending.detail}</p>
            {pending.toolName === "glade_draft_decision_candidate" && pending.decisionCandidate ? (
              <div className="decision-candidate">
                <div><span>Decision</span><strong>{pending.decisionCandidate.title}</strong></div>
                <div><span>Proposed outcome</span><p>{pending.decisionCandidate.proposedOutcome}</p></div>
                <div><span>Why this needs a decision</span><p>{pending.decisionCandidate.whyItMayNeedDecision}</p></div>
                {pending.decisionCandidate.evidence.length ? (
                  <div><span>Evidence</span><ul>{pending.decisionCandidate.evidence.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
                ) : null}
                {pending.decisionCandidate.suggestedReviewDate ? (
                  <div><span>Suggested review</span><p>{pending.decisionCandidate.suggestedReviewDate}</p></div>
                ) : null}
              </div>
            ) : null}
            {pending.toolName === "swells_create_observation" && pending.spaceOptions?.length ? (
              <div className="approval-destination">
                <label htmlFor="approval-space">Keep in space</label>
                <select
                  id="approval-space"
                  value={approvalSpaceId}
                  onChange={(event) => setApprovalSpaceId(event.target.value)}
                  disabled={busy}
                >
                  {pending.spaceOptions.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
                </select>
                {pending.spaceOptions.find((space) => space.id === approvalSpaceId)?.description ? (
                  <p className="approval-destination-note">{pending.spaceOptions.find((space) => space.id === approvalSpaceId)?.description}</p>
                ) : null}
              </div>
            ) : null}
            <div className="approval-actions">
              <button className="primary" disabled={busy} onClick={() => void resolveApproval(true)}>{pending.approveLabel}</button>
              <button className="secondary" disabled={busy} onClick={() => void resolveApproval(false)}>Not now</button>
            </div>
          </article>
        )}

        {busy && <div className="thinking">Looking across the connected context…</div>}
        {error && <div className="error banner">{error}</div>}
        <div ref={endRef} />
      </section>

      {trace.length > 0 && (
        <details className="trace-panel">
          <summary>Evaluation trace <span>{trace.length} tool step{trace.length === 1 ? "" : "s"}</span></summary>
          <div className="trace-list">
            {trace.map((entry) => (
              <div className="trace-row" key={entry.toolCallId}>
                <div className="trace-meta">
                  <span className="trace-product">{entry.product}</span>
                  <span>{entry.kind}</span>
                  <span className={`trace-status ${entry.status}`}>{traceStatusLabel(entry)}</span>
                </div>
                <div className="trace-summary">{entry.summary}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      <form className="composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
          placeholder={pending ? "Resolve the proposal above first…" : "Tell me what is happening, or ask what deserves attention…"}
          disabled={busy || Boolean(pending)}
          rows={3}
        />
        <button type="submit" disabled={busy || Boolean(pending) || !input.trim()}>Send</button>
      </form>
      <footer>Durable records stay in their products. Reads can happen automatically; writes and decision candidates stop for review.</footer>
    </main>
  );
}

function traceStatusLabel(entry: TraceEntry) {
  if (entry.status === "declined") return "declined";
  if (entry.status === "failed") return "failed";
  if (entry.status === "pending") return entry.kind === "review" ? "awaiting review" : entry.kind === "write" ? "awaiting approval" : "pending";
  if (entry.kind === "write") return "written";
  if (entry.kind === "review") return "reviewed";
  return "read";
}

function StatusPill({ label, on }: { label: string; on: boolean }) {
  return <span className={`status-pill ${on ? "on" : "off"}`}><span className="dot" />{label}</span>;
}
