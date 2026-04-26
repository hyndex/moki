import { useAllRecords, useList } from "@/runtime/hooks";
export const useBookingKpi = () => useAllRecords("booking.kpi");
export const useHrHeadcount = () => useAllRecords("hr.headcount");
export const useTreasurySnapshots = () => useAllRecords("treasury.snapshot");
export const useInventoryAlerts = () => useAllRecords("inventory.alert");
export const usePosShifts = () => useAllRecords("pos.shift");
export const useAutomationSteps = () => useAllRecords("automation.step");
export const useAiEvalCases = () => useAllRecords("ai-evals.case");
export const useAnalyticsCohorts = () => useAllRecords("analytics.cohort");
export const useAnalyticsArr = () => useAllRecords("analytics.arr");
export const useAnalyticsRevenueMix = () => useAllRecords("analytics.revenue-mix");
export const usePlatformNotifications = () => useAllRecords("platform.notification");
export const useSearchIndex = () => useAllRecords("platform.search-index");
export const useOnboardingSteps = () => useAllRecords("platform.onboarding-step");
export const useReleases = () => useAllRecords("platform.release");
export const useIntegrationPings = () => useAllRecords("integration.ping");
/** List with a default pageSize override. Used by pages that still want
 *  paginated semantics. */
export { useList };
