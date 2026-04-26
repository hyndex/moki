/** Webhook dispatcher — re-exported from webhooks-core where the
 *  canonical implementation lives. The shell never starts the dispatcher
 *  directly; webhooks-core's start() hook owns that. */
export * from "@gutu-plugin/webhooks-core";
