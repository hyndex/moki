/** Platform-wide analytics event contract.
 *
 * Every page, component, and plugin fires typed events through the emitter.
 * Sinks (console in dev, REST in prod) are pluggable. Events are rate-limited
 * and batched; no awaits on the hot path.
 */
export {};
