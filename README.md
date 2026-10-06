<div align="center">

# kiit-service-id

**Shared identity vocabulary for a service: who it is, what kind of thing it is, and a caller-safe way to expose it. Kotlin Multiplatform.**

[![Build](https://img.shields.io/github/actions/workflow/status/kiitdev/kiit-service-id/ci.yml?branch=main)](https://github.com/kiitdev/kiit-service-id/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/kiitdev/kiit-service-id)](./LICENSE)
[![Kotlin](https://img.shields.io/badge/kotlin-multiplatform-purple.svg)](https://kotlinlang.org)

Part of [Kiit](https://www.kiit.dev)

</div>

## Table of Contents

- [Why](#why)
- [Start](#start)
- [Security: internal use only](#security-internal-use-only)
- [Concepts](#concepts)
- [Usage](#usage)
- [Requirements](#requirements)
- [License](#license)

## Why

A cache entry needs to know which service owns it. A telemetry counter needs to know which service emitted it. A background job needs its own identity for logging. All of these are the same question, asked from different places: who is this? Most codebases answer it separately per subsystem, a string constant here, a config key there, nothing connecting them. kiit-service-id is that one shared identity vocabulary, reused everywhere something needs to be attributed to a service, instead of reinvented per subsystem.

```kotlin
import kiit.serviceid.ServiceId

val id = ServiceId.api(origin = "acme", scope = "accounts.signup", env = "qat")

println(id.name)       // acme:accounts.signup:api
println(id.install)    // acme:accounts.signup:api:qat:latest
println(id.externalId) // acme:accounts.signup — safe to expose outside your trust boundary
```

None of these types are tied to requests, RPC, caching, telemetry, or jobs specifically. Each of those depends on kiit-service-id, it doesn't depend on any of them.

## Start

kiit-service-id hasn't been published to Maven Central yet. Once it is:

```kotlin
dependencies {
    implementation("dev.kiit:kiit-service-id:<version>")
}
```

**ServiceId is immutable.** `newInstance()`/`with()` return a new value rather than mutating:

```kotlin
import kiit.serviceid.ServiceId
import kiit.serviceid.Tag

val original = ServiceId.job("acme", "accounts.signup")
val retried = original.with(inst = null, tags = listOf(Tag.Basic("retry")))

println(original.tags)  // []
println(retried.tags)   // [Basic(value=retry)]
```

See [`samples/sample-kotlin`](./samples/sample-kotlin) for a runnable end-to-end example.

**TypeScript.** A native port lives in [`ports/kiit-service-id-ts`](./ports/kiit-service-id-ts) (`@kiitdev/service-id`), with a sample in [`samples/sample-ts`](./samples/sample-ts).

## Security: internal use only

`ServiceId.privateId` (and the `caller-id` header convention built on it) is meant for internal, trusted service-to-service traffic — not for anything that crosses out to a browser, a public API response, or a third-party partner. This cuts both ways: it also covers calls made *from* a browser. Your own frontend (a React app, say) calling your own API is still an external caller — the trust boundary is about where the caller runs, not what you call the destination. Give a frontend app `Kind.Web` and have it send `externalId`, same as any other external caller.

It encodes real operational detail: exact version, environment (dev/qat/pro), and instance identifiers. Outside your trust boundary, that's reconnaissance material — the same category of risk as leaving a `Server` or `X-Powered-By` header exposed ([OWASP WSTG](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/08-Fingerprint_Web_Application_Framework), [OWASP ZAP alert](https://www.zaproxy.org/docs/alerts/10037/)). Strip it at your edge/gateway layer before anything leaves your infrastructure.

If you need to expose an identity externally, use `ServiceId.externalId` instead of `privateId` — it carries none of the version/environment/instance detail.

```kotlin
// Internal service-to-service call — full detail, fine inside your trust boundary
outgoingRequest.header("caller-id", id.privateId)
// "acme:accounts.signup:api:qat:1.4.2:4a3b300b-d0ac-4776-8a9c-31aa75e412b3"

// Crossing out to a partner, a public API response, or a browser — reduced, no operational detail
outgoingRequest.header("caller-id", id.externalId)
// "acme:accounts.signup"
```

This isn't enforced by the library. It's a convention, and the responsibility for keeping `privateId` inside your trust boundary — and never letting it influence an authorization decision for a request that could have originated outside it — is yours.

## Concepts

`ServiceId` builds up five accessors, one field at a time, each one lowercased except `instance`:

| Accessor | Adds | Example |
|---|---|---|
| `path` | `origin`, `scope` | `acme:accounts.signup` |
| `name` | `kind` | `acme:accounts.signup:api` |
| `fullName` | `env` | `acme:accounts.signup:api:qat` |
| `install` | `version` | `acme:accounts.signup:api:qat:1.0.2` |
| `privateId` | `instance` | `acme:accounts.signup:api:qat:1.0.2:4a3b300b-...` |

`name` is the same regardless of environment ("this component"), `fullName` pins it to one environment, `install` pins it to one version deployed to that environment, and `privateId` is unique per running instance. `externalId` is a separate alias for `path` — see [Security](#security-internal-use-only) for why it exists.

| Term | What it is |
|---|---|
| **`origin`** | Domain-like label for who owns this, e.g. `"acme.com"` or `"acme"`. Same convention as `Status.origin` in [kiit-codes](../kiit-codes). |
| **`scope`** | Free-form, consumer-defined label for where in `origin` this lives, e.g. `"accounts.signup"`. Dots express hierarchy, same convention as `Status.scope`. |
| **`Kind`** | What kind of runnable app or service has this identity: `App`, `CLI`, `Web`, `API`, `Bot`, `Agent`, `Job`, `Worker`, `Service`, `Test`. A closed set, a real enum, no runtime-extensible case. |
| **`about`** | Short, human-readable description of what this is or does. Not part of any derived accessor. |
| **`tags`** | Labels attached to this identity: `Tag.Basic("retry")` or `Tag.Keyed("region", "us-east-1")`. `Tag.parse("region=us-east-1")` splits on the first `=`. Not part of any derived accessor, and not normalized — a tag's value often needs preserving exactly as given (a trace id, a hash), not canonicalized the way `origin`/`scope` are. |
| **`uri`** | Optional reference to this instance itself (a hostname, a service-discovery address). Unique per environment, not part of any derived accessor. |
| **`criticality`** | How much it matters if this fails or becomes unavailable: `Unspecified` (default), `Low`, `Medium`, `High`, `Critical`. Mirrors OpenTelemetry's `service.criticality` resource attribute (Alpha stability). Not part of any derived accessor. |
| **`team`** | The team or group that owns this service, e.g. `"payments-platform"`. Distinct from `origin` (the owning company) — this says who *inside* it is responsible. Not part of any derived accessor. |
| **`provenance`** | How this instance came to exist: `Declared` (built via `of`) or `Parsed` (reconstructed via `parse` from a propagated string, e.g. a header value). Not part of any derived accessor. |

`IServiceId` is the plain data contract (all fields, no behavior) for anyone who wants a custom shape. `ServiceId` is the concrete, constructible implementation, and the only place `path`/`name`/`fullName`/`install`/`privateId`/`externalId` live — implementing `IServiceId` yourself doesn't get you those for free, on purpose. If you need them, build a real `ServiceId`.

**Equality.** Two identities are equal when their `privateId` is equal, so `about`/`tags`/`uri`/`criticality`/`team`/`provenance` don't count — `equals`/`hashCode`/`toString` are all overridden to match, rather than relying on `data class`'s default (which would otherwise compare/print every field). This mirrors how identity actually travels on the wire: a caller sends its `privateId` as a header (e.g. `caller-id`), and a server treats two requests as the same caller exactly when that value matches, nothing more.

`ServiceId.env` is a plain `String`, not a typed enum. kiit-service-id has no dependency on the environment-selection module (`kiit-conf-envs`), since `ServiceId` is needed well beyond env-aware bootstrap code, so callers pass whatever env label they're already using.

**Parsing.** `ServiceId.parse(raw)` reconstructs an identity from a `privateId` string (e.g. a `caller-id` header value), throwing `IllegalArgumentException` with the specific reason if it isn't well-formed. Only the six chain fields come back; `about`/`tags`/`uri`/`criticality`/`team` get their defaults, and `provenance` is `Parsed`.

```kotlin
val id = ServiceId.parse(request.header("caller-id"))
```

## Usage

**Good fit if:**
1. You want one consistent "who/what is this" identifier reused across caching, telemetry, jobs, requests, and anywhere else that needs to attribute something to a service.
2. You're building several things (a server, a client, a job runner) that each need to identify themselves the same way.

**Probably not necessary if:**
1. You only have one service and don't log, cache, or trace anything by identity, a hardcoded string is simpler in that case.
2. A free-text string is enough, you don't need a structured, machine-parseable identity.

## Requirements

- Kotlin Multiplatform
- JVM, Android, iOS (arm64, simulator arm64, x64)
- TypeScript port: Node 24+ and modern browsers
- No dependencies

## License

[Apache License 2.0](./LICENSE)

---

<div align="center">

**kiit-service-id** is one module of [Kiit](https://www.kiit.dev), a lightweight, modular
Kotlin toolkit for building server applications, APIs, CLIs, and jobs.

**Adopt one module at a time.**

</div>
