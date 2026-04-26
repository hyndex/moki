/** Widget + workspace + report + connection contracts.
 *
 * Inspired by ERPNext's workspace/dashboard_chart/number_card/query_report model:
 * - Widgets are declarative objects placed on a 12-column grid
 * - Charts and number cards bind to report definitions or aggregation specs
 * - Reports are `execute(filters)` style functions returning columns + data + chart
 * - Connections are groupings of related-record counts shown on detail pages
 */
export {};
