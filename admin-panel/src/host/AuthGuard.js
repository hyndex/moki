import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { Globe, LogIn } from "lucide-react";
import { authStore, login, signup, verifySession, fetchMemberships, fetchPlatformConfig, ApiError, } from "@/runtime/auth";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Checkbox } from "@/primitives/Checkbox";
import { FormField } from "@/admin-primitives/FormField";
import { Card, CardContent } from "@/admin-primitives/Card";
import { Spinner } from "@/primitives/Spinner";
import { cn } from "@/lib/cn";
/** Gates the admin behind sign-in. Keeps the user signed-in across reloads
 *  via localStorage. Verifies the token against the backend on mount, so a
 *  server-side session revocation takes effect on the next page load. */
export function AuthGuard({ children }) {
    const [ready, setReady] = React.useState(false);
    const [signedIn, setSignedIn] = React.useState(authStore.isSignedIn);
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            if (authStore.token) {
                await verifySession();
                if (authStore.isSignedIn) {
                    // Load tenant memberships + platform config in parallel — populates
                    // the WorkspaceSwitcher before the shell renders.
                    await Promise.allSettled([fetchMemberships(), fetchPlatformConfig()]);
                }
            }
            if (!cancelled) {
                setSignedIn(authStore.isSignedIn);
                setReady(true);
            }
        })();
        const off = authStore.emitter.on("change", () => {
            setSignedIn(authStore.isSignedIn);
        });
        return () => {
            cancelled = true;
            off();
        };
    }, []);
    if (!ready) {
        return (_jsxs("div", { className: "h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted", children: [_jsx(Spinner, { size: 14 }), "Checking session\u2026"] }));
    }
    if (!signedIn)
        return _jsx(SignInScreen, {});
    return _jsx(_Fragment, { children: children });
}
function SignInScreen() {
    const [mode, setMode] = React.useState("signin");
    const [email, setEmail] = React.useState("chinmoy@gutu.dev");
    const [password, setPassword] = React.useState("password");
    const [name, setName] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);
    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            if (mode === "signin")
                await login(email.trim(), password);
            else
                await signup(email.trim(), name.trim(), password);
        }
        catch (err) {
            if (err instanceof ApiError) {
                const body = err.body;
                setError(err.status === 401
                    ? "Incorrect email or password."
                    : body?.error ?? err.message);
            }
            else {
                setError(err instanceof Error ? err.message : "Something went wrong.");
            }
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx("div", { className: "h-full w-full flex items-center justify-center p-6 bg-surface-1", children: _jsx(Card, { className: "w-full max-w-sm", children: _jsx(CardContent, { className: "py-8 px-6", children: _jsxs("form", { onSubmit: submit, className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("div", { className: "w-8 h-8 rounded-md bg-accent text-accent-fg flex items-center justify-center font-bold", "aria-hidden": true, children: "G" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-text-primary", children: "Gutu" }), _jsx("div", { className: "text-xs text-text-muted", children: mode === "signin" ? "Sign in to your workspace" : "Create a new account" })] })] }), mode === "signup" && (_jsx(FormField, { label: "Full name", children: _jsx(Input, { value: name, onChange: (e) => setName(e.target.value), placeholder: "Ada Lovelace", required: true, autoComplete: "name" }) })), _jsx(FormField, { label: "Email", children: _jsx(Input, { type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, autoComplete: mode === "signin" ? "username" : "email" }) }), _jsx(FormField, { label: "Password", children: _jsx(Input, { type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: mode === "signup" ? 6 : undefined, autoComplete: mode === "signin" ? "current-password" : "new-password" }) }), error && (_jsx("div", { className: "text-xs text-intent-danger bg-intent-danger-bg border border-intent-danger/30 rounded-md px-2 py-1.5", children: error })), mode === "signin" && (_jsxs("label", { className: "inline-flex items-center gap-2 text-xs text-text-secondary", children: [_jsx(Checkbox, { defaultChecked: true }), " Keep me signed in"] })), _jsx(Button, { type: "submit", variant: "primary", size: "lg", loading: busy, iconLeft: _jsx(LogIn, { className: "h-3.5 w-3.5" }), children: mode === "signin" ? "Sign in" : "Create workspace" }), _jsxs("div", { className: "flex items-center gap-2 py-1", children: [_jsx("div", { className: "flex-1 h-px bg-border-subtle" }), _jsx("span", { className: "text-xs text-text-muted", children: "or" }), _jsx("div", { className: "flex-1 h-px bg-border-subtle" })] }), _jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", type: "button", children: [_jsx(Globe, { className: "h-3.5 w-3.5 mr-1" }), " Google"] }), _jsx(Button, { variant: "outline", size: "sm", type: "button", children: "Okta" }), _jsx(Button, { variant: "outline", size: "sm", type: "button", children: "SAML" })] }), _jsx("button", { type: "button", className: cn("text-xs text-text-muted hover:text-text-link hover:underline text-center mt-1"), onClick: () => {
                                setMode(mode === "signin" ? "signup" : "signin");
                                setError(null);
                            }, children: mode === "signin"
                                ? "Don't have an account? Create one"
                                : "Already have an account? Sign in" }), mode === "signin" && (_jsxs("div", { className: "text-[11px] text-text-muted border-t border-border-subtle pt-3 mt-1", children: ["Demo creds: ", _jsx("span", { className: "font-mono", children: "chinmoy@gutu.dev / password" })] }))] }) }) }) }));
}
