# @kiitdev/service-id

Who is making a call, what kind of runnable thing they are, and a caller-safe way to expose it. A native TypeScript port of the Kotlin [`kiit-service-id`](../../README.md), checked against it. It isn't a wrapper. Runs in Node and in the browser, no dependencies.

```ts
import { ServiceId } from "@kiitdev/service-id";

const id = ServiceId.api("acme", "accounts.signup", "qat");

id.name;       // "acme:accounts.signup:api"
id.install;    // "acme:accounts.signup:api:qat:latest"
id.externalId; // "acme:accounts.signup" — safe to expose outside your trust boundary
```

Pre-1.0: the API may still shift before a stable release.

## Install

```bash
npm install @kiitdev/service-id
```

## Security: internal use only

`ServiceId.privateId` (and the `caller-id` header convention built on it) is meant for internal, trusted service-to-service traffic — not for anything that crosses out to a browser, a public API response, or a third-party partner. This cuts both ways: it also covers calls made *from* a browser. Your own frontend (a React app, say) calling your own API is still an external caller — the trust boundary is about where the caller runs, not what you call the destination. Give a frontend app `Kind.Web` and have it send `externalId`, same as any other external caller.

It encodes real operational detail: exact version, environment (dev/qat/pro), and instance identifiers. Outside your trust boundary, that's reconnaissance material — the same category of risk as leaving a `Server` or `X-Powered-By` header exposed. Strip it at your edge/gateway layer before anything leaves your infrastructure.

If you need to expose an identity externally, use `ServiceId.externalId` instead of `privateId` — it carries none of the version/environment/instance detail.

```ts
// Internal service-to-service call — full detail, fine inside your trust boundary
outgoingRequest.header("caller-id", id.privateId);
// "acme:accounts.signup:api:qat:1.4.2:4a3b300b-d0ac-4776-8a9c-31aa75e412b3"

// Crossing out to a partner, a public API response, or a browser — reduced, no operational detail
outgoingRequest.header("caller-id", id.externalId);
// "acme:accounts.signup"
```

This isn't enforced by the library. It's a convention, and the responsibility for keeping `privateId` inside your trust boundary is yours.

## ServiceId

`ServiceId` builds up five accessors, one field at a time, each one lowercased except `instance`:

| Accessor | Adds | Example |
|---|---|---|
| `path` | `origin`, `scope` | `acme:accounts.signup` |
| `name` | `kind` | `acme:accounts.signup:api` |
| `fullName` | `env` | `acme:accounts.signup:api:qat` |
| `install` | `version` | `acme:accounts.signup:api:qat:1.0.2` |
| `privateId` | `instance` | `acme:accounts.signup:api:qat:1.0.2:4a3b300b-...` |

