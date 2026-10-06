package kiit.serviceid

/**
 * How this [ServiceId] instance came to exist: built locally and declared ([Declared]), or
 * reconstructed from a propagated string, e.g. a header value ([Parsed]).
 *
 * Not part of any derived identifier, same bucket as [ServiceId.about]/[ServiceId.tags]/
 * [ServiceId.uri]/[ServiceId.criticality]/[ServiceId.team].
 *
 * Says nothing about whether the underlying values are truthful — a [Parsed] identity is honestly
 * labeled as unauthenticated, not verified as accurate. [ServiceId.of] never exposes this as a
 * parameter, so every identity built through it is [Declared] by construction; only
 * [ServiceId.parse] produces [Parsed], via the internal constructor. It reflects which code
 * path actually built the object, not a self-reported claim a caller can set.
 */
enum class Provenance {
    /** Built locally via [ServiceId.of] (or one of its named shortcuts). */
    Declared,

    /** Reconstructed from a propagated string. Unverified — treat like any caller-supplied input. */
    Parsed,
}
