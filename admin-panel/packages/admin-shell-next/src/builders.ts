/** Plugin authoring API — define* factories.
 *
 *  Use these to declare what your plugin contributes to the admin:
 *    - definePlugin        — top-level plugin with nav, resources, views
 *    - defineListView      — schema-driven list page (columns + filters + actions)
 *    - defineFormView      — schema-driven create/edit form
 *    - defineDetailView    — schema-driven record detail page
 *    - defineDashboardView — widget-grid dashboard
 *    - defineCustomView    — escape hatch for bespoke pages (calendars, graphs, canvases)
 *    - defineResource      — resource schema (Zod)
 *    - defineCommand       — command palette entry
 *    - defineAction        — row/page/bulk actions for lists
 */
export * from "../../../src/builders";
