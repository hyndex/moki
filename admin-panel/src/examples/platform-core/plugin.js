import { jsx as _jsx } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { definePlugin } from "@/contracts/plugin-v2";
import { HomeOverviewPage, NotificationsInboxPage, OnboardingPage, ProfilePage, ReleaseNotesPage, SearchResultsPage, SettingsPage, SignInPreviewPage, SignUpPreviewPage, } from "./components";
import { WorkspaceHomePage } from "./WorkspaceHome";
import { StandardReportsPage, StandardReportPage } from "./StandardReports";
import { TenantManagementPage } from "./TenantManagement";
/** Platform-core plugin — cross-cutting pages that don't belong to any one
 *  domain: global home, settings hub, profile, search, notifications inbox,
 *  onboarding wizard, auth previews, release notes. */
const platformCoreNavSections = [{ id: "__home", label: "", order: 0 }];
const platformCoreNav = [
    {
        id: "platform.home",
        label: "Home",
        icon: "Home",
        path: "/home",
        view: "platform.home.view",
        order: -100,
    },
    {
        id: "platform.notifications",
        label: "Inbox",
        icon: "Inbox",
        path: "/notifications",
        view: "platform.notifications.view",
        section: "platform",
        order: 95,
    },
    {
        id: "platform.search",
        label: "Search",
        icon: "Search",
        path: "/search",
        view: "platform.search.view",
        section: "platform",
        order: 98,
    },
    {
        id: "platform.reports",
        label: "Reports",
        icon: "FileBarChart",
        path: "/reports",
        view: "platform.reports.view",
        section: "platform",
        order: 97,
    },
    {
        id: "platform.tenants",
        label: "Tenants",
        icon: "Building2",
        path: "/platform/tenants",
        view: "platform.tenants.view",
        section: "platform",
        order: 96,
    },
    {
        id: "platform.settings",
        label: "Settings",
        icon: "Settings",
        path: "/settings",
        view: "platform.settings.view",
        section: "platform",
        order: 99,
    },
    {
        id: "platform.profile",
        label: "Your profile",
        icon: "User",
        path: "/profile",
        view: "platform.profile.view",
        section: "platform",
        order: 99.5,
    },
    {
        id: "platform.onboarding",
        label: "Onboarding",
        icon: "Rocket",
        path: "/onboarding",
        view: "platform.onboarding.view",
        section: "platform",
        order: 99.7,
    },
    {
        id: "platform.release-notes",
        label: "Release notes",
        icon: "Megaphone",
        path: "/release-notes",
        view: "platform.release-notes.view",
        section: "platform",
        order: 99.8,
    },
    {
        id: "platform.signin",
        label: "Sign-in preview",
        icon: "LogIn",
        path: "/preview/signin",
        view: "platform.signin.view",
        section: "platform",
        order: 99.9,
    },
    {
        id: "platform.signup",
        label: "Sign-up preview",
        icon: "UserPlus",
        path: "/preview/signup",
        view: "platform.signup.view",
        section: "platform",
        order: 99.91,
    },
];
const platformCoreViews = [
    defineCustomView({
        id: "platform.home.view",
        title: "Home",
        resource: "platform.home",
        render: () => _jsx(WorkspaceHomePage, {}),
    }),
    defineCustomView({
        id: "platform.home.legacy.view",
        title: "Home (legacy)",
        resource: "platform.home",
        render: () => _jsx(HomeOverviewPage, {}),
    }),
    defineCustomView({
        id: "platform.reports.view",
        title: "Reports",
        resource: "platform.reports",
        render: () => _jsx(StandardReportsPage, {}),
    }),
    defineCustomView({
        id: "platform.reports.detail.view",
        title: "Report",
        resource: "platform.reports",
        render: () => _jsx(StandardReportPage, {}),
    }),
    defineCustomView({
        id: "platform.tenants.view",
        title: "Tenants",
        resource: "platform.tenant",
        render: () => _jsx(TenantManagementPage, {}),
    }),
    defineCustomView({
        id: "platform.notifications.view",
        title: "Notifications",
        resource: "platform.notifications",
        render: () => _jsx(NotificationsInboxPage, {}),
    }),
    defineCustomView({
        id: "platform.search.view",
        title: "Search",
        resource: "platform.search",
        render: () => _jsx(SearchResultsPage, {}),
    }),
    defineCustomView({
        id: "platform.settings.view",
        title: "Settings",
        resource: "platform.settings",
        render: () => _jsx(SettingsPage, {}),
    }),
    defineCustomView({
        id: "platform.profile.view",
        title: "Profile",
        resource: "platform.profile",
        render: () => _jsx(ProfilePage, {}),
    }),
    defineCustomView({
        id: "platform.onboarding.view",
        title: "Onboarding",
        resource: "platform.onboarding",
        render: () => _jsx(OnboardingPage, {}),
    }),
    defineCustomView({
        id: "platform.release-notes.view",
        title: "Release notes",
        resource: "platform.release-notes",
        render: () => _jsx(ReleaseNotesPage, {}),
    }),
    defineCustomView({
        id: "platform.signin.view",
        title: "Sign-in preview",
        resource: "platform.signin",
        render: () => _jsx(SignInPreviewPage, {}),
    }),
    defineCustomView({
        id: "platform.signup.view",
        title: "Sign-up preview",
        resource: "platform.signup",
        render: () => _jsx(SignUpPreviewPage, {}),
    }),
];
const platformCoreCommands = [
    {
        id: "platform.goto.home",
        label: "Go to Home",
        icon: "Home",
        keywords: ["overview", "dashboard"],
        shortcut: "G H",
        run: () => {
            window.location.hash = "/home";
        },
    },
    {
        id: "platform.goto.settings",
        label: "Open Settings",
        icon: "Settings",
        shortcut: "⌘,",
        run: () => {
            window.location.hash = "/settings";
        },
    },
    {
        id: "platform.goto.notifications",
        label: "Open Inbox",
        icon: "Inbox",
        run: () => {
            window.location.hash = "/notifications";
        },
    },
    {
        id: "platform.goto.search",
        label: "Search everything",
        icon: "Search",
        run: () => {
            window.location.hash = "/search";
        },
    },
];
export const platformCorePlugin = definePlugin({
    manifest: {
        id: "platform-core",
        version: "0.1.0",
        label: "Platform Core",
        description: "Cross-plugin shell pages — home, settings, profile, search, notifications, auth previews.",
        icon: "Sparkles",
        requires: {
            shell: "*",
            capabilities: ["nav", "commands"],
        },
        activationEvents: [{ kind: "onStart" }],
        origin: { kind: "explicit" },
    },
    async activate(ctx) {
        ctx.contribute.navSections(platformCoreNavSections);
        ctx.contribute.nav(platformCoreNav);
        ctx.contribute.views(platformCoreViews);
        ctx.contribute.commands(platformCoreCommands);
    },
});
