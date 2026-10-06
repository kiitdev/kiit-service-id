import { Criticality } from "./criticality.js";
import { Kind } from "./kind.js";
import { Provenance } from "./provenance.js";
import type { Tag } from "./tag.js";
import { randomUuid } from "./uuid.js";

/** ":" — the delimiter ServiceId's `path`/`name`/`fullName`/`install`/`privateId` are built from. */
export const SERVICE_ID_DELIMITER = ":";

/**
 * Contract for anything that identifies a caller or service. Deliberately a plain data shape,
 * nothing more: no `path`/`privateId`-style derived properties here, and nothing to inherit for
 * free. `ServiceId` is the canonical, constructible way to get that behavior. Implement this
 * directly only when you need a custom storage shape (wrapping an existing domain object, say);
 * you still won't get `path`/`name`/`fullName`/`install`/`privateId`/`externalId` for it, since
 * those belong to `ServiceId`, not to every possible shape that happens to carry these fields.
 *
 * The fields build up from broad to specific:
 * 1. origin and scope say who this is.
 * 2. kind says what kind of thing it is.
 * 3. env and version say where it's running and which build.
 * 4. instance tells apart multiple running copies of the same version.
 *
 * about, uri, criticality, team, and provenance are side information, not part of any derived
 * identifier.
 */
export interface IServiceId {
  /**
   * Domain-like label for who owns this identity, e.g. "acme.com" or "acme". Same convention as
   * kiit-codes' `Status.origin`: a real domain or any other stable id, not validated, and not
   * guaranteed unique unless it's an actual domain.
   */
  readonly origin: string;

  /**
   * Free-form, consumer-defined label for where in origin this lives, e.g. "accounts.signup".
   * Same convention as `Status.scope`: dots are fine for expressing hierarchy, kiit-service-id
   * never parses or enforces the internal shape, and it shouldn't contain ":" (reserved, see
   * SERVICE_ID_DELIMITER).
   */
  readonly scope: string;

  /** The kind of runnable app or service this is, e.g. Kind.API for an HTTP service. */
  readonly kind: Kind;

  /** dev | qat | pro, environment. A plain string, so callers pass whatever env label they already use. */
  readonly env: string;

  /**
   * Short, human-readable description of what this is or does, e.g.
   * "Sends the welcome email after signup". Empty string means unset.
   */
  readonly about: string;

  /** The version running here, e.g. "1.4.2". Defaults to "latest". */
  readonly version: string;

  /**
   * Id of this specific running instance, for telling apart multiple instances of the same
   * version (a redeploy, a pod, a worker in a pool). Random by default, e.g.
   * "4a3b300b-d0ac-4776-8a9c-31aa75e412b3", or a caller-supplied id like "pod-7f9c9d4b8-x2kq1".
   * Left as-is in `privateId`, unlike every other field here: its whole job is uniqueness, and
   * lowercasing it could make two different instances collide.
   */
  readonly instance: string;

  /**
   * Labels attached to this identity, e.g. [Tag.Basic("retry"), Tag.Keyed("region", "us-east-1")].
   * Not part of any derived identifier.
   */
  readonly tags: readonly Tag[];

  /**
   * Optional reference to this instance itself, e.g. "accounts-signup.acme.internal". Unique per
   * environment. Not part of any derived identifier.
   */
  readonly uri: string | null;

  /**
   * How much it matters if this identity's owner fails or becomes unavailable. Not part of any
   * derived identifier, same as about/tags/uri. Defaults to Criticality.Unspecified.
   */
  readonly criticality: Criticality;

  /**
   * The team or group that owns the service this identity represents, e.g.
   * "payments-platform". Distinct from origin (the owning company/domain) — this says who
   * *inside* that company is responsible. Not part of any derived identifier. Empty string
   * means unset, same convention as about.
   */
  readonly team: string;

  /**
   * How this instance came to exist. Not part of any derived identifier. Always
   * Provenance.Declared for anything built through `ServiceId.of`; only a future parsing
   * function sets Provenance.Parsed.
   */
  readonly provenance: Provenance;
}

