import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { MessageCircle, Heart, Plus, Search, Pin, Lock, Users, AlertTriangle, Check, X, } from "lucide-react";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent } from "@/admin-primitives/Card";
import { PageGrid, Inline, Stack } from "@/admin-primitives/PageLayout";
import { StatCard } from "@/admin-primitives/StatCard";
import { PropertyList } from "@/admin-primitives/PropertyList";
import { TabBar } from "@/admin-primitives/TabBar";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { Avatar } from "@/primitives/Avatar";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Textarea } from "@/primitives/Textarea";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { usePosts, useReports, useSpaces } from "./data-hooks";
import { Spinner } from "@/primitives/Spinner";
import { navigateTo } from "@/views/useRoute";
/* ------------------------------------------------------------------------ */
export const communityFeedView = defineCustomView({
    id: "community.feed.view",
    title: "Feed",
    description: "The activity stream for your community.",
    resource: "community.post",
    render: () => _jsx(FeedPage, {}),
});
function FeedPage() {
    const { data: POSTS, loading } = usePosts();
    const { data: SPACES } = useSpaces();
    const [space, setSpace] = React.useState("all");
    const [draft, setDraft] = React.useState("");
    const [local, setLocal] = React.useState([]);
    if (loading && POSTS.length === 0)
        return _jsx(LoadingShell, {});
    const posts = [...local, ...POSTS];
    const setPosts = (fn) => setLocal((prev) => fn(prev));
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
        if (!draft.trim())
            return;
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
    return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Community feed", description: "The pulse of your workspace.", actions: _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(Plus, { className: "h-3.5 w-3.5" }), children: "New post" }) }), _jsx(Card, { children: _jsx(CardContent, { className: "pt-4", children: _jsxs(Inline, { gap: "gap-3", align: "start", children: [_jsx(Avatar, { name: "You", size: "md" }), _jsxs(Stack, { gap: "gap-2", className: "flex-1", children: [_jsx(Textarea, { placeholder: `What's on your mind${space !== "all" ? ` in ${space}` : ""}?`, value: draft, onChange: (e) => setDraft(e.target.value), rows: 2 }), _jsxs(Inline, { className: "justify-between", children: [_jsxs("span", { className: "text-xs text-text-muted", children: ["Posting to ", _jsx("span", { className: "text-text-secondary font-medium", children: space === "all" ? "General" : space })] }), _jsx(Button, { size: "sm", variant: "primary", disabled: !draft.trim(), onClick: post, children: "Post" })] })] })] }) }) }), _jsx(TabBar, { tabs: tabs, active: space, onChange: setSpace }), _jsx(Stack, { gap: "gap-3", children: filtered.length === 0 ? (_jsx(EmptyState, { title: "Nothing here yet", description: "Start the conversation." })) : (filtered.map((p) => _jsx(PostCard, { post: p }, p.id))) })] }));
}
function PostCard({ post }) {
    const [likes, setLikes] = React.useState(post.likes);
    const [liked, setLiked] = React.useState(false);
    return (_jsx(Card, { className: "transition-colors hover:border-border-strong", children: _jsx(CardContent, { className: "pt-4", children: _jsxs(Inline, { gap: "gap-3", align: "start", children: [_jsx(Avatar, { name: post.author, size: "md" }), _jsxs(Stack, { gap: "gap-2", className: "flex-1 min-w-0", children: [_jsxs(Inline, { gap: "gap-2", wrap: true, children: [_jsx("span", { className: "text-sm font-medium text-text-primary", children: post.author }), _jsx("span", { className: "text-xs text-text-muted", children: "in" }), _jsxs(Badge, { intent: "accent", children: ["# ", post.space] }), _jsx("span", { className: "text-xs text-text-muted", children: formatRelative(post.createdAt) }), post.pinned && (_jsxs(Inline, { gap: "gap-1", className: "text-xs text-intent-warning", children: [_jsx(Pin, { className: "h-3 w-3" }), " Pinned"] }))] }), _jsxs(Stack, { gap: "gap-1", children: [_jsx("div", { className: "text-base font-semibold text-text-primary", children: post.title }), _jsx("p", { className: "text-sm text-text-secondary leading-relaxed", children: post.body })] }), _jsxs(Inline, { gap: "gap-1", className: "pt-1", children: [_jsx(Button, { size: "xs", variant: "ghost", iconLeft: _jsx(Heart, { className: cn("h-3.5 w-3.5", liked && "fill-intent-danger text-intent-danger") }), onClick: () => {
                                            setLiked((v) => !v);
                                            setLikes((n) => n + (liked ? -1 : 1));
                                        }, children: likes }), _jsx(Button, { size: "xs", variant: "ghost", iconLeft: _jsx(MessageCircle, { className: "h-3.5 w-3.5" }), children: post.replies })] })] })] }) }) }));
}
/* ------------------------------------------------------------------------ */
export const communitySpacesView = defineCustomView({
    id: "community.spaces.view",
    title: "Spaces",
    description: "Channels for focused conversations.",
    resource: "community.space",
    render: () => _jsx(SpacesPage, {}),
});
function SpacesPage() {
    const { data: SPACES, loading } = useSpaces();
    const [q, setQ] = React.useState("");
    if (loading && SPACES.length === 0)
        return _jsx(LoadingShell, {});
    {
        const filtered = SPACES.filter((s) => !q ||
            s.name.toLowerCase().includes(q.toLowerCase()) ||
            s.description.toLowerCase().includes(q.toLowerCase()));
        return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Spaces", description: `${SPACES.length} spaces · ${SPACES.reduce((a, s) => a + s.members, 0).toLocaleString()} members`, actions: _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(Plus, { className: "h-3.5 w-3.5" }), children: "New space" }) }), _jsx("div", { className: "max-w-md", children: _jsx(Input, { prefix: _jsx(Search, { className: "h-3.5 w-3.5" }), placeholder: "Search spaces\u2026", value: q, onChange: (e) => setQ(e.target.value) }) }), _jsx(PageGrid, { columns: 3, children: filtered.map((s) => (_jsx(Card, { className: "transition-colors hover:border-accent cursor-pointer", onClick: () => navigateTo(`/community/spaces/${s.id}`), children: _jsxs(CardContent, { className: "pt-4", children: [_jsx("div", { className: "h-1 -mx-4 -mt-4 rounded-t-lg", style: { background: s.color }, "aria-hidden": true }), _jsxs(Stack, { gap: "gap-2", className: "pt-3", children: [_jsxs(Inline, { className: "justify-between", children: [_jsxs(Inline, { gap: "gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold", style: { background: s.color }, children: "#" }), _jsxs(Stack, { gap: "gap-0.5", children: [_jsx("div", { className: "text-sm font-semibold text-text-primary", children: s.name }), _jsxs("div", { className: "text-xs text-text-muted", children: ["@", s.handle] })] })] }), s.visibility === "private" ? (_jsxs(Badge, { intent: "warning", children: [_jsx(Lock, { className: "h-3 w-3 mr-0.5" }), " Private"] })) : (_jsx(Badge, { intent: "success", children: "Public" }))] }), _jsx("p", { className: "text-sm text-text-secondary line-clamp-2", children: s.description }), _jsxs(Inline, { gap: "gap-3", className: "pt-1 text-xs text-text-muted", children: [_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Users, { className: "h-3 w-3" }), s.members.toLocaleString(), " members"] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(MessageCircle, { className: "h-3 w-3" }), s.posts.toLocaleString(), " posts"] }), _jsxs("span", { className: "ml-auto", children: ["Active ", formatRelative(s.lastActive)] })] })] })] }) }, s.id))) })] }));
    }
}
/* ------------------------------------------------------------------------ */
export const communitySpaceDetailView = defineCustomView({
    id: "community.space-detail.view",
    title: "Space",
    description: "A single space with posts and members.",
    resource: "community.space",
    render: () => _jsx(SpaceDetailPage, {}),
});
function SpaceDetailPage() {
    const { data: SPACES, loading } = useSpaces();
    const { data: POSTS } = usePosts();
    const id = useRouteLastSegment();
    const [tab, setTab] = React.useState("posts");
    if (loading && SPACES.length === 0)
        return _jsx(LoadingShell, {});
    const space = SPACES.find((s) => s.id === id) ?? SPACES[0];
    if (!space) {
        return (_jsx(EmptyState, { title: "Space not found", description: `No space with id "${id}".` }));
    }
    const posts = POSTS.filter((p) => p.space === space.name);
    const tabs = [
        { id: "posts", label: "Posts", count: posts.length },
        { id: "members", label: "Members", count: space.members },
        { id: "settings", label: "Settings" },
    ];
    return (_jsxs(Stack, { children: [_jsx("div", { className: "h-2 -mx-6 rounded-b-lg", style: { background: space.color }, "aria-hidden": true }), _jsxs(Inline, { gap: "gap-3", align: "start", className: "pt-1", children: [_jsx("div", { className: "w-14 h-14 rounded-lg flex items-center justify-center text-white text-xl font-bold shrink-0", style: { background: space.color }, children: "#" }), _jsxs(Stack, { gap: "gap-1", className: "flex-1 min-w-0", children: [_jsxs(Inline, { gap: "gap-2", wrap: true, children: [_jsx("h1", { className: "text-xl font-semibold text-text-primary", children: space.name }), space.visibility === "private" ? (_jsxs(Badge, { intent: "warning", children: [_jsx(Lock, { className: "h-3 w-3 mr-0.5" }), " Private"] })) : (_jsx(Badge, { intent: "success", children: "Public" }))] }), _jsxs("div", { className: "text-sm text-text-secondary", children: ["@", space.handle] }), _jsx("div", { className: "text-sm text-text-muted max-w-xl", children: space.description }), _jsxs(Inline, { gap: "gap-4", className: "text-xs text-text-muted pt-1", children: [_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Users, { className: "h-3 w-3" }), space.members.toLocaleString(), " members"] }), _jsxs("span", { children: ["Active ", formatRelative(space.lastActive)] })] })] }), _jsxs(Inline, { gap: "gap-2", className: "shrink-0", children: [_jsx(Button, { variant: "secondary", size: "sm", children: "Invite" }), _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(Plus, { className: "h-3.5 w-3.5" }), children: "New post" })] })] }), _jsx(TabBar, { tabs: tabs, active: tab, onChange: setTab }), tab === "posts" && (_jsx(Stack, { gap: "gap-3", children: posts.length === 0 ? (_jsx(EmptyState, { title: "No posts yet", description: "Start the conversation." })) : (posts.map((p) => _jsx(PostCard, { post: p }, p.id))) })), tab === "members" && (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: Array.from({ length: 12 }, (_, i) => ({
                            id: `m_${i}`,
                            name: `Member ${i + 1}`,
                            role: i === 0 ? "Admin" : i < 3 ? "Moderator" : "Member",
                            joined: new Date(Date.now() - i * 14 * 86400_000).toISOString(),
                        })).map((m) => (_jsxs("li", { className: "flex items-center gap-3 px-4 py-2.5", children: [_jsx(Avatar, { name: m.name, size: "sm" }), _jsxs(Stack, { gap: "gap-0.5", className: "flex-1", children: [_jsx("span", { className: "text-sm font-medium text-text-primary", children: m.name }), _jsxs("span", { className: "text-xs text-text-muted", children: ["joined ", formatRelative(m.joined)] })] }), _jsx(Badge, { intent: m.role === "Admin" ? "danger" : m.role === "Moderator" ? "info" : "neutral", children: m.role })] }, m.id))) }) }) })), tab === "settings" && (_jsx(Card, { children: _jsx(CardContent, { className: "pt-4", children: _jsx(PropertyList, { columns: 2, items: [
                            { label: "Name", value: space.name },
                            { label: "Handle", value: `@${space.handle}` },
                            { label: "Visibility", value: space.visibility },
                            { label: "Members", value: space.members.toLocaleString() },
                            { label: "Posts", value: space.posts.toLocaleString() },
                            { label: "Last active", value: formatRelative(space.lastActive) },
                            { label: "Color", value: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx("span", { className: "w-4 h-4 rounded", style: { background: space.color } }), " ", space.color] }) },
                        ] }) }) }))] }));
}
/* ------------------------------------------------------------------------ */
export const communityModerationView = defineCustomView({
    id: "community.moderation.view",
    title: "Moderation",
    description: "Reported posts awaiting review.",
    resource: "community.post",
    render: () => _jsx(ModerationPage, {}),
});
function ModerationPage() {
    const { data: REPORTS, loading } = useReports();
    const [items, setItems] = React.useState([]);
    const [tab, setTab] = React.useState("open");
    // Load initial items from server, then manage locally for inline actions.
    React.useEffect(() => {
        if (REPORTS.length > 0 && items.length === 0)
            setItems(REPORTS);
    }, [REPORTS, items.length]);
    if (loading && REPORTS.length === 0)
        return _jsx(LoadingShell, {});
    const open = items.filter((i) => i.status === "open");
    const actioned = items.filter((i) => i.status === "actioned");
    const dismissed = items.filter((i) => i.status === "dismissed");
    const tabs = [
        { id: "open", label: "Open", count: open.length },
        { id: "actioned", label: "Actioned", count: actioned.length },
        { id: "dismissed", label: "Dismissed", count: dismissed.length },
    ];
    const selected = tab === "open" ? open : tab === "actioned" ? actioned : dismissed;
    const action = (id, next) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status: next } : x)));
    return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Moderation queue", description: "Review reported content. Action or dismiss." }), _jsxs(PageGrid, { columns: 4, children: [_jsx(StatCard, { label: "Open reports", value: open.length, intent: open.length > 0 ? "danger" : "success", icon: _jsx(AlertTriangle, { className: "h-3 w-3" }) }), _jsx(StatCard, { label: "High severity", value: open.filter((i) => i.severity === "high").length, intent: "danger" }), _jsx(StatCard, { label: "This week", value: items.length, secondary: "across all severities" }), _jsx(StatCard, { label: "Actioned", value: actioned.length, intent: "success" })] }), _jsx(TabBar, { tabs: tabs, active: tab, onChange: setTab }), selected.length === 0 ? (_jsx(EmptyState, { title: "Nothing here", description: "All caught up. Great work." })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: selected.map((m) => (_jsxs("li", { className: "flex items-center gap-3 px-4 py-3", children: [_jsx("div", { className: cn("w-9 h-9 rounded-md flex items-center justify-center shrink-0", m.severity === "high" && "bg-intent-danger-bg text-intent-danger", m.severity === "medium" && "bg-intent-warning-bg text-intent-warning", m.severity === "low" && "bg-surface-2 text-text-muted"), children: _jsx(AlertTriangle, { className: "h-4 w-4" }) }), _jsxs(Stack, { gap: "gap-0.5", className: "flex-1 min-w-0", children: [_jsxs(Inline, { gap: "gap-2", children: [_jsx("span", { className: "text-sm font-medium text-text-primary", children: m.target }), _jsx(Badge, { intent: m.severity === "high"
                                                        ? "danger"
                                                        : m.severity === "medium"
                                                            ? "warning"
                                                            : "neutral", children: m.severity })] }), _jsxs("span", { className: "text-xs text-text-muted", children: [m.reason, " \u00B7 reported by ", m.reportedBy, " \u00B7 ", formatRelative(m.reportedAt)] })] }), tab === "open" && (_jsxs(Inline, { gap: "gap-1", children: [_jsx(Button, { size: "sm", variant: "secondary", iconLeft: _jsx(Check, { className: "h-3.5 w-3.5" }), onClick: () => action(m.id, "actioned"), children: "Remove post" }), _jsx(Button, { size: "sm", variant: "ghost", iconLeft: _jsx(X, { className: "h-3.5 w-3.5" }), onClick: () => action(m.id, "dismissed"), children: "Dismiss" })] }))] }, m.id))) }) }) }))] }));
}
/* ------------------------------------------------------------------------ */
function LoadingShell() {
    return (_jsxs("div", { className: "h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted py-16", children: [_jsx(Spinner, { size: 14 }), "Loading\u2026"] }));
}
function useRouteLastSegment() {
    const [hash, setHash] = React.useState(() => typeof window === "undefined" ? "" : window.location.hash.slice(1));
    React.useEffect(() => {
        const on = () => setHash(window.location.hash.slice(1));
        window.addEventListener("hashchange", on);
        return () => window.removeEventListener("hashchange", on);
    }, []);
    const parts = hash.replace(/^\/+/, "").split("/").filter(Boolean);
    return parts[parts.length - 1];
}
