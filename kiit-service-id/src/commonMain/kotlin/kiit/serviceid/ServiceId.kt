@file:OptIn(ExperimentalUuidApi::class)

package kiit.serviceid

import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

/** ":" — the delimiter [ServiceId]'s `path`/`name`/`fullName`/`install`/`privateId` are built from. */
const val SERVICE_ID_DELIMITER = ":"

/**
 * Contract for anything that identifies a caller or service. Deliberately a plain data shape,
 * nothing more: no `path`/`privateId`-style derived properties here, and no default
 * implementations to inherit. [ServiceId] is the canonical, constructible way to get that
 * behavior. Implement this directly only when you need a custom storage shape (wrapping an
 * existing domain object, say); you still won't get `path`/`name`/`fullName`/`install`/
 * `privateId`/`externalId` for it, since those belong to [ServiceId], not to every possible shape
 * that happens to carry these fields.
 *
 * The fields build up from broad to specific:
 * 1. [origin] and [scope] say who this is.
 * 2. [kind] says what kind of thing it is.
 * 3. [env] and [version] say where it's running and which build.
 * 4. [instance] tells apart multiple running copies of the same version.
 *
 * [about], [uri], [criticality], [team], and [provenance] are side information, not part of any
 * derived identifier.
 */
interface IServiceId {
    /**
     * Domain-like label for who owns this identity, e.g. `"acme.com"` or `"acme"`.
     * 1. Same convention as `Status.origin` in kiit-codes: a real domain or any other stable id.
     * 2. This is not validated, and not guaranteed unique unless it's an actual domain.
     */
    val origin: String

    /**
     * Free-form, consumer-defined label for where in [origin] this lives, e.g.
     * `"accounts.signup"`.
     * 1. Same convention as `Status.scope`: dots are fine for expressing hierarchy.
     * 2. kiit-service-id never parses or enforces the internal shape.
     * 3. This shouldn't contain `:` (reserved, see [SERVICE_ID_DELIMITER]).
     */
    val scope: String

    /** The kind of runnable app or service this is, e.g. [Kind.API] for an HTTP service. */
    val kind: Kind

    /** dev | qat | pro, environment. A plain string, so callers pass whatever env label they already use. */
    val env: String

    /**
     * Short, human-readable description of what this is or does, e.g.
     * `"Sends the welcome email after signup"`. Empty string means unset.
     */
    val about: String

    /** The version running here, e.g. `"1.4.2"`. Defaults to `"latest"`. */
    val version: String

    /**
     * Id of this specific running instance, for telling apart multiple instances of the same
     * [version] (a redeploy, a pod, a worker in a pool). Random by default, e.g.
     * `"4a3b300b-d0ac-4776-8a9c-31aa75e412b3"`, or a caller-supplied id like `"pod-7f9c9d4b8-x2kq1"`.
     * Left as-is in [ServiceId.privateId], unlike every other field here: its whole job is
     * uniqueness, and lowercasing it could make two different instances collide.
     */
    val instance: String

    /**
     * Labels attached to this identity, e.g. `listOf(Tag.Basic("retry"), Tag.Keyed("region", "us-east-1"))`.
     * Not part of any derived identifier.
     */
    val tags: List<Tag>

    /**
     * Optional reference to this instance itself, e.g. `"accounts-signup.acme.internal"`. Unique
     * per environment. Not part of any derived identifier.
     */
    val uri: String?

    /**
     * How much it matters if this identity's owner fails or becomes unavailable. Not part of any
     * derived identifier, same as [about]/[tags]/[uri]. Defaults to [Criticality.Unspecified].
     */
    val criticality: Criticality

    /**
     * The team or group that owns the service this identity represents, e.g.
     * `"payments-platform"`. Distinct from [origin] (the owning company/domain) — this says who
     * *inside* that company is responsible. Not part of any derived identifier. Empty string
     * means unset, same convention as [about].
     */
    val team: String

