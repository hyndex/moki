---
plugin: gutu-plugin-hr-payroll-core
design-system: 1.0
tier: flagship
last-updated: 2026-04-27
---

# HR & Payroll — Page Design Brief

People operations + paying people, on one plugin. Built around the
employee lifecycle and the pay cycle, with compliance and privacy as
first-class concerns.

## Positioning

ERPNext fragments HR across many doctypes. BambooHR is solid but
limited beyond HR. Gusto excels at payroll, weak elsewhere. We give
a unified employee 360 + pay run cockpit + compliance radar, with
PII handling baked in (per-tenant ACL + GDPR fan-out).

## Page map

| # | Page path | Archetype | Purpose |
|---|---|---|---|
| 1 | `/hr` | Intelligent Dashboard | People health |
| 2 | `/hr/people` | Smart List | Employees |
| 3 | `/hr/people/:id` | Workspace Hub | Employee 360 |
| 4 | `/hr/org-chart` | Tree Explorer | Reporting structure |
| 5 | `/hr/recruiting` | Kanban | Candidate pipeline |
| 6 | `/hr/recruiting/:id` | Detail-Rich | Candidate cockpit |
| 7 | `/hr/onboarding` | Kanban | Onboarding stages |
| 8 | `/hr/time-off` | Calendar | Leave + capacity |
| 9 | `/hr/timesheets` | Smart List | Time entries |
| 10 | `/payroll` | Intelligent Dashboard | Pay cycle health |
| 11 | `/payroll/runs` | Smart List | Pay runs |
| 12 | `/payroll/runs/:id` | Detail-Rich | Run cockpit |
| 13 | `/payroll/payslips` | Smart List | Payslips |
| 14 | `/hr/performance` | Workspace Hub | Reviews & cycles |
| 15 | `/hr/compliance` | Split Inbox | Compliance items |

## 1 · `/hr` — Intelligent Dashboard

**KPIs (6):** Headcount · Open reqs · Turnover (rolling 90d) · Avg tenure · Engagement score (latest survey) · Compliance score
**Main:**
- Attention queue: probation ending 7d · birthdays this week · contracts expiring 30d · I-9 missing · open onboarding tasks
- `LineSeries` headcount over 12 months
- `BarSeries` hires vs leavers per quarter
- `Heatmap` time-off usage by team × month
**Rail:** anomalies (e.g., "team X turnover 22% — 3× company"), next actions, AI ("who's a flight risk?")

## 2 · `/hr/people` — Smart List

**Columns (default):** ☐ · Name · Title · Dept · Manager · Status · Start date · Tenure · Location
**Saved views:** Active · On leave · Probation · By department · Anniversaries (30d) · No manager
**Bulk:** assign manager, change dept, terminate (with workflow), generate doc, export.
**Privacy:** salary column hidden by default; visible only to `payroll.read` role; access auto-audited.

## 3 · `/hr/people/:id` — Workspace Hub

**S1:** EntityBadge "Maya R · Engineer · Active" · HeaderActions [Edit · Time off · Doc · ⋯ Terminate]
**S2 KPIs:** Tenure · PTO balance · Last review rating · Engagement (latest)
**Tabs:** Overview · Compensation · Time off · Performance · Documents · Equipment · Audit
**Overview:** profile, photo, contact (limited by ACL), reporting line, current role, key dates
**Compensation:** salary history, equity, bonus history (ACL-gated)
**Documents:** contracts, I-9, NDAs, signed handbook (latest version)
**Rail:**
- Manager card + skip-level
- Direct reports list
- Activity timeline (HR events)
- AI ("draft a goal for Q3")

## 4 · `/hr/org-chart` — Tree Explorer

Hierarchical org. Right pane: node detail — span of control, vacancies, total comp band, gender ratio.
**Compare mode:** show two snapshots side-by-side (e.g., Q1 vs Q2).

## 5 · `/hr/recruiting` — Kanban

Columns: Sourced · Screening · Interview · Offer · Hired · Rejected
Card: candidate · role · stage age · ✓ feedback count · referrer
**Aging:** stage age >stage-target turns amber/red
**Drag rules:** workflow gates (e.g., Offer requires 2 interview feedbacks)

## 6 · `/hr/recruiting/:id` — Detail-Rich

