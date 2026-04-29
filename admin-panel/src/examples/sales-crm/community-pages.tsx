import * as React from "react";
import {
  MessageCircle,
  Heart,
  Plus,
  Search,
  Pin,
  Lock,
  Users,
  AlertTriangle,
  Check,
  X,
  ArrowUpRight,
} from "lucide-react";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/admin-primitives/Card";
import { PageGrid, Col, Section, Inline, Stack } from "@/admin-primitives/PageLayout";
import { StatCard } from "@/admin-primitives/StatCard";
import { PropertyList } from "@/admin-primitives/PropertyList";
import { TabBar } from "@/admin-primitives/TabBar";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { Timeline } from "@/admin-primitives/Timeline";
import { Avatar } from "@/primitives/Avatar";
import { AvatarGroup } from "@/primitives/AvatarGroup";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Textarea } from "@/primitives/Textarea";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { type CommunityPost } from "./data";
import { usePosts, useReports, useSpaces } from "./data-hooks";
import { Spinner } from "@/primitives/Spinner";
import { navigateTo } from "@/views/useRoute";

/* ------------------------------------------------------------------------ */

export const communityFeedView = defineCustomView({
  id: "community.feed.view",
  title: "Feed",
  description: "The activity stream for your community.",
  resource: "community.post",
  render: () => <FeedPage />,
});

