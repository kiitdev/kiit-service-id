package kiit.serviceid

/**
 * The kind of runnable/executable app or service a [ServiceId] represents. A closed, fixed set,
 * not open for extension, so a real `enum class` rather than a sealed hierarchy: there's no
 * runtime-supplied "other" case to support here.
 *
 * A kind is something runnable and deployable that issues or serves requests. Candidates left out
 * on purpose, and what to use instead:
 * 1. Scheduler, cron: [Job].
 * 2. Queue or stream consumer: [Worker].
 * 3. Mobile, desktop: [App]. Browser frontends are [Web].
 * 4. Plugin, extension: runs inside another process, so it has no identity of its own.
 * 5. Database, cache, queue: infrastructure that is called but never calls. It isn't at the edge of
 *    a request, as the origin or the receiver of one.
 *
 * A new kind is only added when it changes how a caller is attributed or handled, which is why
 * [Gateway] and [Function] exist and these don't.
 */
enum class Kind {
    /** A runnable application. Also covers mobile and desktop apps. */
    App,

    /** A command line tool. */
    CLI,

    /** A browser frontend. */
    Web,

    /** An HTTP service. */
    API,

    /** A bot that is not an AI agent. */
    Bot,

    /** Scheduled or one-off work. */
    Job,

    /** A queue or stream consumer, or a worker in a pool. */
    Worker,

    /** A deployable service that doesn't fit another kind. */
    Service,

    /** An edge or routing service in front of others: an API gateway or reverse proxy. The point where internal identity stops and external identity starts. */
    Gateway,

    /** A serverless function: short-lived, triggered per event or request. Many instances, each brief. */
    Function,

    /** An AI agent: software that acts on its own judgment, e.g. an LLM-driven assistant or tool-calling worker. */
    Agent,

    /** A test identity. */
    Test,
}