Tabs: Overview · Resume · Feedback · Schedule · Offer · Audit
Resume tab: pdf preview + AI extract (skills, experience, schools)
Feedback tab: structured rubric per interviewer; aggregate score
Schedule tab: integrated calendar view of upcoming interviews
Offer tab: comp builder, equity, signing bonus, e-sign

## 7 · `/hr/onboarding` — Kanban

Columns: Pre-day-1 · Week 1 · Week 2-4 · Day 90 · Done
Card per new-hire: tasks remaining count + blocking owner avatars

## 8 · `/hr/time-off` — Calendar

Resource = employee; lanes = team. Show approved/pending colour-coded; capacity heatmap row.
**Conflict highlight:** if approving would dip team capacity below threshold, warn.
**Approve/deny in-place** with reason.

## 9 · `/hr/timesheets` — Smart List

Columns: ☐ · Employee · Period · Hours · Project · Status · Approver · Submitted
**Saved views:** Pending approval · Late · By project · By manager
**Bulk:** approve, request rework, lock period

## 10 · `/payroll` — Intelligent Dashboard

**KPIs:** Next run · Headcount paid · Net pay (last run) · Tax liability outstanding · Errors (last run) · Coverage (% of FTE on direct deposit)
**Main:**
- Attention queue: missing direct-deposit · upcoming statutory filings · benefit enrollments expiring · garnishments due
- `BarSeries` gross pay by department per period
- `LineSeries` total comp cost over 12 months
- `WaterfallSeries` last run: gross → tax → benefits → net

## 11 · `/payroll/runs` — Smart List

Columns: ☐ · # · Period · Status · Headcount · Gross · Net · Tax · Filed · Owner
Saved views: Open · Closed · Errors · Out-of-cycle

## 12 · `/payroll/runs/:id` — Detail-Rich

**S1:** "Run · 2026-04-30 · in progress · 84/120 employees calculated"
**Tabs:** Employees · Inputs · Anomalies · Outputs · Filings · Audit
**Employees tab:** grid with person, gross, deductions, taxes, net, status (calc'd / locked / paid), anomaly chip
**Anomalies tab:** AI flags ("salary +30% w/w for John Smith — confirm"), each with explain + accept/reject
**Outputs tab:** payslips PDF, journal entry preview, ACH file
**Filings tab:** statutory submissions auto-prepared

## 13 · `/payroll/payslips` — Smart List

Per-employee per-period. Filter by employee, period, status.
**Privacy:** non-self payslips strictly ACL-gated.

## 14 · `/hr/performance` — Workspace Hub (per cycle)

Tabs: Overview · Goals · Reviews · Calibrations · Promotions
Goals: hierarchy (company→team→individual)
Reviews: cycle progress per manager + AI summary aggregator
Calibrations: heatmap of manager rating distributions; flag outliers

## 15 · `/hr/compliance` — Split Inbox

Stream of compliance findings (visa expiries, I-9 missing, training overdue, payroll filing approaching, GDPR DSAR pending).
Preview shows item detail + AI-suggested next step.
Actions: assign, complete, escalate, snooze.

## Cross-plugin integrations

- `accounting-core` — payroll journal posting; benefit cost lines
- `auth-core` — onboarding/offboarding triggers account lifecycle
- `org-tenant-core` — multi-entity payroll
- `audit-core` — all PII access auto-audited
- `notifications-core` — anniversaries, alerts
- `automation-core` — onboarding task templates
- `workflow-core` — approval chains
- `ai-assist-core` — in-line drafting, flight-risk detection
- `analytics-bi-core` — engagement, comp ratios

## Privacy & PII

- All PII fields tagged in `field-metadata-core` with `sensitivity:high`
- ACL gates view + edit independently
- Salary view requires `payroll.read`; salary edit requires `payroll.write`
- GDPR Article 20 export and Article 17 erase implemented via plugin lifecycle hooks (`exportSubjectData` / `deleteSubjectData`)
- Every read of high-sensitivity fields auto-audits

## Performance budget

People list 100k virtualised; payroll run 10k employees calculated <30s (workers); payslip render <500ms.

## Open questions

- Multi-jurisdiction payroll: which engine? Two-phase plan: phase 1 = US + EU + India; phase 2 = via partners / regional plugins.
- Performance review template: rigid vs flexible — proposal flexible (admin-defined) but recommended templates shipped.
- Manager self-serve vs HR-only edits — proposal: managers can edit non-comp fields; comp edits HR-only.