function FeedPage() {
  const { data: POSTS, loading } = usePosts();
  const { data: SPACES } = useSpaces();
  const [space, setSpace] = React.useState("all");
  const [draft, setDraft] = React.useState("");
  const [local, setLocal] = React.useState<CommunityPost[]>([]);
  // Inline composer ref so the header "New post" button focuses the
  // textarea below instead of being a no-op (the inline composer IS
  // the new-post UI on this page; the header button just acts as an
  // affordance that scrolls + focuses it). Declared BEFORE the
  // early-return so the hook order is stable across the loading→loaded
  // transition; previously useRef sat below the early-return and React
  // logged a Rules-of-Hooks violation.
  const composerRef = React.useRef<HTMLTextAreaElement>(null);

  if (loading && POSTS.length === 0) return <LoadingShell />;

  const posts = [...local, ...POSTS];
  const setPosts = (fn: (prev: CommunityPost[]) => CommunityPost[]) =>
    setLocal((prev) => fn(prev));

  const tabs = [
    { id: "all", label: "All spaces", count: posts.length },
    ...SPACES.slice(0, 5).map((s) => ({
      id: s.name,
      label: s.name,
      count: posts.filter((p) => p.space === s.name).length,
    })),
  ];

  const filtered = posts.filter((p) => space === "all" || p.space === space);

  const post = () => {
    if (!draft.trim()) return;
    setPosts((prev) => [
      {
        id: `p_new_${Date.now()}`,
        author: "You",
        space: space === "all" ? "General" : space,
        title: draft.trim().slice(0, 60),
        body: draft.trim(),
        createdAt: new Date().toISOString(),
        replies: 0,
        likes: 0,
      },
      ...prev,
    ]);
    setDraft("");
  };

  return (
    <Stack>
      <PageHeader
        title="Community feed"
        description="The pulse of your workspace."
        actions={
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="h-3.5 w-3.5" />}
            onClick={() => {
              composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              composerRef.current?.focus();
            }}
          >
            New post
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-4">
          <Inline gap="gap-3" align="start">
            <Avatar name="You" size="md" />
            <Stack gap="gap-2" className="flex-1">
              <Textarea
                ref={composerRef}
                placeholder={`What's on your mind${space !== "all" ? ` in ${space}` : ""}?`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
              />
              <Inline className="justify-between">
                <span className="text-xs text-text-muted">
                  Posting to <span className="text-text-secondary font-medium">{space === "all" ? "General" : space}</span>
                </span>
                <Button size="sm" variant="primary" disabled={!draft.trim()} onClick={post}>
                  Post
                </Button>
              </Inline>
            </Stack>
          </Inline>
        </CardContent>
      </Card>

      <TabBar tabs={tabs} active={space} onChange={setSpace} />

      <Stack gap="gap-3">
        {filtered.length === 0 ? (
          <EmptyState title="Nothing here yet" description="Start the conversation." />
        ) : (
          filtered.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </Stack>
    </Stack>
  );
}

function PostCard({ post }: { post: CommunityPost }) {
  const [likes, setLikes] = React.useState(post.likes);
  const [liked, setLiked] = React.useState(false);
  return (
    <Card className="transition-colors hover:border-border-strong">
      <CardContent className="pt-4">
        <Inline gap="gap-3" align="start">
          <Avatar name={post.author} size="md" />
          <Stack gap="gap-2" className="flex-1 min-w-0">
            <Inline gap="gap-2" wrap>
              <span className="text-sm font-medium text-text-primary">{post.author}</span>
              <span className="text-xs text-text-muted">in</span>
              <Badge intent="accent"># {post.space}</Badge>
              <span className="text-xs text-text-muted">{formatRelative(post.createdAt)}</span>
              {post.pinned && (
                <Inline gap="gap-1" className="text-xs text-intent-warning">
                  <Pin className="h-3 w-3" /> Pinned
                </Inline>
              )}
            </Inline>
            <Stack gap="gap-1">
              <div className="text-base font-semibold text-text-primary">
                {post.title}
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {post.body}
              </p>
            </Stack>
            <Inline gap="gap-1" className="pt-1">
              <Button
                size="xs"
                variant="ghost"
                iconLeft={
                  <Heart
                    className={cn(
                      "h-3.5 w-3.5",
                      liked && "fill-intent-danger text-intent-danger",
                    )}
                  />
                }
                onClick={() => {
                  setLiked((v) => !v);
                  setLikes((n) => n + (liked ? -1 : 1));
                }}
              >
                {likes}
              </Button>
              <Button
                size="xs"
                variant="ghost"
                iconLeft={<MessageCircle className="h-3.5 w-3.5" />}
              >
                {post.replies}
              </Button>
            </Inline>
          </Stack>
        </Inline>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------------ */

export const communitySpacesView = defineCustomView({
  id: "community.spaces.view",
  title: "Spaces",
  description: "Channels for focused conversations.",
  resource: "community.space",
  render: () => <SpacesPage />,
});

function SpacesPage() {
  const { data: SPACES, loading } = useSpaces();
  const [q, setQ] = React.useState("");
  if (loading && SPACES.length === 0) return <LoadingShell />;
  {
    const filtered = SPACES.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q.toLowerCase()) ||
        s.description.toLowerCase().includes(q.toLowerCase()),
    );
    return (
      <Stack>
        <PageHeader
          title="Spaces"
          description={`${SPACES.length} spaces · ${SPACES.reduce((a, s) => a + s.members, 0).toLocaleString()} members`}
          actions={
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus className="h-3.5 w-3.5" />}
              onClick={() => navigateTo("/community/spaces/new")}
            >
              New space
            </Button>
          }
        />
        <div className="max-w-md">
          <Input
            prefix={<Search className="h-3.5 w-3.5" />}
            placeholder="Search spaces…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <PageGrid columns={3}>
          {filtered.map((s) => (
            <Card
              key={s.id}
              className="transition-colors hover:border-accent cursor-pointer"
              onClick={() => navigateTo(`/community/spaces/${s.id}`)}
            >
              <CardContent className="pt-4">
                <div
                  className="h-1 -mx-4 -mt-4 rounded-t-lg"
                  style={{ background: s.color }}
                  aria-hidden
                />
                <Stack gap="gap-2" className="pt-3">
                  <Inline className="justify-between">
                    <Inline gap="gap-2">
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: s.color }}
                      >
                        #
                      </div>
                      <Stack gap="gap-0.5">
                        <div className="text-sm font-semibold text-text-primary">
                          {s.name}
                        </div>
                        <div className="text-xs text-text-muted">@{s.handle}</div>
                      </Stack>
                    </Inline>
                    {s.visibility === "private" ? (
                      <Badge intent="warning">
                        <Lock className="h-3 w-3 mr-0.5" /> Private
                      </Badge>
                    ) : (
                      <Badge intent="success">Public</Badge>
                    )}
                  </Inline>
                  <p className="text-sm text-text-secondary line-clamp-2">
                    {s.description}
                  </p>
                  <Inline gap="gap-3" className="pt-1 text-xs text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {s.members.toLocaleString()} members
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {s.posts.toLocaleString()} posts
                    </span>
                    <span className="ml-auto">
                      Active {formatRelative(s.lastActive)}
                    </span>
                  </Inline>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </PageGrid>
      </Stack>
    );
  }
}

/* ------------------------------------------------------------------------ */

export const communitySpaceDetailView = defineCustomView({
  id: "community.space-detail.view",
  title: "Space",
  description: "A single space with posts and members.",
  resource: "community.space",
  render: () => <SpaceDetailPage />,
});

function SpaceDetailPage() {
  const { data: SPACES, loading } = useSpaces();
  const { data: POSTS } = usePosts();
  const id = useRouteLastSegment();
  const [tab, setTab] = React.useState("posts");

  if (loading && SPACES.length === 0) return <LoadingShell />;

  const space = SPACES.find((s) => s.id === id) ?? SPACES[0];
  if (!space) {
    return (
      <EmptyState
        title="Space not found"
        description={`No space with id "${id}".`}
      />
    );
  }
  const posts = POSTS.filter((p) => p.space === space.name);

  const tabs = [
    { id: "posts", label: "Posts", count: posts.length },
    { id: "members", label: "Members", count: space.members },
    { id: "settings", label: "Settings" },
  ];

  return (
    <Stack>
      <div
        className="h-2 -mx-6 rounded-b-lg"
        style={{ background: space.color }}
        aria-hidden
      />
      <Inline gap="gap-3" align="start" className="pt-1">
        <div
          className="w-14 h-14 rounded-lg flex items-center justify-center text-white text-xl font-bold shrink-0"
          style={{ background: space.color }}
        >
          #
        </div>
        <Stack gap="gap-1" className="flex-1 min-w-0">
          <Inline gap="gap-2" wrap>
            <h1 className="text-xl font-semibold text-text-primary">
              {space.name}
            </h1>
            {space.visibility === "private" ? (
              <Badge intent="warning">
                <Lock className="h-3 w-3 mr-0.5" /> Private
              </Badge>
            ) : (
              <Badge intent="success">Public</Badge>
            )}
          </Inline>
          <div className="text-sm text-text-secondary">@{space.handle}</div>
          <div className="text-sm text-text-muted max-w-xl">
            {space.description}
          </div>
          <Inline gap="gap-4" className="text-xs text-text-muted pt-1">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {space.members.toLocaleString()} members
            </span>
            <span>Active {formatRelative(space.lastActive)}</span>
          </Inline>
        </Stack>
        <Inline gap="gap-2" className="shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigateTo(`/community/spaces/${space.id}/invite`)}
          >
            Invite
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="h-3.5 w-3.5" />}
            onClick={() => navigateTo("/community/feed")}
          >
            New post
          </Button>
        </Inline>
      </Inline>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {tab === "posts" && (
        <Stack gap="gap-3">
          {posts.length === 0 ? (
            <EmptyState title="No posts yet" description="Start the conversation." />
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </Stack>
      )}

      {tab === "members" && (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border-subtle">
              {Array.from({ length: 12 }, (_, i) => ({
                id: `m_${i}`,
                name: `Member ${i + 1}`,
                role: i === 0 ? "Admin" : i < 3 ? "Moderator" : "Member",
                joined: new Date(Date.now() - i * 14 * 86400_000).toISOString(),
              })).map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={m.name} size="sm" />
                  <Stack gap="gap-0.5" className="flex-1">
                    <span className="text-sm font-medium text-text-primary">{m.name}</span>
                    <span className="text-xs text-text-muted">joined {formatRelative(m.joined)}</span>
                  </Stack>
                  <Badge
                    intent={m.role === "Admin" ? "danger" : m.role === "Moderator" ? "info" : "neutral"}
                  >
                    {m.role}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {tab === "settings" && (
        <Card>
          <CardContent className="pt-4">
            <PropertyList
              columns={2}
              items={[
                { label: "Name", value: space.name },
                { label: "Handle", value: `@${space.handle}` },
                { label: "Visibility", value: space.visibility },
                { label: "Members", value: space.members.toLocaleString() },
                { label: "Posts", value: space.posts.toLocaleString() },
                { label: "Last active", value: formatRelative(space.lastActive) },
                { label: "Color", value: <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded" style={{ background: space.color }} /> {space.color}</span> },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------------ */

export const communityModerationView = defineCustomView({
  id: "community.moderation.view",
  title: "Moderation",
  description: "Reported posts awaiting review.",
  resource: "community.post",
  render: () => <ModerationPage />,
});

function ModerationPage() {
  const { data: REPORTS, loading } = useReports();
  const [items, setItems] = React.useState<typeof REPORTS>([]);
  const [tab, setTab] = React.useState("open");
  // Load initial items from server, then manage locally for inline actions.
  React.useEffect(() => {
    if (REPORTS.length > 0 && items.length === 0) setItems(REPORTS);
  }, [REPORTS, items.length]);

  if (loading && REPORTS.length === 0) return <LoadingShell />;

  const open = items.filter((i) => i.status === "open");
  const actioned = items.filter((i) => i.status === "actioned");
  const dismissed = items.filter((i) => i.status === "dismissed");

  const tabs = [
    { id: "open", label: "Open", count: open.length },
    { id: "actioned", label: "Actioned", count: actioned.length },
    { id: "dismissed", label: "Dismissed", count: dismissed.length },
  ];

  const selected = tab === "open" ? open : tab === "actioned" ? actioned : dismissed;

  const action = (id: string, next: "actioned" | "dismissed") =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status: next } : x)));

  return (
    <Stack>
      <PageHeader
        title="Moderation queue"
        description="Review reported content. Action or dismiss."
      />

      <PageGrid columns={4}>
        <StatCard
          label="Open reports"
          value={open.length}
          intent={open.length > 0 ? "danger" : "success"}
          icon={<AlertTriangle className="h-3 w-3" />}
        />
        <StatCard
          label="High severity"
          value={open.filter((i) => i.severity === "high").length}
          intent="danger"
        />
        <StatCard
          label="This week"
          value={items.length}
          secondary="across all severities"
        />
        <StatCard
          label="Actioned"
          value={actioned.length}
          intent="success"
        />
      </PageGrid>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {selected.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="All caught up. Great work."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border-subtle">
              {selected.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-md flex items-center justify-center shrink-0",
                      m.severity === "high" && "bg-intent-danger-bg text-intent-danger",
                      m.severity === "medium" && "bg-intent-warning-bg text-intent-warning",
                      m.severity === "low" && "bg-surface-2 text-text-muted",
                    )}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <Stack gap="gap-0.5" className="flex-1 min-w-0">
                    <Inline gap="gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {m.target}
                      </span>
                      <Badge
                        intent={
                          m.severity === "high"
                            ? "danger"
                            : m.severity === "medium"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {m.severity}
                      </Badge>
                    </Inline>
                    <span className="text-xs text-text-muted">
                      {m.reason} · reported by {m.reportedBy} · {formatRelative(m.reportedAt)}
                    </span>
                  </Stack>
                  {tab === "open" && (
                    <Inline gap="gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        iconLeft={<Check className="h-3.5 w-3.5" />}
                        onClick={() => action(m.id, "actioned")}
                      >
                        Remove post
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        iconLeft={<X className="h-3.5 w-3.5" />}
                        onClick={() => action(m.id, "dismissed")}
                      >
                        Dismiss
                      </Button>
                    </Inline>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------------ */

function LoadingShell() {
  return (
    <div className="h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted py-16">
      <Spinner size={14} />
      Loading…
    </div>
  );
}

function useRouteLastSegment(): string | undefined {
  const [hash, setHash] = React.useState(() =>
    typeof window === "undefined" ? "" : window.location.hash.slice(1),
  );
  React.useEffect(() => {
    const on = () => setHash(window.location.hash.slice(1));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const parts = hash.replace(/^\/+/, "").split("/").filter(Boolean);
  return parts[parts.length - 1];
}
