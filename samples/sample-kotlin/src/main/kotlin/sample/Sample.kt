package sample

// <example id="setup-imports" tags="setup">
import kiit.serviceid.Criticality
import kiit.serviceid.Kind
import kiit.serviceid.Provenance
import kiit.serviceid.ServiceId
import kiit.serviceid.Tag
// </example>

/**
 * Living documentation of kiit-service-id from real Kotlin that compiles and runs. Each example is
 * wrapped in `// <example id="..." tags="...">` ... `// </example>` so the docs site can extract it.
 * The `verify(...)` calls sit outside the markers: they fail the run if an API changes, so the docs
 * can't drift from the library.
 *
 * Run: `./gradlew :samples:sample-kotlin:run`
 */
private var checks = 0

/** Fails the run if a claim an example makes stops being true. Outside the example markers on purpose. */
private fun verify(
    label: String,
    condition: Boolean,
) {
    check(condition) { "FAILED: $label" }
    checks++
    println("  ok: $label")
}

private fun section(title: String) {
    println()
    println("=".repeat(60))
    println(title)
    println("=".repeat(60))
}

// A fixed instance id, so the examples below can show exact strings.
private val caller = ServiceId.of("acme", "accounts.signup", Kind.API, "qat", version = "1.4.2", instance = "4a3b300b")

/** Overview: build an identity and read three forms of it. */
fun overviewExample() {
    section("Overview")

    // <example id="overview-usage" tags="overview">
    val id = ServiceId.api(origin = "acme", scope = "accounts.signup", env = "qat")

    println(id.name) // acme:accounts.signup:api
    println(id.install) // acme:accounts.signup:api:qat:latest
    println(id.externalId) // acme:accounts.signup
    // </example>

    verify("overview-usage: name", id.name == "acme:accounts.signup:api")
    verify("overview-usage: install", id.install == "acme:accounts.signup:api:qat:latest")
    verify("overview-usage: externalId", id.externalId == "acme:accounts.signup")
}

/** Explanation: an identity never changes, and equality is the private id. */
fun explanationExample() {
    section("Explanation")

    // <example id="explanation-immutable" tags="explanation">
    val first = ServiceId.job("acme", "accounts.signup")
    val second = first.newInstance()

    println(first == second) // false: a new instance id gives a new privateId
    println(first.path == second.path) // true: everything above the instance is the same
    // </example>

    verify("explanation-immutable: not equal", first != second)
    verify("explanation-immutable: same path", first.path == second.path)

    // <example id="explanation-parse" tags="explanation">
    val parsed = ServiceId.parse("acme:accounts.signup:api:qat:1.4.2:4a3b300b")

    println(parsed.provenance) // Parsed
    println(parsed.tags) // []
    // </example>

    verify("explanation-parse: provenance", parsed.provenance == Provenance.Parsed)
    verify("explanation-parse: defaults", parsed.tags.isEmpty() && parsed.team == "")
    verify("explanation-parse: equals the original", parsed == caller)
}

/** Tutorial: create, copy, send, parse, and send the external form. */
fun tutorialExample() {
    section("Tutorial")

    // <example id="tutorial-create" tags="tutorial">
    val id = ServiceId.api("acme", "accounts.signup", "qat")

    println("path=${id.path}")
    println("name=${id.name}")
    println("fullName=${id.fullName}")
    println("install=${id.install}")
    println("privateId=${id.privateId}")
    println("externalId=${id.externalId}")
    // </example>

    verify("tutorial-create: fullName", id.fullName == "acme:accounts.signup:api:qat")
    verify("tutorial-create: privateId starts with install", id.privateId.startsWith("${id.install}:"))

    // <example id="tutorial-copy" tags="tutorial">
    val original = ServiceId.job("acme", "accounts.signup")
    val tagged = original.with(inst = null, tags = listOf(Tag.Basic("retry"), Tag.Keyed("batch", "42")))

    println("original tags=${original.tags}") // []
    println("tagged tags=${tagged.tags}")
    // </example>

    verify("tutorial-copy: original unchanged", original.tags.isEmpty())
    verify("tutorial-copy: tagged has both", tagged.tags.size == 2)

    // <example id="tutorial-header" tags="tutorial">
    val headers = mapOf("caller-id" to caller.privateId)

    println(headers["caller-id"]) // acme:accounts.signup:api:qat:1.4.2:4a3b300b
    // </example>

    verify("tutorial-header: value", headers["caller-id"] == "acme:accounts.signup:api:qat:1.4.2:4a3b300b")

    // <example id="tutorial-parse" tags="tutorial">
    val received = ServiceId.parse(headers.getValue("caller-id"))

    println(received.origin) // acme
    println(received.scope) // accounts.signup
    // </example>

    verify("tutorial-parse: origin", received.origin == "acme")
    verify("tutorial-parse: scope", received.scope == "accounts.signup")

    // <example id="tutorial-external" tags="tutorial">
    val outbound = mapOf("caller-id" to caller.externalId)

    println(outbound["caller-id"]) // acme:accounts.signup
    // </example>

    verify("tutorial-external: value", outbound["caller-id"] == "acme:accounts.signup")
}

