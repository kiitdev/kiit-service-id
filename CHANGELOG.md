# Changelog

All notable changes to kiit-service-id are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/), versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Extracted from the Kiit monorepo as its own standalone module.
- `@kiitdev/service-id`, a native TypeScript port of `ServiceId`, `Kind`, and `Tag` in
  `ports/kiit-service-id-ts`, with a sample in `samples/sample-ts`. Equality in the port compares
  `privateId`, and `Kind` has no int `value`, see the port's README.
- `Tag` (`Basic`/`Keyed`, with `parse`), moved here from `kiit-requests`: `ServiceId.tags` and
  `kiit-requests`'s own `tags` field now share one type instead of two independently-drifting
  designs. Its key/value delimiter changed from `:` to `=` (`TAG_DELIMITER`, a public constant
  alongside `SERVICE_ID_DELIMITER`) to avoid two unrelated protocols reaching for the same
  character. `kiit-requests` still has its own local `Tag` for now; that side of the move is a
  followup once this module is published.
- `ServiceId.equals`/`hashCode`/`toString` are explicit, `privateId`-based overrides (`about`/
  `tags`/`uri`/`criticality`/`team`/`provenance` excluded), instead of `data class`'s default
  field-by-field behavior. This matches how identity travels on the wire: a caller sends its
  `privateId` as a header (e.g. `caller-id`), so two identities being "equal" and two requests
  producing the same header value are the same question. `@ConsistentCopyVisibility` was added
  alongside the `internal` constructor so the auto-generated `copy()` doesn't leak past it.
- `Criticality` (`Unspecified`/`Low`/`Medium`/`High`/`Critical`): how much it matters if this
  identity's owner fails or becomes unavailable. Mirrors OpenTelemetry's `service.criticality`
  resource attribute (confirmed Alpha stability in the OTel semantic conventions registry).
- `Kind.Agent`, for AI agents. `Bot` stays for non-AI bots. `ServiceId.parse` accepts `agent` with no other change.
- `team`: the team or group that owns this service, distinct from `origin` (the owning company).
- `Provenance` (`Declared`/`Parsed`): how a `ServiceId` instance came to exist — built locally via
  `of`, or reconstructed from a propagated string via `parse`. `of` never exposes this as a
  parameter, so every identity it builds is `Declared` by construction; `newInstance`/`with`
  preserve the original's `provenance` rather than resetting it, matching Kotlin's `copy()`
  semantics (the TS port needed an explicit internal-only constructor type to get this right,
  since it doesn't have `copy()`'s built-in field-preservation for free).
- `ServiceId.parse(raw)`: reconstructs the six chain fields (`origin`/`scope`/`kind`/`env`/
  `version`/`instance`) from a `privateId` string, e.g. a `caller-id` header value. Strict — only
  the full 6-segment form is accepted, and it throws (`IllegalArgumentException` in Kotlin, `Error`
  in TS) naming exactly what was wrong (segment count, an unrecognized `Kind`, or a blank segment)
  rather than returning null, matching `of`/`with`'s style of rejecting bad input outright.
  `about`/`tags`/`uri`/`criticality`/`team` weren't part of `privateId`, so a parsed identity gets
  their defaults; `provenance` is `Parsed`.
- A `## Security: internal use only` section in both READMEs, placed right after Quick Start.
  `privateId` carries real operational detail (exact version, environment, instance) and is
  internal-only; forwarding it outside your trust boundary — including calls made *from* a
  browser, not just responses sent *to* one — is the same class of risk as leaving a `Server` or
  `X-Powered-By` header exposed. `externalId` (see below) is the safe alternative.

### Changed
- Renamed from `kiit-call` to `kiit-identity`, and later to `kiit-service-id` (see below). Once
  `Verb`/`Version`/`Trace`/`Source`/`Content` moved out to `kiit-requests` (see Removed),
  everything left in this module was about a service's identity, not a call, so the name
  followed; it was later renamed again for the reasons described under "Renamed" below.
