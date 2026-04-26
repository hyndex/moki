/** Platform-wide permission contract.
 *
 * Plugins declare PolicyRules; the shell evaluates them via PermissionEvaluator
 * before rendering actions, columns, and routes. Denied routes surface a
 * "Request access" dialog rather than a cryptic 403.
 */
export {};
