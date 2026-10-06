# kiit-service-id: overview

Draft for the author to correct. `TODO(why)` marks a decision where the code shows what was done but nothing in the repo says why. Paths are relative to the repo root.

## Problem
Calls and services can be difficult to identify. This is especially true of http requests, and for internal service to service communication. Also, there is a lack of structure/convention to naming services. OTEL has improved this with service attributes, and this component takes it a step further by encoding it via a static type and interface with semantically meaningful service attributes. 


## Goals
1. A contract for a service id with meaningful attributes to describe the service.
2. Service attributes to describe ownership, service types, environments, versions and more
3. Compatibility with OTEL Service attributes for telemetry integration
4. Security considerations via a external (externalId) and private (privateId) service id
5. A tiny zero dependency library available in Kotlin KMP, with a native Typescript port


## Non-goals
1. Authentication or authorization. A parsed identity is unverified input (seeProvenance.kt)
2. Enforcing the trust boundary. Using `privateId` only internally is a convention.
3. A service registry or discovery. `uri` is a reference field, nothing looks it up.


## Decisions
1. **One chain of derived accessors.** `path` → `name` → `fullName` → `install` → `privateId`, each adding one field ([`ServiceId.kt`](kiit-service-id/src/commonMain/kotlin/kiit/serviceid/ServiceId.kt)). Reason: each level answers a different question: this component, in one environment, at one version, as one running instance. Cost: six fixed segments, so `:` is reserved.
2. **`externalId` is an alias for `path`.** It carries only `origin:scope`. Reason: it is the form with no operational detail, so it is safe to expose. Cost: callers must choose it, nothing stops them sending `privateId` ([README: Security](README.md)).
3. **Equality is `privateId` only.** `about`, `tags`, `uri`, `criticality`, `team` and `provenance` don't count. Reason: a server treats two requests as one caller when the `caller-id` header value matches, and nothing else travels on the wire. `equals`, `hashCode` and `toString` are overridden together to match (`ServiceId.equals`).
4. **Immutable.** `with()` and `newInstance()` return a new value. Cost: the constructor and `copy()` are `internal`, so code inside the module can still make an un-normalized copy. The code accepts that gap over giving up `data class` (`ServiceId` class KDoc).
5. **`of()` normalizes, the constructor doesn't.** `origin`, `scope`, `env` and `version` are lowercased and stripped to letters, digits, `-`, `_`, `.` and spaces, with spaces turned into `_`. `instance` is validated and not normalized, because folding its case could make two different instances collide (`ServiceId.of`, `normalize`).
6. **`IServiceId` is a bare data contract.** The derived accessors live only on `ServiceId`. Reason: implementing the interface for a custom shape shouldn't promise accessors the shape never defined (`IServiceId` KDoc). Cost: a custom implementation gets none of them.
7. **`Kind` and `Criticality` are closed enums.** `Criticality` mirrors OpenTelemetry's `service.criticality`.
8. **`parse` is strict.** Exactly six segments, a known `Kind`, no blank segment, otherwise
   `IllegalArgumentException` naming the problem. It returns the six chain fields and sets `provenance` to
   `Parsed` (`ServiceId.parse`). Reason: matches `of` and `with`, which also reject bad input.
   Cost: it does not normalize, so a parsed value keeps the case it arrived in, and the accessors lowercase
   only when read. `TODO(why)`: whether that asymmetry with `of` is intended.
9. **`env` is a plain string.** This doesn't enforce naming environments. 
10. **`Tag` lives here, with `=` as its delimiter.** The delimiter changed from `:` to `=` so it doesn't clash with the
    chain's `:` ([`Tag.kt`](kiit-service-id/src/commonMain/kotlin/kiit/serviceid/Tag.kt),
    [CHANGELOG](CHANGELOG.md)). Cost: `kiit-requests` still has its own `Tag` until it migrates.
11. **No health or ownership logic.** `team`, `criticality` and `about` are descriptive fields only and never part of an identifier. 

## Limitations

1. The trust boundary is a convention, not a check.
2. Tags are stored as given, not normalized.
3. `Kind` is a closed set. 
4. `parse` does not normalize or validate `env` and `version`.

## Alternatives
1. **A string constant.** No shared shape, no parse, easy to leak. This module exists to
   replace it.
2. **OpenTelemetry resource attributes.** They describe the producer of telemetry, set once per process
   and attached to every signal. `ServiceId` is a value that travels in requests, is parsed and compared,
   and keys caches and jobs. `criticality` here is borrowed from OTel's `service.criticality`. It isn't
   built on the resource model for three reasons:
   1. **Different identity.** OTel treats `deployment.environment.name` and `service.version` as not
      part of a service's identity. `ServiceId` equality is `privateId`, which includes both, because a
      server sees that string in a `caller-id` header and two builds are different callers.
   2. **Different shape.** A resource is an open attribute map. `ServiceId` has fixed fields, derived
      string forms and a strict `parse`, and it adds `kind`, `externalId` and `provenance`, which
      resources don't have.
   3. **No dependency.** The module has none, and a resource model would add one to every subsystem
      that uses it.

   The five service fields do map onto resource attributes, so a one-way conversion belongs in a
   separate telemetry adapter, not here. The open choice is `origin` against `service.namespace`: `origin`
   is the owning organization, and OTel's namespace is a grouping inside it.

## Key files

1. [`ServiceId.kt`](kiit-service-id/src/commonMain/kotlin/kiit/serviceid/ServiceId.kt): the chain,
   equality, `of`, `parse`, `normalize`
2. [`Tag.kt`](kiit-service-id/src/commonMain/kotlin/kiit/serviceid/Tag.kt),
   [`Kind.kt`](kiit-service-id/src/commonMain/kotlin/kiit/serviceid/Kind.kt),
   [`Criticality.kt`](kiit-service-id/src/commonMain/kotlin/kiit/serviceid/Criticality.kt),
   [`Provenance.kt`](kiit-service-id/src/commonMain/kotlin/kiit/serviceid/Provenance.kt)
3. [`ServiceIdTest.kt`](kiit-service-id/src/commonTest/kotlin/kiit/serviceid/ServiceIdTest.kt): the
   behavior the code guarantees
4. [`ports/kiit-service-id-ts`](ports/kiit-service-id-ts): the TypeScript port
5. [`samples`](samples): runnable examples
6. [`CHANGELOG.md`](CHANGELOG.md): why `Tag` moved and its delimiter changed
