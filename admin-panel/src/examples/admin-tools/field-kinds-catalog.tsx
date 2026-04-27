/** Field-kinds Catalog — a single page that exercises every advanced
 *  field kind shipped through the registry (image, file, geo, video,
 *  audio, color, duration, code, markdown, tags, sparkline,
 *  relationship). Useful for visual regression + a quick demo for
 *  authors deciding which kind to use for a new field. */

import * as React from "react";
import { defineCustomView } from "@/builders";
import { getFieldKindRenderer, registeredFieldKinds } from "@/views/fieldKindRegistry";
// Side-effect: register every built-in kind.
import "@/views/field-kinds/registerAll";

interface DemoField {
  name: string;
  label: string;
  kind: string;
  description: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
  referenceTo?: string;
  language?: string;
  initial: unknown;
}

const FIELDS: ReadonlyArray<DemoField> = [
  {
    name: "owner",
    label: "Owner",
    kind: "reference",
    description: "Searchable picker for any registered resource. Uses useAllRecords + fuzzy filter.",
    referenceTo: "crm.contact",
    initial: undefined,
  },
  {
    name: "tags_freeform",
    label: "Tags (free-form)",
    kind: "tags",
    description: "Type and press Enter to add chips. Backspace deletes the last chip on empty.",
    initial: ["new", "vip"],
  },
  {
    name: "tags_constrained",
    label: "Tags (constrained)",
    kind: "tags",
    description: "Picks from `field.options` only — same chip UI, no free-form values.",
    options: [
      { value: "lead", label: "Lead" },
      { value: "prospect", label: "Prospect" },
      { value: "customer", label: "Customer" },
      { value: "vip", label: "VIP" },
    ],
    initial: ["customer"],
  },
  {
    name: "avatar",
    label: "Avatar (image)",
    kind: "image",
    description: "Drag/drop to upload, click to zoom in a lightbox. Stored via /api/files.",
    initial: null,
  },
  {
    name: "report",
    label: "Report (file)",
    kind: "file",
    description: "Generic attachment — drag/drop, list cell links to /api/files/:id/content.",
    initial: null,
  },
  {
    name: "intro_video",
    label: "Intro video",
    kind: "video",
    description: "HTML5 player. Same uploader as `file`; cell renders an inline play link.",
    initial: null,
  },
  {
    name: "podcast_clip",
    label: "Podcast clip",
    kind: "audio",
    description: "HTML5 audio with controls + size info.",
    initial: null,
  },
  {
    name: "office_location",
    label: "Office location",
    kind: "geo.point",
    description: "Real Leaflet map (OpenStreetMap tiles). Click on the map to drop a pin.",
    initial: { lat: 37.7749, lng: -122.4194 },
  },
  {
    name: "brand_color",
    label: "Brand color",
    kind: "color",
    description: "Native picker + hex input + swatch. Stores as #rrggbb.",
    initial: "#6366f1",
  },
  {
    name: "sla_window",
    label: "SLA window",
    kind: "duration",
    description: "Accepts \"1h 30m\" / \"45s\" / \"2d 4h\". Stored as integer seconds.",
    initial: 5_400,
  },
  {
    name: "config_json",
    label: "Config (JSON)",
    kind: "json",
    description: "Lowlight-highlighted code editor. Same UX as the dedicated code kind.",
    language: "json",
    initial: '{\n  "endpoint": "https://api.example.com",\n  "retries": 3\n}',
  },
  {
    name: "snippet",
    label: "Snippet (TypeScript)",
    kind: "code",
    description: "Configurable language via `field.language`.",
    language: "typescript",
    initial: "export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}",
  },
  {
    name: "release_notes",
    label: "Release notes",
    kind: "markdown",
    description: "Tiptap WYSIWYG with Bold / Italic / Code / Lists / Quote / Link.",
    initial: "<h3>Release v1.0</h3><p>First public release. Highlights:</p><ul><li><strong>Field-kind registry</strong> — pluggable</li><li><em>11 advanced kinds</em></li></ul>",
  },
  {
    name: "trend",
    label: "Trend",
    kind: "sparkline",
    description: "Mini chart from a number[] series. Read-only in lists; editable as JSON in forms.",
    initial: [3, 5, 4, 6, 8, 7, 9, 12, 11, 13, 15, 14, 17, 19],
  },
];

export function FieldKindsCatalog(): React.ReactElement {
  // Local form state for the demo — a real plugin would wire these
  // through `<FieldInput>` / FormView.
  const [values, setValues] = React.useState<Record<string, unknown>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.name, f.initial])),
  );
  const set = (name: string, next: unknown): void => setValues((prev) => ({ ...prev, [name]: next }));
  const registered = registeredFieldKinds();
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-text-primary">Field kinds catalog</h1>
        <p className="text-sm text-text-muted">
          Every advanced field kind shipped by the framework. {registered.length} kinds registered.
          Each card shows the live form input on the left and the detail viewer on the right.
        </p>
      </header>
      <ul className="space-y-3">
        {FIELDS.map((f) => {
          const renderer = getFieldKindRenderer(f.kind);
          const Form = renderer?.Form;
          const Detail = renderer?.Detail;
          const fieldDescriptor = {
            name: f.name,
            label: f.label,
            kind: f.kind,
            options: f.options,
            referenceTo: f.referenceTo,
            language: f.language,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any;
          return (
            <li
              key={f.name}
              className="rounded-lg border border-border bg-surface-0 shadow-sm overflow-hidden"
            >
              <header className="px-4 py-2.5 border-b border-border-subtle flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text-primary">
                    {f.label}{" "}
                    <code className="font-mono text-[11px] text-text-muted ml-1">{f.kind}</code>
                  </div>
                  <div className="text-xs text-text-muted leading-snug">{f.description}</div>
                </div>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Form input
                  </div>
                  {Form ? (
                    <Form
                      field={fieldDescriptor}
                      value={values[f.name]}
                      onChange={(v: unknown) => set(f.name, v)}
                      record={{}}
                    />
                  ) : (
                    <div className="text-xs text-danger">No registered Form renderer.</div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Detail viewer
                  </div>
                  {Detail ? (
                    <Detail field={fieldDescriptor} value={values[f.name]} record={{}} />
                  ) : (
                    <div className="text-xs text-danger">No registered Detail renderer.</div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const fieldKindsCatalogView = defineCustomView({
  id: "tools.field-kinds-catalog.view",
  title: "Field kinds catalog",
  description: "Live demo of every advanced field kind.",
  resource: "admin-tools.field-kinds",
  archetype: "detail-rich",
  density: "comfortable",
  render: () => <FieldKindsCatalog />,
});

export const fieldKindsCatalogNav = [
  {
    id: "tools.field-kinds-catalog.nav",
    label: "Field kinds (demo)",
    icon: "Sparkles",
    path: "/tools/field-kinds",
    view: "tools.field-kinds-catalog.view",
    section: "tools",
    order: 100,
  },
];
