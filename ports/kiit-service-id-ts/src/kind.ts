/**
 * The kind of runnable app or service a ServiceId represents. A closed, fixed set, so a plain
 * `as const` object plus a derived union type rather than an open string. Member names match
 * Kotlin's `Kind` enum. There's no int value here, nothing in the port reads one.
 *
 * A kind is something runnable and deployable that issues or serves requests. Candidates left out
 * on purpose, and what to use instead:
 * 1. Scheduler, cron: `Job`.
 * 2. Queue or stream consumer: `Worker`.
 * 3. Mobile, desktop: `App`. Browser frontends are `Web`.
 * 4. Plugin, extension: runs inside another process, so it has no identity of its own.
 * 5. Database, cache, queue: infrastructure that is called but never calls. It isn't at the edge of
 *    a request, as the origin or the receiver of one.
 *
 * A new kind is only added when it changes how a caller is attributed or handled, which is why
 * `Gateway` and `Function` exist and these don't.
 */
export const Kind = {
  App: "App",
  CLI: "CLI",
  Web: "Web",
  API: "API",
  Bot: "Bot",
  Job: "Job",
  Worker: "Worker",
  Service: "Service",
  Gateway: "Gateway",
  Function: "Function",
  Agent: "Agent",
  Test: "Test",
} as const;

export type Kind = (typeof Kind)[keyof typeof Kind];