    /**
     * How this instance came to exist. Not part of any derived identifier. Always
     * [Provenance.Declared] for anything built through [ServiceId.of]; only [ServiceId.parse]
     * sets [Provenance.Parsed].
     */
    val provenance: Provenance
}

/**
 * Identity used to identify services/components.
 *
 * ```
 * path      = origin:scope
 * name      = path:kind                  = origin:scope:kind
 * fullName  = name:env                   = origin:scope:kind:env
 * install   = fullName:version           = origin:scope:kind:env:version
 * privateId = install:instance           = origin:scope:kind:env:version:instance
 * ```
 *
 * For `ServiceId.api("acme", "accounts.signup", "qat")` with `version = "1.4.2"`:
 * ```
 * path      = acme:accounts.signup
 * name      = acme:accounts.signup:api
 * fullName  = acme:accounts.signup:api:qat
 * install   = acme:accounts.signup:api:qat:1.4.2
 * privateId = acme:accounts.signup:api:qat:1.4.2:4a3b300b-d0ac-4776-8a9c-31aa75e412b3
 * ```
 *
 * Every segment except [instance] is lowercased, so two identities that only differ by casing in
 * [origin]/[scope]/[kind]/[env]/[version] still produce the same
 * [path]/[name]/[fullName]/[install]/[privateId]. [instance] is left exactly as given, since
 * folding its case could make two genuinely different instances collide.
 *
 * [privateId] carries real operational detail (exact version, environment, instance) and is meant
 * for internal, trusted service-to-service use only. [externalId] (an alias for [path]) is the
 * safe choice for anything crossing outside your trust boundary — see the security note in the
 * README.
 *
 * Immutable. [newInstance]/[with] return a new [ServiceId] rather than mutating this one.
 *
 * Two identities are equal when their [privateId] is equal, so [about]/[tags]/[uri]/
 * [criticality]/[team]/[provenance] don't count. This matches how identity actually travels on
 * the wire: a caller sends its [privateId] as a header (e.g. `caller-id`, internal
 * service-to-service calls only), and a server treats two requests as the same caller exactly
 * when that value matches, nothing more. `equals`/`hashCode`/`toString` are overridden to match,
 * rather than relying on the auto-generated `data class` versions, which would otherwise
 * compare/print every field.
 *
 * The constructor is `internal`. [of] (and the named shortcuts below it) is the public way to
 * build one, and it's the only place [origin]/[scope] get normalized, see [normalize].
 * `@ConsistentCopyVisibility` makes the auto-generated `copy()` follow the constructor's
 * visibility too (otherwise Kotlin still defaults `copy()` to public even with an internal
 * constructor), so it's `internal` as well; it can still produce an un-normalized copy from
 * within this module, an accepted, narrow gap rather than something worth giving up
 * `data class` over.
 */