/**
 * Options for `ServiceId.of(...)`. Only origin, scope and kind are required. `null` is accepted
 * alongside `undefined` for every optional field, matching Kotlin's nullable parameters.
 */
export interface ServiceIdOptions {
  readonly origin: string;
  readonly scope: string;
  readonly kind: Kind;
  readonly env?: string | null;
  readonly about?: string | null;
  readonly version?: string | null;
  readonly instance?: string | null;
  readonly tags?: readonly Tag[] | null;
  readonly uri?: string | null;
  readonly criticality?: Criticality | null;
  readonly team?: string | null;
}

/**
 * The private constructor's actual parameter shape: `ServiceIdOptions` plus `provenance`, which
 * is deliberately absent from the public `ServiceIdOptions` interface `of()` exposes. Not
 * exported. `newInstance`/`with` spread `{...this, ...}` into the constructor, which now
 * naturally carries the original's `provenance` through — matching Kotlin's `copy()`, which
 * preserves every field not explicitly overridden. `of()` never sets this, so it's always
 * `undefined` there and the constructor defaults it to `Declared`.
 */
interface ServiceIdConstructorOptions extends ServiceIdOptions {
  readonly provenance?: Provenance;
}

/**
 * Identity used to identify services/components.
 *
 * ```
 * path      = origin:scope
 * name      = path:kind                   = origin:scope:kind
 * fullName  = name:env                    = origin:scope:kind:env
 * install   = fullName:version            = origin:scope:kind:env:version
 * privateId = install:instance            = origin:scope:kind:env:version:instance
 * ```
 *
 * For `ServiceId.api("acme", "accounts.signup", "qat")` with `version: "1.4.2"`:
 * ```
 * path      = acme:accounts.signup
 * name      = acme:accounts.signup:api
 * fullName  = acme:accounts.signup:api:qat
 * install   = acme:accounts.signup:api:qat:1.4.2
 * privateId = acme:accounts.signup:api:qat:1.4.2:4a3b300b-d0ac-4776-8a9c-31aa75e412b3
 * ```
 *
 * Every segment except `instance` is lowercased, so two identities that only differ by casing in
 * origin/scope/kind/env/version still produce the same path/name/fullName/install/privateId.
 * `instance` is left exactly as given, since folding its case could make two genuinely different
 * instances collide.
 *
 * `privateId` carries real operational detail (exact version, environment, instance) and is meant
 * for internal, trusted service-to-service use only. `externalId` (an alias for `path`) is the
 * safe choice for anything crossing outside your trust boundary — see the security note in the
 * README.
 *
 * Immutable. `newInstance`/`with` return a new `ServiceId` rather than mutating this one.
 *
 * Two identities are equal when their `privateId` is equal, so about/tags/uri/criticality/team/
 * provenance don't count. This matches how identity actually travels on the wire: a caller sends
 * its `privateId` as a header (e.g. `caller-id`, internal service-to-service calls only), and a
 * server treats two requests as the same caller exactly when that value matches, nothing more.
 * `toString()` returns the same `privateId`.
 *
 * There's no public constructor. `ServiceId.of(...)` (or the named shortcuts below it) is the
 * only way to build one, and it's the only place origin/scope/env/version get normalized, see
 * `normalize`.
 */
export class ServiceId implements IServiceId {
  readonly origin: string;
  readonly scope: string;
  readonly kind: Kind;
  readonly env: string;
  readonly about: string;
  readonly version: string;
  readonly instance: string;
  readonly tags: readonly Tag[];
  readonly uri: string | null;
  readonly criticality: Criticality;
  readonly team: string;
  readonly provenance: Provenance;

  private constructor(options: ServiceIdConstructorOptions) {
    this.origin = options.origin;
    this.scope = options.scope;
    this.kind = options.kind;
    this.env = options.env ?? "dev";
    this.about = options.about ?? "";
    this.version = options.version ?? "latest";
    this.instance = options.instance ?? randomUuid();
    this.tags = Object.freeze([...(options.tags ?? [])]);
    this.uri = options.uri ?? null;
    this.criticality = options.criticality ?? Criticality.Unspecified;
    this.team = options.team ?? "";
    this.provenance = options.provenance ?? Provenance.Declared;
  }

