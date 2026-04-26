import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { Star } from "lucide-react";
import { Button } from "@/primitives/Button";
import { cn } from "@/lib/cn";
import { useFavorites } from "@/runtime/useFavorites";
/** Toggle a `(record, "<resource>:<recordId>")` favorite from a detail
 *  page header. Renders a Lucide `Star` — outline when not favorited,
 *  filled (currentColor) when favorited.
 *
 *  The button is a thin wrapper around `useFavorites().add/remove`; the
 *  module-level cache means every other StarRecordButton + the sidebar
 *  Favorites section update in lock-step.
 */
export function StarRecordButton({ resource, recordId, label, icon, size = "icon", className, }) {
    const fav = useFavorites();
    const targetId = `${resource}:${recordId}`;
    const on = fav.isFavorite("record", targetId);
    const [busy, setBusy] = React.useState(false);
    const toggle = React.useCallback(async () => {
        if (busy)
            return;
        setBusy(true);
        try {
            if (on) {
                await fav.remove("record", targetId);
            }
            else {
                await fav.add({
                    kind: "record",
                    targetId,
                    label,
                    icon,
                });
            }
        }
        finally {
            setBusy(false);
        }
    }, [busy, on, fav, targetId, label, icon]);
    return (_jsx(Button, { variant: "ghost", size: size, onClick: () => void toggle(), disabled: busy, "aria-pressed": on, "aria-label": on ? "Remove from favorites" : "Add to favorites", title: on ? "Remove from favorites" : "Add to favorites", className: cn(className), children: _jsx(Star, { className: cn("h-4 w-4 transition-colors", on ? "fill-current text-amber-500" : "text-text-muted"), "aria-hidden": true }) }));
}