// <example id="guide-gateway" tags="guide">
/** At the edge: replace the internal id with the external one before a call leaves your infrastructure. */
fun toExternal(headers: Map<String, String>): Map<String, String> {
    val internal = ServiceId.parse(headers.getValue("caller-id"))
    return headers + ("caller-id" to internal.externalId)
}
// </example>

/** Guide: tasks you come back for. */
fun guideExample() {
    section("Guide")

    // <example id="guide-kinds" tags="guide">
    val frontend = ServiceId.of("acme", "storefront", Kind.Web, "pro")
    val edge = ServiceId.of("acme", "edge", Kind.Gateway, "pro")
    val assistant = ServiceId.of("acme", "support.assistant", Kind.Agent, "pro")

    println(frontend.name) // acme:storefront:web
    println(edge.name) // acme:edge:gateway
    println(assistant.name) // acme:support.assistant:agent
    // </example>

    verify("guide-kinds: web", frontend.name == "acme:storefront:web")
    verify("guide-kinds: gateway", edge.name == "acme:edge:gateway")
    verify("guide-kinds: agent", assistant.name == "acme:support.assistant:agent")

    val stripped = toExternal(mapOf("caller-id" to caller.privateId))
    verify("guide-gateway: external only", stripped["caller-id"] == "acme:accounts.signup")

    // <example id="guide-tags" tags="guide">
    val tags = listOf(Tag.Basic("retry"), Tag.parse("region=us-east-1"))
    val tagged = ServiceId.job("acme", "accounts.signup").with(inst = null, tags = tags)

    println(tagged.tags) // [Basic(value=retry), Keyed(key=region, value=us-east-1)]
    // </example>

    verify("guide-tags: basic", tagged.tags[0] == Tag.Basic("retry"))
    verify("guide-tags: keyed", tagged.tags[1] == Tag.Keyed("region", "us-east-1"))

    // <example id="guide-criticality" tags="guide">
    val worker =
        ServiceId.of(
            origin = "acme",
            scope = "accounts.signup",
            kind = Kind.Worker,
            env = "pro",
            version = "1.0.2",
            about = "Sends the welcome email after signup",
            uri = "worker-7.acme.internal",
            criticality = Criticality.High,
            team = "payments-platform",
        )

    println(worker.criticality) // High
    println(worker.team) // payments-platform
    println(worker.provenance) // Declared
    // </example>

    verify("guide-criticality: criticality", worker.criticality == Criticality.High)
    verify("guide-criticality: team", worker.team == "payments-platform")
    verify("guide-criticality: provenance", worker.provenance == Provenance.Declared)

    // <example id="guide-malformed" tags="guide">
    try {
        ServiceId.parse("acme:accounts.signup")
    } catch (e: IllegalArgumentException) {
        println(e.message) // expected 6 segments (origin:scope:kind:env:version:instance), got 2: ...
    }
    // </example>

    val failure = runCatching { ServiceId.parse("acme:accounts.signup") }.exceptionOrNull()
    verify("guide-malformed: throws", failure is IllegalArgumentException)
    verify("guide-malformed: says what", failure?.message?.startsWith("expected 6 segments") == true)
}

/** Not in the docs: `of` normalizes names, and the accessors lowercase. Kept so a change shows up here. */
fun normalizationCheck() {
    section("Normalization (sample only)")

    val id = ServiceId.of("Code Helix", "Accounts Team.Sign Up!", Kind.Worker, "PRO", version = "1.0.2")

    verify("normalize: fullName", id.fullName == "code_helix:accounts_team.sign_up:worker:pro")
}

fun main() {
    overviewExample()
    explanationExample()
    tutorialExample()
    guideExample()
    normalizationCheck()
    println()
    println("All $checks checks passed.")
}