  /** `origin:scope`, lowercased, e.g. "acme:accounts.signup". */
  get path(): string {
    return `${this.origin.toLowerCase()}${SERVICE_ID_DELIMITER}${this.scope.toLowerCase()}`;
  }

  /** `path` plus `kind`, lowercased, e.g. "acme:accounts.signup:api". The same component, any environment. */
  get name(): string {
    return `${this.path}${SERVICE_ID_DELIMITER}${this.kind.toLowerCase()}`;
  }

  /** `name` plus `env`, lowercased, e.g. "acme:accounts.signup:api:qat". */
  get fullName(): string {
    return `${this.name}${SERVICE_ID_DELIMITER}${this.env.toLowerCase()}`;
  }

  /**
   * `fullName` plus `version`, lowercased, e.g. "acme:accounts.signup:api:qat:1.4.2". Named for
   * what it is: a specific version installed into a specific environment.
   */
  get install(): string {
    return `${this.fullName}${SERVICE_ID_DELIMITER}${this.version.toLowerCase()}`;
  }

  /**
   * `install` plus `instance`, not lowercased, e.g.
   * "acme:accounts.signup:api:qat:1.4.2:4a3b300b-d0ac-4776-8a9c-31aa75e412b3". Unique per running
   * instance.
   *
   * Carries real operational detail (exact version, environment, instance). Internal, trusted
   * service-to-service use only — use `externalId` instead for anything that crosses outside your
   * trust boundary. See the security note in the README.
   */
  get privateId(): string {
    return `${this.install}${SERVICE_ID_DELIMITER}${this.instance}`;
  }

  /**
   * Alias for `path` — this identity's external-safe form: origin/scope only, no version,
   * environment, or instance detail. Use this instead of `privateId` for anything crossing
   * outside your trust boundary. See the security note in the README.
   */
  get externalId(): string {
    return this.path;
  }

  /** Same identity with a new random instance id. */
  newInstance(): ServiceId {
    return new ServiceId({ ...this, instance: randomUuid() });
  }

  /**
   * Same identity with the given instance id (random if null/undefined) and tags.
   *
   * @throws {Error} if `inst` contains SERVICE_ID_DELIMITER.
   */
  with(inst: string | null | undefined, tags: readonly Tag[]): ServiceId {
    const resolvedInstance = inst ?? randomUuid();
    if (resolvedInstance.includes(SERVICE_ID_DELIMITER)) {
      throw new Error(`instance must not contain '${SERVICE_ID_DELIMITER}': ${resolvedInstance}`);
    }
    return new ServiceId({ ...this, instance: resolvedInstance, tags });
  }

  equals(other: IServiceId): boolean {
    return this.privateId === ServiceId.of(other).privateId;
  }

  toString(): string {
    return this.privateId;
  }

  /** A placeholder identity, for tests and defaults. */
  static readonly empty: ServiceId = new ServiceId({ origin: "", scope: "empty", kind: Kind.Test, env: "empty" });

  static app(origin: string, scope: string, env = "dev"): ServiceId {
    return ServiceId.of({ origin, scope, kind: Kind.App, env });
  }

  static api(origin: string, scope: string, env = "dev"): ServiceId {
    return ServiceId.of({ origin, scope, kind: Kind.API, env });
  }

  static cli(origin: string, scope: string, env = "dev"): ServiceId {
    return ServiceId.of({ origin, scope, kind: Kind.CLI, env });
  }

  static job(origin: string, scope: string, env = "dev"): ServiceId {
    return ServiceId.of({ origin, scope, kind: Kind.Job, env });
  }

  /** A test identity: scope is "tests.<name>", kind is Test, env is "dev". */
  static test(origin: string, name: string): ServiceId {
    return ServiceId.of({ origin, scope: `tests.${name}`, kind: Kind.Test, env: "dev" });
  }

