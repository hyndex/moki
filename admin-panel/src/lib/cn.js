import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
/** Merge class names — resolves conflicting Tailwind utilities sanely. */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
