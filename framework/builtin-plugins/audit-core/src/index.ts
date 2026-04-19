export { AuditEventResource } from "./resources/main.resource";
export { recordAuditEventAction } from "./actions/default.action";
export { auditPolicy } from "./policies/default.policy";
export { emitAuditEvent, recordAuditEvent } from "./services/main.service";
export { uiSurface } from "./ui/surfaces";
export { default as manifest } from "../package";