`name` reads the same regardless of environment ("this component"), `fullName` pins it to one environment, `install` pins it to one version deployed there, and `privateId` is unique per running instance. `externalId` is a separate alias for `path` — see [Security](#security-internal-use-only) above.

Shortcuts cover the common kinds: `ServiceId.app`, `api`, `cli`, `job` take `(origin, scope, env = "dev")`, and `ServiceId.test(origin, name)` puts the identity under a `tests.<name>` scope. For everything else, use `ServiceId.of` with an options object:

```ts
import { Criticality, Kind, ServiceId } from "@kiitdev/service-id";

const id = ServiceId.of({
  origin: "Code Helix",              // normalized: "code_helix"
  scope: "Accounts Team.Sign Up!",   // "accounts_team.sign_up"
  kind: Kind.Worker,
  env: "PRO",                        // normalized: "pro"
  version: "1.0.2",
  about: "Sends the welcome email after signup",
  uri: "worker-7.codehelix.internal",
  criticality: Criticality.High,
  team: "payments-platform",
});
```

`of` normalizes `origin`, `scope`, `env`, and `version` (lowercased, trimmed, only letters, digits, `-`, `_`, `.` and spaces kept, spaces turned into `_`, `_` if nothing is left). Letters and digits are Unicode-aware, so `café` and `日本語` survive. Dots in `scope` are kept on purpose, so hierarchy like `"accounts.signup"` survives intact. `instance` is validated instead: `of` throws if it contains `:` (the delimiter), rather than lowercasing it — lowercasing would risk merging two genuinely different instances that only differ by case. There's no public constructor — `ServiceId.of` (or the shortcuts above it) is the only way to build one.

`env` is a plain string, not a typed enum, so pass whatever env label you already use.

## Fields

| Field | What it is |
|---|---|
| `origin` | Domain-like label for who owns this, e.g. `"acme.com"` or `"acme"`. |
| `scope` | Free-form, consumer-defined label for where in `origin` this lives, e.g. `"accounts.signup"`. Dots express hierarchy; kiit-service-id never parses it, and it shouldn't contain `:` (reserved for the delimiter). |
| `kind` | What kind of runnable thing this is. See [Kind](#kind) below. |
| `env` | dev \| qat \| pro, environment. |
| `version` | Defaults to `"latest"`. |
| `instance` | Id of this specific running instance. Random by default, never lowercased. |
| `about` | Short description. Not part of any derived accessor. |
| `tags` | Labels attached to this identity. See [Tag](#tag) below. Not part of any derived accessor, and not normalized. |
| `uri` | Optional reference to this instance (a hostname, a service-discovery address). Not part of any derived accessor. |
| `criticality` | How much it matters if this fails or becomes unavailable. See [Criticality](#criticality) below. Not part of any derived accessor. |
| `team` | The team or group that owns this service, e.g. `"payments-platform"`. Distinct from `origin` (the owning company). Not part of any derived accessor. |
| `provenance` | How this instance came to exist. See [Provenance](#provenance) below. Not part of any derived accessor. |

`IServiceId` is the plain data contract above (all fields, no behavior), exported for anyone who wants a custom shape. `ServiceId` is the concrete implementation, and the only place `path`/`name`/`fullName`/`install`/`privateId`/`externalId` live. Implementing `IServiceId` yourself doesn't get you those for free, on purpose: if you need them, build a real `ServiceId`.

## Immutable

`newInstance()` and `with(inst, tags)` return a new `ServiceId`. The original is never changed, and both preserve `provenance` from the original (matching Kotlin's `copy()` semantics — nothing resets it to `Declared` just because a copy was made).

```ts
const original = ServiceId.job("acme", "accounts.signup");
const tagged = original.with(null, [Tag.Keyed("region", "us-east-1")]); // null: generate a new instance id

original.tags;  // []
tagged.tags;    // [{ variant: "Keyed", key: "region", value: "us-east-1", raw: "region=us-east-1" }]
```

## Kind

`Kind` is `App`, `CLI`, `Web`, `API`, `Bot`, `Job`, `Worker`, `Service`, `Gateway`, `Function`, `Agent` or `Test`. It's an `as const` object with a matching union type, so `Kind.Job` and a `switch` over a `Kind` both type-check exhaustively.

## Criticality

How much it matters if the thing this `ServiceId` describes fails or becomes unavailable: `Unspecified` (the default), `Low`, `Medium`, `High`, `Critical`. Mirrors OpenTelemetry's `service.criticality` resource attribute (Alpha stability as of this writing), extended here to describe a caller's identity rather than only a telemetry-emitting service's own. Not part of any derived identifier — two identities that differ only in `criticality` are still the same identity for equality purposes.

## Provenance

How a `ServiceId` instance came to exist: `Declared` (built via `ServiceId.of`) or `Parsed` (reconstructed via `ServiceId.parse`). Says nothing about whether the underlying values are truthful — a `Parsed` identity is honestly labeled as unauthenticated, not verified as accurate. `ServiceId.of` never exposes this as an option, so every identity built through it is `Declared` by construction.

**Parsing.** `ServiceId.parse(raw)` reconstructs an identity from a `privateId` string (e.g. a `caller-id` header value), throwing with the specific reason if it isn't well-formed. Only the six chain fields come back; `about`/`tags`/`uri`/`criticality`/`team` get their defaults, and `provenance` is `Parsed`.

```ts
const id = ServiceId.parse(request.headers["caller-id"]);
```

## Tag

A label attached to an identity: either a bare value or a key/value pair.

```ts
import { Tag } from "@kiitdev/service-id";

Tag.Basic("retry");                    // { variant: "Basic", value: "retry", raw: "retry" }
Tag.Keyed("region", "us-east-1");      // { variant: "Keyed", key: "region", value: "us-east-1", raw: "region=us-east-1" }
Tag.parse("region=us-east-1");         // same as Tag.Keyed("region", "us-east-1")
```

`Tag.parse` splits on the first `TAG_DELIMITER` (`"="`), so a value containing `=` (e.g. `"config=key=value"`) parses to `Tag.Keyed("config", "key=value")`. `TAG_DELIMITER` is its own constant, separate from `SERVICE_ID_DELIMITER` — a tag's key/value syntax is a different protocol from the `path`/`name`/`fullName`/`install`/`privateId` chain, and giving each its own delimiter means changing one never risks the other. `variant` is a TypeScript-only addition: Kotlin narrows with `is Tag.Basic`/`is Tag.Keyed` against the sealed class itself, which has no equivalent over a plain object here, so `variant` is what a `switch` narrows on instead. Named `variant`, not `kind`, so it doesn't collide with `ServiceId`'s own `kind` field — a completely different classification — within the same package.

`Tag.Basic`/`Tag.Keyed` are exported factory functions, not classes — `raw` is computed from `value`/`key` at construction, not enforced afterward. Building the object shape by hand instead of going through the factories (or `parse`) can produce a `Tag` where `raw` doesn't actually match `value`/`key`; that's not supported.

## Equality and string form

Two identities are equal when their `privateId` is equal. Tags, `about`, `uri`, `criticality`, `team`, and `provenance` don't count — this matches how identity actually travels on the wire: a caller sends its `privateId` as a header (e.g. `caller-id`), and a server treats two requests as the same caller exactly when that value matches, nothing more.

```ts
const a = ServiceId.of({ origin: "acme", scope: "x", kind: Kind.App, instance: "i-1" });

a.equals(a.with("i-1", [Tag.Basic("tagged")]));  // true, same privateId
a.equals(a.newInstance());                       // false, new instance
`${a}`;                                          // the privateId
```

`toString()` returns the same `privateId`, so it works as a `Map` key.

## Differences from Kotlin

1. There's no public constructor. `ServiceId.of(...)` (or the named shortcuts) is the only way to build one; Kotlin keeps an `internal` (module-visible) raw constructor alongside `of`.
2. `Kind` has no int value. Nothing in the port used it.
3. `Tag`'s `variant` field doesn't exist on Kotlin's `Tag` — see [Tag](#tag) above.

## Browser

The instance id comes from `crypto.randomUUID()`, which browsers only expose on HTTPS pages and on localhost. On a plain-HTTP page, the port builds the UUID from `crypto.getRandomValues` instead, so `ServiceId.of` doesn't throw there.

## License

[Apache License 2.0](../../LICENSE)