@ConsistentCopyVisibility
data class ServiceId internal constructor(
    override val origin: String,
    override val scope: String,
    override val kind: Kind,
    override val env: String,
    override val about: String = "",
    override val version: String = "latest",
    override val instance: String = Uuid.random().toString(),
    override val tags: List<Tag> = listOf(),
    override val uri: String? = null,
    override val criticality: Criticality = Criticality.Unspecified,
    override val team: String = "",
    override val provenance: Provenance = Provenance.Declared,
) : IServiceId {
    /** `origin:scope`, lowercased, e.g. `"acme:accounts.signup"`. */
    val path: String get() = "${origin.lowercase()}$SERVICE_ID_DELIMITER${scope.lowercase()}"

    /** [path] plus [kind], lowercased, e.g. `"acme:accounts.signup:api"`. The same component, any environment. */
    val name: String get() = "$path$SERVICE_ID_DELIMITER${kind.name.lowercase()}"

    /** [name] plus [env], lowercased, e.g. `"acme:accounts.signup:api:qat"`. */
    val fullName: String get() = "$name$SERVICE_ID_DELIMITER${env.lowercase()}"

    /**
     * [fullName] plus [version], lowercased, e.g. `"acme:accounts.signup:api:qat:1.4.2"`. Named
     * for what it is: a specific version installed into a specific environment.
     */
    val install: String get() = "$fullName$SERVICE_ID_DELIMITER${version.lowercase()}"

    /**
     * [install] plus [instance], not lowercased, e.g.
     * `"acme:accounts.signup:api:qat:1.4.2:4a3b300b-d0ac-4776-8a9c-31aa75e412b3"`. Unique per
     * running instance.
     *
     * Carries real operational detail (exact version, environment, instance). Internal, trusted
     * service-to-service use only — use [externalId] instead for anything that crosses outside
     * your trust boundary. See the security note in the README.
     */
    val privateId: String get() = "$install$SERVICE_ID_DELIMITER$instance"

    /**
     * Alias for [path] — this identity's external-safe form: [origin]/[scope] only, no version,
     * environment, or instance detail. Use this instead of [privateId] for anything crossing
     * outside your trust boundary. See the security note in the README.
     */
    val externalId: String get() = path

    /** Equal when [privateId] is equal. See the class doc for why the rest don't count. */
    override fun equals(other: Any?): Boolean = other is ServiceId && other.privateId == privateId

    /** Matches [equals]: hashed on [privateId] alone. */
    override fun hashCode(): Int = privateId.hashCode()

    /** [privateId], so logging a [ServiceId] directly prints something useful instead of a field dump. */
    override fun toString(): String = privateId

    /** Same identity with a new random instance id. */
    fun newInstance(): ServiceId = this.copy(instance = Uuid.random().toString())

    /**
     * Same identity with the given instance id (random if null) and tags.
     *
     * @throws IllegalArgumentException if [inst] contains [SERVICE_ID_DELIMITER].
     */
    fun with(
        inst: String?,
        tags: List<Tag>,
    ): ServiceId {
        val resolvedInstance = inst ?: Uuid.random().toString()
        require(!resolvedInstance.contains(SERVICE_ID_DELIMITER)) {
            "instance must not contain '$SERVICE_ID_DELIMITER': $resolvedInstance"
        }
        return this.copy(instance = resolvedInstance, tags = tags)
    }

    companion object {
        val empty = ServiceId(origin = "", scope = "empty", kind = Kind.Test, env = "empty")

        fun app(
            origin: String,
            scope: String,
            env: String = "dev",
        ): ServiceId = of(origin, scope, Kind.App, env)

        fun api(
            origin: String,
            scope: String,
            env: String = "dev",
        ): ServiceId = of(origin, scope, Kind.API, env)

        fun cli(
            origin: String,
            scope: String,
            env: String = "dev",
        ): ServiceId = of(origin, scope, Kind.CLI, env)

        fun job(
            origin: String,
            scope: String,
            env: String = "dev",
        ): ServiceId = of(origin, scope, Kind.Job, env)

        /** A test identity: scope is `"tests.<name>"`, kind is [Kind.Test], env is `"dev"`. */
        fun test(
            origin: String,
            name: String,
        ): ServiceId = of(origin, "tests.$name", Kind.Test, "dev")

        /**
         * Builds a [ServiceId] from names, normalizing [origin]/[scope]/[env]/[version] (see
         * [normalize]). This is the public entry point: the constructor itself is `internal`, so
         * this is the only way code outside this module builds a [ServiceId].
         *
         * [instance] is validated, not normalized: [normalize] lowercases as part of its
         * filtering, which would violate the one invariant [IServiceId.instance] documents (never
         * folded to a single case, since that's what keeps two different instances from
         * colliding). A caller-supplied [instance] containing [SERVICE_ID_DELIMITER] fails fast
         * here instead of silently producing a [privateId] with more segments than the chain
         * assumes.
         *
         * @throws IllegalArgumentException if [instance] contains [SERVICE_ID_DELIMITER].
         */
        fun of(
            origin: String,
            scope: String,
            kind: Kind,
            env: String = "dev",
            about: String? = null,
            version: String? = null,
            instance: String? = null,
            tags: List<Tag>? = null,
            uri: String? = null,
            criticality: Criticality? = null,
            team: String? = null,
        ): ServiceId {
            val resolvedInstance = instance ?: Uuid.random().toString()
            require(!resolvedInstance.contains(SERVICE_ID_DELIMITER)) {
                "instance must not contain '$SERVICE_ID_DELIMITER': $resolvedInstance"
            }
            return ServiceId(
                origin.normalize(),
                scope.normalize(),
                kind,
                env.normalize(),
                about = about ?: "",
                version = (version ?: "latest").normalize(),
                instance = resolvedInstance,
                tags = tags ?: listOf(),
                uri = uri,
                criticality = criticality ?: Criticality.Unspecified,
                team = team ?: "",
            )
        }

        /**
         * Reconstructs a [ServiceId] from a [privateId] string. Strict: only the full 6-segment
         * form is accepted; throws on a wrong segment count, an unrecognized [Kind], a blank
         * segment, or an [origin]/[scope]/[env]/[version] with characters [normalize] would strip,
         * naming exactly what was wrong, matching [of]/[with]'s style of rejecting bad input rather
         * than silently swallowing it. [origin]/[scope]/[kind]/[env]/[version] are lowercased, so a
         * parsed identity holds the same field values as one built with [of]; [instance] is left
         * as given, same as [of]. Only the six chain fields come back —
         * [about]/[tags]/[uri]/[criticality]/[team] weren't part of [privateId] and get their
         * defaults. [provenance] is [Provenance.Parsed].
         *
         * @throws IllegalArgumentException if [raw] isn't a well-formed [privateId].
         */
        fun parse(raw: String): ServiceId {
            val segments = raw.split(SERVICE_ID_DELIMITER)
            require(segments.size == 6) {
                "expected 6 segments (origin:scope:kind:env:version:instance), got ${segments.size}: '$raw'"
            }

            val kindSegment = segments[2]
            val instance = segments[5]
            require(segments.filterIndexed { i, _ -> i != 2 }.all { it.isNotBlank() }) {
                "blank segment in '$raw'"
            }

            // Lowercased like `of` does, then rejected, not rewritten, when `normalize` would have
            // stripped anything else: untrusted header text doesn't silently change into something else.
            fun clean(
                name: String,
                segment: String,
            ): String {
                val lowered = segment.lowercase()
                require(lowered == lowered.normalize()) {
                    "$name has characters that aren't allowed: '$segment' in '$raw'"
                }
                return lowered
            }

            val origin = clean("origin", segments[0])
            val scope = clean("scope", segments[1])
            val env = clean("env", segments[3])
            val version = clean("version", segments[4])

            val kind =
                Kind.entries.firstOrNull { it.name.lowercase() == kindSegment.lowercase() }
                    ?: throw IllegalArgumentException("unrecognized kind '$kindSegment' in '$raw'")
            return ServiceId(
                origin,
                scope,
                kind,
                env,
                version = version,
                instance = instance,
                provenance = Provenance.Parsed,
            )
        }
    }
}

/**
 * Normalizes a name into an identifier: lowercased, trimmed, keeping only letters, digits, `-`,
 * `_`, `.`, and space, with spaces turned into `_`. Falls back to `_` if nothing survives, e.g.
 * `"My Company"` -> `"my_company"`, `"Accounts Team.Sign Up!"` -> `"accounts_team.sign_up"`. Dots
 * are kept so a [IServiceId.scope] like `"accounts.signup"` survives normalization intact.
 */
internal fun String.normalize(): String {
    val trimmed = this.trim().lowercase()
    val filtered = trimmed.filter { it.isDigit() || it.isLetter() || it == '-' || it == '_' || it == '.' || it == ' ' }
    val cleaned = filtered.ifBlank { "_" }
    return cleaned.replace(' ', '_')
}
