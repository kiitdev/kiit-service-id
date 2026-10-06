package kiit.serviceid

/**
 * The kind of runnable/executable app or service a [ServiceId] represents. A closed, fixed set,
 * not open for extension, so a real `enum class` rather than a sealed hierarchy: there's no
 * runtime-supplied "other" case to support here.
 */
enum class Kind {
    App,
    CLI,
    Web,
    API,
    Bot,

    /** An AI agent: software that acts on its own judgment, e.g. an LLM-driven assistant or tool-calling worker. */
    Agent,

    Job,
    Worker,
    Service,
    Test,
}
