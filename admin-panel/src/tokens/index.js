import "./tokens.css";
const THEME_KEY = "gutu.theme";
const DENSITY_KEY = "gutu.density";
export function getTheme() {
    if (typeof document === "undefined")
        return "light";
    return document.documentElement.getAttribute("data-theme") || "light";
}
export function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
        localStorage.setItem(THEME_KEY, theme);
    }
    catch {
        /* private mode or disabled storage — theme still applies for session */
    }
}
export function toggleTheme() {
    const next = getTheme() === "light" ? "dark" : "light";
    setTheme(next);
    return next;
}
export function getDensity() {
    if (typeof document === "undefined")
        return "comfortable";
    return (document.documentElement.getAttribute("data-density") ||
        "comfortable");
}
export function setDensity(density) {
    document.documentElement.setAttribute("data-density", density);
    try {
        localStorage.setItem(DENSITY_KEY, density);
    }
    catch {
        /* no-op */
    }
}
