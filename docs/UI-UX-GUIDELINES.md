# UI / UX guidelines

How to build admin pages that feel like part of the shell, not glued on.
Covers layout, typography, color, density, motion, components, forms,
empty/loading/error states, accessibility, and information density.

> Pair with `PLUGIN-DEVELOPMENT.md` §6 — that's the contribution
> contract; this is the design system that fills it in.

---

## 1. Design principles

1. **Information first, chrome second.** A page exists to expose data
   the user came for. Everything else (icons, dividers, headers) earns
   its space by helping that.

2. **Keyboard-first for power users, mouse-friendly for everyone.**
   Every interactive element reachable by Tab. Common actions on
   shortcut. Cmd-K palette is always one keypress away.

3. **Theme-safe and density-safe.** Three themes (light/dark/auto), two
   densities (comfortable/compact). Nothing breaks when the user flips
   either.

4. **Loading is a state, not a moment.** Skeletons, never spinners.
   The page composition is visible immediately; data fades in.

5. **Empty states are first-class.** A blank page with a CTA is better
   than a blank page.

6. **Errors are quiet but visible.** Inline near the action. Never
   hide the error.

7. **Dialogs are the last resort.** Prefer inline editing, side panels,
   page-level affordances. Dialogs are for destructive confirmation +
   complex multi-field creation.

---

## 2. Layout

### 2.1 Page shell

Every plugin-contributed page renders inside the shell's `<main>`. The
sidebar + topbar are owned by the shell — don't try to override them.

The standard wrapper:
```tsx
<div className="p-6 space-y-4">
  {/* Header (h1 + description + actions) */}
  {/* Filter / search bar */}
  {/* Content (cards, tables, lists) */}
</div>
```

### 2.2 Header

```tsx
<div className="flex items-start justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold tracking-tight">Vehicles</h1>
    <p className="text-sm text-text-muted mt-1">
      Cars, vans, and trucks owned by the tenant.
    </p>
  </div>
  <div className="flex items-center gap-2">
    <Button variant="secondary" onClick={openImport}>Import</Button>
    <Button onClick={openCreate}>+ New vehicle</Button>
  </div>
</div>
```

- Title: `text-2xl font-bold` (24px). One per page.
- Description: `text-sm text-text-muted` (14px). One line max.
- Primary action right-aligned. Secondary actions to its left.

### 2.3 Filter bar

```tsx
<div className="flex items-center gap-2">
  <input className="flex-1 max-w-md px-3 py-2 border border-border rounded-md text-sm"
         placeholder="Filter by name, VIN…"
         value={query} onChange={(e) => setQuery(e.target.value)} />
  <Select value={status} onValueChange={setStatus}>
    <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All</SelectItem>
      <SelectItem value="active">Active</SelectItem>
      <SelectItem value="inactive">Inactive</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### 2.4 Content area

Cards, tables, lists. **Don't nest cards inside cards** — visual
weight gets confusing.

For tables: use the shell's `Table` primitive (Tailwind + Radix). For
custom layouts: stack cards with `space-y-3` (12px gap).

### 2.5 Detail-page layout

Use the shell's `RichDetailPage` so the layout is consistent with every
other detail page in the system:

```tsx
<RichDetailPage
  resource="fleet.vehicle"
  recordId={vehicle.id}
  record={vehicle}
  title={vehicle.name}
  subtitle={`${vehicle.make} ${vehicle.model} · VIN ${vehicle.vin}`}
  status={vehicle.status}                 // pill in header
  actions={[
    { label: "Edit", onClick: openEdit },
    { label: "Print", component: <PrintAction resource="fleet.vehicle" recordId={vehicle.id} /> },
    { label: "Archive", onClick: archive, intent: "danger" },
  ]}
  tabs={[
    { id: "overview", label: "Overview", content: <OverviewTab /> },
    { id: "trips", label: "Trips", count: trips.length, content: <TripsTab /> },
    { id: "maintenance", label: "Maintenance", count: 3, content: <MaintenanceTab /> },
    { id: "files", label: "Files", count: files.length, content: <FilesTab /> },
  ]}
  rail={[
    <ActivityRail resource="fleet.vehicle" recordId={vehicle.id} />,
    <NotesRail resource="fleet.vehicle" recordId={vehicle.id} />,
    /* plugin detail rails injected by the shell */
  ]}