  /**
   * Builds a ServiceId from names, normalizing origin/scope/env/version (see `normalize`). This
   * is the only public way to build one, since the constructor itself is private.
   *
   * `instance` is validated, not normalized: `normalize` lowercases as part of its filtering,
   * which would violate the one invariant `instance` documents (never folded to a single case,
   * since that's what keeps two different instances from colliding). A caller-supplied `instance`
   * containing SERVICE_ID_DELIMITER throws instead of silently producing a `privateId` with more
   * segments than the chain assumes.
   *
   * @throws {Error} if `instance` contains SERVICE_ID_DELIMITER.
   */
  static of(options: ServiceIdOptions): ServiceId {
    const resolvedInstance = options.instance ?? randomUuid();
    if (resolvedInstance.includes(SERVICE_ID_DELIMITER)) {
      throw new Error(`instance must not contain '${SERVICE_ID_DELIMITER}': ${resolvedInstance}`);
    }
    return new ServiceId({
      ...options,
      origin: normalize(options.origin),
      scope: normalize(options.scope),
      env: normalize(options.env ?? "dev"),
      version: normalize(options.version ?? "latest"),
      instance: resolvedInstance,
    });
  }

  /**
   * Reconstructs a ServiceId from a privateId string. Strict: only the full 6-segment form is
   * accepted; throws on a wrong segment count, an unrecognized Kind, a blank segment, or an
   * origin/scope/env/version with characters `normalize` would strip, naming exactly what was
   * wrong, matching of/with's style of rejecting bad input rather than silently swallowing it.
   * origin/scope/kind/env/version are lowercased, so a parsed identity holds the same field values
   * as one built with `of`; instance is left as given, same as `of`. Only the six chain fields come back — about/tags/uri/criticality/team weren't
   * part of privateId and get their defaults. `provenance` is Provenance.Parsed.
   */
  static parse(raw: string): ServiceId {
    const segments = raw.split(SERVICE_ID_DELIMITER);
    if (segments.length !== 6) {
      throw new Error(`expected 6 segments (origin:scope:kind:env:version:instance), got ${segments.length}: '${raw}'`);
    }

    const [originRaw, scopeRaw, kindSegment, envRaw, versionRaw, instance] = segments as [
      string, string, string, string, string, string,
    ];
    if (![originRaw, scopeRaw, envRaw, versionRaw, instance].every((s) => s.trim() !== "")) {
      throw new Error(`blank segment in '${raw}'`);
    }

    // Lowercased like `of` does, then rejected, not rewritten, when `normalize` would have stripped
    // anything else: untrusted header text doesn't silently change into something else.
    const clean = (name: string, segment: string): string => {
      const lowered = segment.toLowerCase();
      if (lowered !== normalize(lowered)) {
        throw new Error(`${name} has characters that aren't allowed: '${segment}' in '${raw}'`);
      }
      return lowered;
    };
    const origin = clean("origin", originRaw);
    const scope = clean("scope", scopeRaw);
    const env = clean("env", envRaw);
    const version = clean("version", versionRaw);

    const kind = (Object.values(Kind) as string[]).find((k) => k.toLowerCase() === kindSegment.toLowerCase()) as
      | Kind
      | undefined;
    if (kind === undefined) {
      throw new Error(`unrecognized kind '${kindSegment}' in '${raw}'`);
    }

    return new ServiceId({ origin, scope, kind, env, version, instance, provenance: Provenance.Parsed });
  }
}

/**
 * Normalizes a name into an identifier: lowercased, trimmed, keeping only letters, digits, "-",
 * "_", ".", and space, with spaces turned into "_". Falls back to "_" if nothing survives, e.g.
 * "My Company" -> "my_company", "Accounts Team.Sign Up!" -> "accounts_team.sign_up". Dots are
 * kept so a scope like "accounts.signup" survives normalization intact. Letters and digits are
 * Unicode-aware, same as Kotlin's `isLetter`/`isDigit`.
 */
function normalize(value: string): string {
  const filtered = value.trim().toLowerCase().replace(/[^\p{L}\p{Nd}\-_. ]/gu, "");
  const cleaned = filtered.trim() === "" ? "_" : filtered;
  return cleaned.replaceAll(" ", "_");
}