- Redesigned `Identity` (now `ServiceId`, see Renamed) to align with kiit-codes' `Status`
  (`origin`/`scope`, `:`-delimited accessors). `company`/`area`/`service` are replaced by
  `origin`/`scope` (a single free-form, dot-structured field). `desc` is renamed `about`. A new
  optional `uri` field was added. `name`/`fullName`/`privateId` are `:`-joined instead of
  `.`-joined, and a new `install` accessor sits between `fullName` and `privateId`
  (`origin:scope:kind:env:version`); `idWithTags` is removed. Every accessor except `instance` is
  lowercased. `ServiceId` now implements a new `IServiceId` interface (a plain data contract, no
  derived accessors of its own) for consumers who want a custom shape. `Kind`'s int `value` is
  dropped, `Svc` is renamed `Service`, and `Worker` is added. Since this module isn't stable yet
  (pre-1.0, published but with no real consumers), this ships as a clean break rather than a
  deprecation path.
- `ServiceId`'s constructor is `internal`; `ServiceId.of` (and the named shortcuts) is the only
  public way to build one. `origin`/`scope`/`env`/`version` normalization can then only ever be
  skipped from inside this module (e.g. in tests), never by an external consumer.
- `of` normalizes `env`/`version` (previously `env` was only lowercased, and `version` wasn't
  touched at all) and validates `instance`, throwing if it contains the delimiter instead of
  silently accepting it. An unsanitized `:` in any of these three fields would otherwise produce
  a derived string with more segments than the chain assumes — a real correctness bug, not a
  style nit, and one that a future `parse()` implementation would depend on not existing. `with`
  got the same `instance` validation — it was the one public method that could still bypass `of`'s
  check, since it calls the constructor directly rather than going through `of`.
- Repo layout flattened to match `kiit-result`: Gradle root files and the module folder moved
  from a nested `-kotlin/` folder to the repo root. Fixes IntelliJ misreading the project
  structure with a nested Gradle root, the same issue `kiit-codes` hit before `kiit-result` was
  set up flat from the start.

### Renamed
- `kiit-identity` → `kiit-service-id` (repo, Gradle module/artifact, npm package, GitHub repo).
  `Identity`/`IIdentity` → `ServiceId`/`IServiceId`. `Agent` → `Kind` (the `agent` field is now
  `kind`) — "Agent" reads as AI-agent-related today; `Kind` matches Kubernetes' own `kind:` field
  for "what shape of workload is this," and is the word the class doc already used to describe
  it. Kotlin package `kiit.identity` → `kiit.serviceid`; TS discriminant field `Tag.kind` →
  `Tag.variant`, to avoid colliding with `ServiceId`'s own new `kind` field within the same
  package. `IDENTITY_DELIMITER`/`SERVICE_ID_DELIMITER` renamed to match.
- `id` → `privateId`; a new `externalId` (alias for `path`) added alongside it. `id` was
  simultaneously the most operationally detailed field (carries `version`/`env`/`instance`) and
  the blandest, most-reached-for name in the chain. Naming the caution into the API follows the
  same practice as cryptography calling something a "private key," not "key2." Header convention
  documentation renamed from `x-client-id` (collides with OAuth2's `client_id`) to `caller-id`.

### Removed
- `Verb`/`Version`/`Trace`/`Source`/`Content`/`ContentType` moved to `kiit-requests`, which now
  owns the whole call-shape domain (`Request`/`ServerRequest`/`ClientRequest`).
- `About` moved out too, a future `kiit-app` module's concern (whole-application description),
  a different granularity than `ServiceId`'s per-service/component scope. `kiit-identity` (now
  `kiit-service-id`) held just `Identity` and `Agent` for a time. (`Identity` later gained its
  own, much smaller `about: String` field, see Changed, unrelated to the removed `About` type.)