/>
```

The shell adds Activity, Notes, and Files rails by default. Plugin
contributions via `detailRails` get appended.

---

## 3. Typography

Use semantic Tailwind classes, not raw sizes:

| Use | Class |
|---|---|
| Page title | `text-2xl font-bold tracking-tight` |
| Section title | `text-lg font-semibold` |
| Card title | `text-base font-semibold` |
| Body | `text-sm` |
| Caption / muted | `text-xs text-text-muted` |
| Code / mono | `text-xs font-mono` |

Line-height is set globally — don't override unless you have a strong
reason.

---

## 4. Color

### 4.1 Semantic tokens (use these)

```
bg-base          page background
bg-elevated      cards, dialogs, popovers
bg-muted         subtle highlight (zebra rows, hover state)
bg-active        active state on selectable items

text-primary     normal foreground
text-muted       secondary
text-disabled    disabled

border           default
border-strong    high-contrast separator

accent           interactive (links, primary buttons)
accent-bg        primary button background
accent-fg        primary button text

success          success badge / icon
success-bg       success badge background

warning          warning state
warning-bg

danger           error state, destructive actions
danger-bg

(Lucide icon colors inherit from text-primary)
```

### 4.2 Don't

- ❌ `bg-white text-black` — breaks dark mode
- ❌ `text-blue-500` — breaks theme switching
- ❌ Inline `style={{ color: "#0070f3" }}` — never themed

### 4.3 Color is not the only signal

Colorblind users + monochrome reading — pair color with icon + text:

```tsx
// Good
<Badge intent="success"><Check className="w-3 h-3" /> Paid</Badge>
// Bad
<span className="text-success">Paid</span>
```

---

## 5. Density

Two modes set on `<html data-density="...">`:
- `comfortable` (default) — touch-friendly, more whitespace
- `compact` — power-user, more rows on screen

The shell's primitives respond automatically. Plugin authors don't
usually need to handle density manually unless writing custom layout.

To check:
```tsx
const density = document.documentElement.getAttribute('data-density') ?? 'comfortable';
```

---

## 6. Motion

Subtle. Use the shell's transition utilities:
- `transition-colors` — hover/focus state changes
- `transition-opacity` — show/hide
- `animate-pulse` — skeleton loaders

Avoid:
- ❌ Sliding modals across the screen
- ❌ Bouncing buttons
- ❌ Page-level fade-ins (jank)

The exception: the Cmd-K palette gets a 100ms fade-in (Radix dialog
default). Everything else is instant.

---

## 7. Component patterns

### 7.1 Button

```tsx
<Button>Primary</Button>                    // default = filled accent
<Button variant="secondary">Secondary</Button>  // outlined
<Button variant="ghost">Ghost</Button>      // no border, hover bg
<Button variant="danger">Delete</Button>    // red filled
<Button size="sm">Compact</Button>          // smaller variant
<Button disabled>Loading…</Button>          // greyed
<Button asChild><a href="...">Link button</a></Button>  // for navigation
```

### 7.2 Badge

```tsx
<Badge intent="success">Active</Badge>      // green
<Badge intent="warning">Expiring</Badge>    // amber
<Badge intent="danger">Failed</Badge>       // red
<Badge intent="muted">Draft</Badge>         // grey
<Badge intent="accent">Beta</Badge>         // brand color
```

### 7.3 Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>One-line context.</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Actions</CardFooter>
</Card>
```

### 7.4 Dialog

Use Radix Dialog (already wired in primitives):
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Add vehicle</DialogTitle>
      <DialogDescription>Adds a vehicle to your fleet.</DialogDescription>
    </DialogHeader>
    {/* form */}
    <DialogFooter>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={submit}>Add vehicle</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Rules:
