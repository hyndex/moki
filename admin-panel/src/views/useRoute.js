import { useEffect, useState } from "react";
/** Tiny hash-router subscription. The full router lives in shell/. */
export function useHash() {
    const [hash, setHash] = useState(() => typeof window === "undefined" ? "" : window.location.hash.slice(1) || "/");
    useEffect(() => {
        const onHash = () => setHash(window.location.hash.slice(1) || "/");
        window.addEventListener("hashchange", onHash);
        return () => window.removeEventListener("hashchange", onHash);
    }, []);
    return hash;
}
export function navigateTo(path) {
    if (typeof window === "undefined")
        return;
    if (path.startsWith("#"))
        path = path.slice(1);
    if (window.location.hash.slice(1) === path)
        return;
    window.location.hash = path;
}
