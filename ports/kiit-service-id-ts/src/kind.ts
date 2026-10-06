/**
 * The kind of runnable app or service a ServiceId represents. A closed, fixed set, so a plain
 * `as const` object plus a derived union type rather than an open string. Member names match
 * Kotlin's `Kind` enum. There's no int value here, nothing in the port reads one.
 */
export const Kind = {
  App: "App",
  CLI: "CLI",
  Web: "Web",
  API: "API",
  Bot: "Bot",
  Agent: "Agent",
  Job: "Job",
  Worker: "Worker",
  Service: "Service",
  Test: "Test",
} as const;

export type Kind = (typeof Kind)[keyof typeof Kind];