- Title is action-oriented ("Add vehicle", not "Vehicle form")
- Description is one line
- Cancel left, primary right
- Esc key closes (Radix free)
- Focus trap (Radix free)
- Click backdrop to dismiss

### 7.5 Toast

For non-blocking confirmation / errors:
```tsx
toast.success("Vehicle added");
toast.error("Couldn't save: name is required");
toast.info("Sync complete · 23 records updated");
```

Auto-dismiss after 4s. User can dismiss manually. Don't toast for
common operations (creating items in a list — the new item appearing
IS the confirmation).

### 7.6 Input + form field

```tsx
<FormField>
  <FormLabel htmlFor="name">Vehicle name</FormLabel>
  <FormControl>
    <Input id="name" {...register("name")} placeholder="e.g. F-150" />
  </FormControl>
  <FormDescription>Shown in lists and reports.</FormDescription>
  <FormMessage />   {/* validation error */}
</FormField>
```

### 7.7 Switch

```tsx
<div className="flex items-center justify-between">
  <div>
    <div className="font-medium">Auto-archive</div>
    <div className="text-xs text-text-muted">Archive vehicles after 90 days idle.</div>
  </div>
  <Switch checked={enabled} onCheckedChange={setEnabled} />
</div>
```

### 7.8 Select

```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="active">Active</SelectItem>
    <SelectItem value="inactive">Inactive</SelectItem>
  </SelectContent>
</Select>
```

### 7.9 Tabs

```tsx
<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="trips">Trips <Badge intent="muted">{count}</Badge></TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
  <TabsContent value="trips">...</TabsContent>
</Tabs>
```

---

## 8. State patterns

### 8.1 Empty state

When the data is genuinely empty (vs loading vs error):

```tsx
<div className="py-16 text-center">
  <Truck className="mx-auto w-12 h-12 text-text-muted opacity-40" />
  <h3 className="mt-4 text-lg font-medium">No vehicles yet</h3>
  <p className="mt-1 text-sm text-text-muted max-w-sm mx-auto">
    Add your first vehicle to start tracking trips, maintenance, and fuel.
  </p>
  <Button className="mt-6" onClick={create}>+ Add vehicle</Button>
</div>
```

Always include:
- Icon (Lucide, faded)
- Title (concrete, names the missing thing)
- Description (1-2 lines: what this is for, what to do next)
- CTA (primary action)

### 8.2 Loading state

Skeleton, not spinner. Match the shape of the loaded content:

```tsx
{loading ? (
  <div className="space-y-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-16 bg-bg-muted rounded-lg animate-pulse" />
    ))}
  </div>
) : (
  rows.map((r) => <Row {...r} />)
)}
```

For very fast loads (<100ms), don't show a skeleton at all — flash is
worse than instant.

### 8.3 Error state

Inline near the action that failed:

```tsx
{error && (
  <div className="bg-danger-bg border border-danger rounded-md p-3 text-sm">
    <div className="flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="font-medium text-danger">Couldn't load vehicles</div>
        <div className="text-text-primary mt-1">{error.message}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={retry}>Retry</Button>
    </div>
  </div>
)}
```

Never silently fail. Never alert(). Never console-only.

### 8.4 Submitting state

Disable the primary action + change its label:

```tsx
<Button disabled={submitting} onClick={submit}>
  {submitting ? "Saving…" : "Save"}
</Button>
```

---

## 9. Forms

### 9.1 Validation

Client-side: react-hook-form + zod resolver:
```tsx
const schema = z.object({
  name: z.string().min(1, "Name is required"),
  vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/, "Invalid VIN"),
  year: z.number().int().min(1900).max(2100),
});
const form = useForm({ resolver: zodResolver(schema) });
```

Server-side: zod schema on the route. Always.

### 9.2 Field order

The order users will think about the data:
1. The "what" (name, primary identifier)
2. The "how" (configuration, settings)
3. The "extras" (description, notes, tags)

NOT alphabetical. NOT by table column order.

