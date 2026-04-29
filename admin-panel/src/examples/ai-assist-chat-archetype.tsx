/** Reference Editor Canvas (AI Chat) — full-bleed.
 *
 *  Demonstrates: EditorCanvas archetype, top bar + floating toolbar +
 *  collapsible right rail. Conversation thread, slash commands input,
 *  citation rendering, and inline action proposals (which respect the
 *  consent rule from the AI guardrails). */

import * as React from "react";
import { Sparkles, Send, Plus, Search, FileText, Settings } from "lucide-react";
import { Button } from "@/primitives/Button";
import { defineCustomView } from "@/builders";
import {
  EditorCanvas,
  CommandHints,
  WidgetShell,
  useArchetypeKeyboard,
  useUrlState,
} from "@/admin-archetypes";
import { cn } from "@/lib/cn";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  citations?: { label: string; href: string }[];
  proposed?: {
    label: string;
    description: string;
    /** When true, requires explicit consent before execution. */
    requiresConsent: boolean;
  }[];
}

const SAMPLE: Message[] = [
  {
    id: "m1",
    role: "user",
    text: "Summarise Acme's Q3 health and tell me what to do this week.",
  },
  {
    id: "m2",
    role: "assistant",
    text: "Acme is healthy overall (84/100), with three watch items: a stalled deal Q3-Renewal (18d), a customer-support backlog of 2 SLA-breach tickets, and a renewal in 5 months. I recommend three actions: (1) Send Q3 review pack today; (2) Reroute the SLA-breach tickets to senior support; (3) Schedule QBR with Maya for next week.",
    citations: [
      { label: "Deal Q3-Renewal", href: "#/crm/deals?filter=name:eq:Q3-Renewal" },
      { label: "Tickets · Acme", href: "#/support/queue?filter=company:eq:Acme" },
    ],
    proposed: [
      {
        label: "Send Q3 review pack",
        description: "Generates the brief, attaches latest metrics, queues for your review.",
        requiresConsent: true,
      },
      {
        label: "Schedule QBR with Maya",
        description: "Books a 60-min slot next week respecting both calendars.",
        requiresConsent: true,
      },
    ],
  },
  {
    id: "m3",
    role: "user",
    text: "/find similar deals to Q3-Renewal",
  },
  {
    id: "m4",
    role: "assistant",
    text: "Found 4 similar deals from the last 90 days. The most-similar is Globex-Q3 (won, 42d cycle, $84k). Patterns suggest the renewal should land in 28–42 days from current Negotiate stage.",
    citations: [
      { label: "Deal Globex-Q3", href: "#/crm/deals?filter=name:eq:Globex-Q3" },
    ],
  },
];

const SLASH_COMMANDS = [
  { id: "summarise", label: "/summarise", description: "Summarise the focused entity" },
  { id: "draft-email", label: "/draft email to", description: "Draft an email to a contact" },
  { id: "find-similar", label: "/find similar", description: "Find similar records" },
  { id: "query", label: "/query", description: "Ask a structured query" },
  { id: "run-skill", label: "/run skill", description: "Invoke a registered AI skill" },
];

