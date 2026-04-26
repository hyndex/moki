export const STATUS_ACTIVE = [
    { value: "active", label: "Active", intent: "success" },
    { value: "inactive", label: "Inactive", intent: "neutral" },
    { value: "archived", label: "Archived", intent: "warning" },
];
export const STATUS_LIFECYCLE = [
    { value: "draft", label: "Draft", intent: "neutral" },
    { value: "pending", label: "Pending", intent: "warning" },
    { value: "approved", label: "Approved", intent: "info" },
    { value: "published", label: "Published", intent: "success" },
    { value: "archived", label: "Archived", intent: "neutral" },
];
export const STATUS_TICKET = [
    { value: "open", label: "Open", intent: "info" },
    { value: "in_progress", label: "In progress", intent: "warning" },
    { value: "resolved", label: "Resolved", intent: "success" },
    { value: "closed", label: "Closed", intent: "neutral" },
];
export const PRIORITY = [
    { value: "low", label: "Low", intent: "neutral" },
    { value: "normal", label: "Normal", intent: "info" },
    { value: "high", label: "High", intent: "warning" },
    { value: "urgent", label: "Urgent", intent: "danger" },
];
export const SEVERITY = [
    { value: "info", label: "Info", intent: "info" },
    { value: "warn", label: "Warn", intent: "warning" },
    { value: "error", label: "Error", intent: "danger" },
];
export const CURRENCY = [
    { value: "USD", label: "USD" },
    { value: "EUR", label: "EUR" },
    { value: "GBP", label: "GBP" },
    { value: "INR", label: "INR" },
];