### 9.3 Defaults

Pre-fill anything reasonable:
- Today's date for date fields
- "Active" status
- The current user as the owner
- The current tenant

### 9.4 Required vs optional

- Required: no marker (default assumption)
- Optional: append "(optional)" to the label or use a help text

Don't use `*` — it's noise on every label.

### 9.5 Helper text

Below the field. Plain language:
- ✅ "Shown in lists and reports."
- ❌ "Field maxlength 200, accepts ASCII"

Validation errors replace the helper text on error:
- "Name is required."
- "VIN must be 17 alphanumeric characters."

### 9.6 Save / cancel

- Save in the bottom-right of the form (or dialog footer)
- Cancel to its left
- Save is the primary visual style; Cancel is `variant="ghost"`
- Esc cancels (in dialogs); Cmd+Enter saves

---

## 10. Tables

### 10.1 Use the shell's Table primitive

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>VIN</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Last trip</TableHead>
      <TableHead></TableHead>          {/* row actions */}
    </TableRow>
  </TableHeader>
  <TableBody>
    {rows.map((v) => (
      <TableRow key={v.id} onClick={() => navigate(v.id)} className="cursor-pointer">
        <TableCell className="font-medium">{v.name}</TableCell>
        <TableCell className="font-mono text-xs text-text-muted">{v.vin}</TableCell>
        <TableCell><StatusBadge status={v.status} /></TableCell>
        <TableCell className="text-right">{relativeTime(v.lastTripAt)}</TableCell>
        <TableCell><RowActions vehicle={v} /></TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### 10.2 Conventions

- Numbers right-aligned (`text-right`)
- Dates in relative time ("3 days ago") with a tooltip showing absolute
- Mono font for ids, codes, hashes (`font-mono text-xs`)
- Status as a Badge, not a colored cell
- Row click navigates to detail; explicit Edit/Delete in a row-actions menu
- Don't show internal IDs unless the user explicitly asks (search, copy)

### 10.3 Pagination

Use the shell's pagination component. Always show:
- Current range (1–25 of 137)
- Page size selector (25 / 50 / 100)
- Previous / next
- Jump to page (if total > 5 pages)

---

## 11. Cmd-K palette

Plugins contribute via `commands[]`. Each command:
- `label`: imperative verb-first ("Open Vehicles", not "Vehicles")
- `keywords`: comma-shouldn't-need-them aliases
- `icon`: same as the page nav

Common command patterns:
- `Open <page>` — navigate
- `New <thing>` — open create dialog
- `Find <thing>` — search-in-place
- `Toggle <feature>` — flip a setting
- `Run <action>` — trigger a one-shot

---

## 12. Detail-page rail cards

Plugins can contribute right-rail cards on any record's detail page via
`detailRails[]`. Cards should be:
- **Self-contained** — load their own data via `apiFetch`
- **Compact** — fit in 280–320px width
- **Skippable** — show empty state if no data, don't expand chrome

```tsx
function VehicleAssignmentRail({ resource, recordId }) {
  const [vehicles, setVehicles] = React.useState([]);
  React.useEffect(() => { /* fetch fleet vehicles assigned to this contact */ }, [recordId]);
  if (vehicles.length === 0) return null;        // skip if nothing
  return (
    <Card>
      <CardHeader><CardTitle>Vehicles</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {vehicles.map((v) => (
          <a key={v.id} href={`#/fleet/vehicles/${v.id}`} className="flex items-center gap-2 hover:bg-bg-muted rounded p-2">
            <Truck className="w-4 h-4 text-text-muted" />
            <div className="flex-1 text-sm">{v.name}</div>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## 13. Accessibility

### 13.1 Keyboard

Every interactive element:
- Reachable by Tab in logical order
- Activated by Enter (links + buttons) or Space (buttons + checkboxes)
- Esc closes dialogs / dropdowns / popovers
- Cmd-K opens the palette globally

### 13.2 Screen readers

- `<button>` for buttons, not styled `<div>`
- `<a href>` for navigation, not `onClick`
- Forms: `<label htmlFor="id">` matches input `id`
- Dialogs: `role="dialog"` + `aria-modal="true"` (Radix free)
- Live regions: `aria-live="polite"` for toasts

### 13.3 Color contrast

The shell's tokens hit WCAG AA. Don't override.

### 13.4 Focus rings

Don't disable focus rings (`outline-none`) without replacing them. The
shell's tokens include a visible focus ring on every interactive
element.

### 13.5 Motion preferences

Respect `prefers-reduced-motion`:
```tsx
<div className="motion-safe:animate-pulse motion-reduce:opacity-50">
```

---

## 14. Performance

### 14.1 Data fetching

- Fetch once per page mount; cache for the session
- Use `apiFetch` (it has the auth token wired)
- For lists with potentially many rows, paginate at the server (use
  `?limit=100` or `?pageSize=100`)
- Never fetch in render — use `React.useEffect`

### 14.2 Rendering

- Virtualise lists > 200 rows (use `@tanstack/react-virtual` already a dep)
- `React.memo` for heavy row components
- Don't index-key — use stable ids

### 14.3 Bundle size

- The shell ships ~600KB gz. Plugins should aim for <100KB gz each.
- Avoid full-icon libraries; use individual Lucide imports
- Tree-shaking only works if your imports are explicit:
  ```tsx
  import { Truck } from "lucide-react";  // good
  import * as Icons from "lucide-react"; // bad — bundles everything
  ```

---

## 15. Microcopy

### 15.1 Labels

- Verb-first for actions: "Add vehicle", "Save changes", "Cancel"
- Noun for entities: "Vehicles", "Trips", "Maintenance"
- Sentence case ("Add vehicle"), not Title Case ("Add Vehicle")

### 15.2 Confirmations

- Avoid "Are you sure?" — it's noise. Use the destructive button color
  + a one-line consequence:
  - ✅ "Permanently delete 23 vehicles. This cannot be undone."
  - ❌ "Are you sure you want to delete?"

### 15.3 Errors

- Plain language, no error codes (codes go in the dev console)
- Tell the user what happened + what to do next:
  - ✅ "Couldn't save. Check your connection and try again."
  - ❌ "ERR_NETWORK_FAILURE"

### 15.4 Empty states

- Name what's missing: "No vehicles yet"
- Explain why this matters: "Add a vehicle to start tracking trips."
- Show the next step: "+ Add vehicle"

---

## 16. The polish checklist

Before merging a new page:

- [ ] Header has title (h1), description, primary action
- [ ] Filter bar (if list)
- [ ] Loading state shows skeletons of the right shape
- [ ] Empty state has icon + title + description + CTA
- [ ] Error state inline near the action that failed
- [ ] Every text uses semantic tokens (no raw colors)
- [ ] Every icon has a label or aria-label
- [ ] Tabs persist on URL hash (so back-button works)
- [ ] Keyboard nav: Tab order is logical, Esc dismisses dialogs
- [ ] Cmd-K command added with sensible keywords
- [ ] Sidebar nav entry with a Lucide icon
- [ ] Density tested: comfortable + compact both look right
- [ ] Theme tested: light + dark both look right
- [ ] Page wrapped in PluginBoundary (the shell does this for you)

---

## 17. Examples to study

The shell's existing pages are the ground truth:

- **Custom fields** (`/settings/custom-fields`) — list + dialog create
  + per-resource scope (forms-core/CustomFieldsPage)
- **Plugins** (`/settings/plugins`) — operator console, rich detail
  rendering (admin-primitives/PluginsSettingsPage)
- **Workflows** (`/settings/workflows`) — empty state with templates,
  detail page with builder (workflow-core/WorkflowsPage)
- **Print formats** (`/settings/print-formats`) — multi-tab editor
  (template-core/PrintFormatsPage)
- **Notification rules** (`/settings/notification-rules`) — per-resource
  scoped, channel matrix (notifications-core/NotificationRulesPage)

When in doubt, copy the closest existing pattern.