export function AiAssistChatArchetype() {
  const [params, setParams] = useUrlState(["q"] as const);
  const draft = params.q ?? "";
  const [messages, setMessages] = React.useState<Message[]>(SAMPLE);
  const [showSlash, setShowSlash] = React.useState(false);
  const [thinking, setThinking] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = React.useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text },
    ]);
    setParams({ q: null }, true);
    setThinking(true);
    // Simulate latency.
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: `Got it — ${text}.\n\n(This is a demo. The real AI runtime would respond here.)`,
        },
      ]);
      setThinking(false);
    }, 700);
  }, [draft, setParams]);

  useArchetypeKeyboard([
    {
      label: "Focus input",
      combo: "/",
      run: () => {
        inputRef.current?.focus();
        setShowSlash(true);
      },
    },
    {
      label: "New chat",
      combo: "cmd+enter",
      run: () => send(),
    },
    {
      label: "Toggle slash menu",
      combo: "cmd+k",
      run: () => setShowSlash((v) => !v),
    },
  ]);

  return (
    <EditorCanvas
      id="ai-assist.chat"
      density="comfortable"
      topBar={
        <>
          <h1 className="flex items-center gap-2 text-sm font-semibold text-text-primary m-0">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden />
            Assistant
            <span className="text-text-muted font-normal">· scoped to your workspace</span>
          </h1>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" aria-label="Search">
              <Search className="h-4 w-4" aria-hidden />
            </Button>
            <Button size="sm" variant="ghost" aria-label="Settings">
              <Settings className="h-4 w-4" aria-hidden />
            </Button>
            <Button size="sm" onClick={() => { window.location.hash = "#/ai/assist/threads/new"; }}>
              <Plus className="h-4 w-4 mr-1" aria-hidden /> New chat
            </Button>
          </div>
        </>
      }
      rail={
        <div className="p-3 flex flex-col gap-3">
          <section>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
              Recent
            </div>
            <ul className="space-y-1 text-sm">
              <li className="px-2 py-1 rounded hover:bg-surface-2 cursor-pointer truncate text-text-primary">
                Acme Q3 health
              </li>
              <li className="px-2 py-1 rounded hover:bg-surface-2 cursor-pointer truncate text-text-muted">
                Forecast scenarios
              </li>
              <li className="px-2 py-1 rounded hover:bg-surface-2 cursor-pointer truncate text-text-muted">
                Inventory anomalies
              </li>
            </ul>
          </section>
          <section>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
              Sources used
            </div>
            <ul className="space-y-1 text-xs text-text-muted">
              <li className="flex items-center gap-1.5">
                <FileText className="h-3 w-3 shrink-0" aria-hidden />
                Acme · 2 records
              </li>
              <li className="flex items-center gap-1.5">
                <FileText className="h-3 w-3 shrink-0" aria-hidden />
                Tickets · 12 events
              </li>
            </ul>
          </section>
        </div>
      }
    >
      <div ref={scrollerRef} className="px-6 py-6 max-w-3xl mx-auto w-full overflow-auto">
        <WidgetShell
          label="Conversation"
          state={{ status: "ready" }}
          skeleton="list"
        >
          <ol role="log" aria-live="polite" className="space-y-4">
            {messages.map((m) => (
              <li key={m.id}>
                <Message msg={m} />
              </li>
            ))}
            {thinking && (
              <li>
                <ThinkingIndicator />
              </li>
            )}
          </ol>
        </WidgetShell>

        <div className="sticky bottom-0 mt-4 pt-3 bg-surface-canvas/85 backdrop-blur">
          <SlashMenu
            visible={showSlash}
            onPick={(cmd) => {
              setParams({ q: cmd + " " }, true);
              setShowSlash(false);
              inputRef.current?.focus();
            }}
          />
          <div className="rounded-xl border border-border bg-surface-0 shadow-sm p-2 flex items-end gap-2 focus-within:ring-2 focus-within:ring-accent">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => {
                setParams({ q: e.target.value }, true);
                if (e.target.value.startsWith("/")) setShowSlash(true);
                else setShowSlash(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder='Ask anything — try "/summarise"…'
              rows={2}
              className="flex-1 bg-transparent resize-none text-sm focus:outline-none px-2 py-1"
            />
            <Button
              size="sm"
              onClick={send}
              disabled={draft.trim().length === 0 || thinking}
              aria-label="Send"
            >
              <Send className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <CommandHints
            hints={[
              { keys: "/", label: "Slash menu" },
              { keys: "⌘↵", label: "Send" },
              { keys: "⌘K", label: "Commands" },
            ]}
            className="pt-2"
          />
        </div>
      </div>
    </EditorCanvas>
  );
}

function Message({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      <article
        className={cn(
          "rounded-2xl px-3.5 py-2.5 max-w-[75%] shadow-sm border",
          isUser
            ? "bg-accent text-accent-foreground border-accent"
            : "bg-surface-0 border-border",
        )}
      >
        {!isUser && (
          <div className="text-[10px] font-semibold uppercase tracking-wide text-accent mb-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3" aria-hidden /> Assistant
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
        {msg.citations && msg.citations.length > 0 && (
          <ol className="mt-2 flex flex-wrap gap-1">
            {msg.citations.map((c, i) => (
              <li key={i}>
                <a
                  href={c.href}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] hover:underline",
                    isUser ? "bg-accent-foreground/15" : "bg-surface-2 text-text-muted",
                  )}
                >
                  <FileText className="h-3 w-3" aria-hidden />
                  {c.label}
                </a>
              </li>
            ))}
          </ol>
        )}
        {msg.proposed && msg.proposed.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
              Proposed actions
            </div>
            {msg.proposed.map((p, i) => (
              <ProposedAction key={i} action={p} />
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

function ProposedAction({
  action,
}: {
  action: { label: string; description: string; requiresConsent: boolean };
}) {
  const [state, setState] = React.useState<"pending" | "approved" | "declined">("pending");
  return (
    <div
      className={cn(
        "rounded-lg border p-2 text-xs",
        state === "approved" && "bg-success-soft border-success/40 text-success-strong",
        state === "declined" && "bg-surface-1 border-border text-text-muted opacity-70",
        state === "pending" && "bg-info-soft border-info/40 text-info-strong",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{action.label}</div>
          <div className="opacity-80">{action.description}</div>
          {action.requiresConsent && state === "pending" && (
            <div className="opacity-80 mt-0.5">
              Requires your explicit approval — AI will not run this without consent.
            </div>
          )}
        </div>
        {state === "pending" ? (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setState("declined")}>
              Decline
            </Button>
            <Button size="sm" onClick={() => setState("approved")}>
              Approve
            </Button>
          </div>
        ) : state === "approved" ? (
          <span className="font-semibold whitespace-nowrap">Approved</span>
        ) : (
          <span className="font-semibold whitespace-nowrap">Declined</span>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl px-3.5 py-2.5 bg-surface-0 border border-border max-w-[75%]">
        <div className="flex items-center gap-1 text-text-muted text-sm">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-muted animate-pulse" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-muted animate-pulse [animation-delay:120ms]" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-muted animate-pulse [animation-delay:240ms]" />
          <span className="ml-1.5">Thinking…</span>
        </div>
      </div>
    </div>
  );
}

function SlashMenu({
  visible,
  onPick,
}: {
  visible: boolean;
  onPick: (cmd: string) => void;
}) {
  if (!visible) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-raised shadow-md p-1 mb-2 max-h-64 overflow-auto">
      {SLASH_COMMANDS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.label)}
          className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-1"
        >
          <span className="text-sm font-mono text-accent">{c.label}</span>
          <span className="text-xs text-text-muted">{c.description}</span>
        </button>
      ))}
    </div>
  );
}

export const aiAssistChatArchetypeView = defineCustomView({
  id: "ai-assist.archetype-chat.view",
  title: "AI chat (archetype)",
  description: "Reference Editor Canvas: full-bleed AI chat with proposed-action consent.",
  resource: "ai.run",
  archetype: "editor-canvas",
  fullBleed: true,
  density: "comfortable",
  render: () => <AiAssistChatArchetype />,
});

export const aiAssistChatArchetypeNav = [
  {
    id: "ai-assist.archetype-chat",
    label: "AI chat (archetype)",
    icon: "MessageSquare",
    path: "/ai/archetype-chat",
    view: "ai-assist.archetype-chat.view",
    section: "ai",
    order: 0.6,
  },
];
