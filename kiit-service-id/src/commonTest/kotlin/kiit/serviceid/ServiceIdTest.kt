package kiit.serviceid

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class ServiceIdTest {
    @Test
    fun pathNameFullNameInstallPrivateIdFollowTheDocumentedConvention() {
        val id = ServiceId.of("app1", "accounts.signup", Kind.Job, "qat", version = "1.0.2")

        assertEquals("app1:accounts.signup", id.path)
        assertEquals("app1:accounts.signup:job", id.name)
        assertEquals("app1:accounts.signup:job:qat", id.fullName)
        assertEquals("app1:accounts.signup:job:qat:1.0.2", id.install)
        assertTrue(id.privateId.startsWith("app1:accounts.signup:job:qat:1.0.2:"))
    }

    @Test
    fun externalIdIsThePath() {
        val id = ServiceId.of("app1", "accounts.signup", Kind.Job, "qat", version = "1.0.2")

        assertEquals(id.path, id.externalId)
        assertEquals("app1:accounts.signup", id.externalId)
    }

    @Test
    fun everySegmentExceptInstanceIsLowercased() {
        val id =
            ServiceId(
                origin = "App1",
                scope = "Accounts.Signup",
                kind = Kind.API,
                env = "QAT",
                version = "1.0.RC1",
                instance = "Instance-Mixed-Case",
            )

        assertEquals("app1:accounts.signup:api:qat:1.0.rc1:Instance-Mixed-Case", id.privateId)
    }

    @Test
    fun ofNormalizesOriginAndScopeIntoIdentifiers() {
        val id = ServiceId.of("My Company", "Accounts Team.Sign Up!", Kind.API)

        assertEquals("my_company", id.origin)
        assertEquals("accounts_team.sign_up", id.scope)
    }

    @Test
    fun ofNormalizesEnvAndVersionToo() {
        // A colon in env/version would otherwise silently add extra segments to the chain.
        val id = ServiceId.of("acme", "checkout", Kind.API, env = "QAT:staging", version = "1.0:beta")

        assertEquals("qatstaging", id.env)
        assertEquals("1.0beta", id.version)
        assertEquals("acme:checkout:api:qatstaging:1.0beta", id.install)
    }

    @Test
    fun ofRejectsAnInstanceContainingTheDelimiter() {
        assertFailsWith<IllegalArgumentException> {
            ServiceId.of("acme", "checkout", Kind.API, instance = "pod:1")
        }
    }

    @Test
    fun withRejectsAnInstanceContainingTheDelimiter() {
        val id = ServiceId.of("acme", "checkout", Kind.API)

        assertFailsWith<IllegalArgumentException> {
            id.with("pod:1", listOf())
        }
    }

    @Test
    fun defaultsVersionToLatestAndEnvToDev() {
        val id = ServiceId.of("app1", "accounts.signup", Kind.App)

        assertEquals("latest", id.version)
        assertEquals("dev", id.env)
        assertEquals("", id.about)
        assertEquals(emptyList(), id.tags)
        assertEquals(null, id.uri)
        assertEquals(Criticality.Unspecified, id.criticality)
        assertEquals("", id.team)
        assertEquals(Provenance.Declared, id.provenance)
    }

    @Test
    fun ofAcceptsEveryOptionalField() {
        val id =
            ServiceId.of(
                "app1",
                "accounts.signup",
                Kind.Worker,
                about = "Sends the welcome email after signup",
                version = "1.4.2",
                instance = "i-1",
                tags = listOf(Tag.Basic("retry"), Tag.Keyed("region", "us-east-1")),
                uri = "accounts-signup.acme.internal",
                criticality = Criticality.High,
                team = "payments-platform",
            )

        assertEquals("Sends the welcome email after signup", id.about)
        assertEquals("1.4.2", id.version)
        assertEquals("i-1", id.instance)
        assertEquals(listOf(Tag.Basic("retry"), Tag.Keyed("region", "us-east-1")), id.tags)
        assertEquals("accounts-signup.acme.internal", id.uri)
        assertEquals(Criticality.High, id.criticality)
        assertEquals("payments-platform", id.team)
    }

    @Test
    fun declaredIsTheOnlyProvenanceOfIsCanProduce() {
        // `of` has no provenance parameter — every identity it builds is Declared by construction.
        val id = ServiceId.of("app1", "accounts.signup", Kind.App)

        assertEquals(Provenance.Declared, id.provenance)
    }

    @Test
    fun newInstanceAndWithPreserveProvenance() {
        // copy() preserves every field not explicitly overridden, provenance included — this is
        // just how data class copy() behaves, no special handling needed on the Kotlin side
        // (unlike the TS port, which has to thread this through by hand).
        val original = ServiceId.of("c", "s", Kind.App)

        assertEquals(Provenance.Declared, original.newInstance().provenance)
        assertEquals(Provenance.Declared, original.with("i-2", listOf()).provenance)
    }

    @Test
    fun everyServiceIdGetsAUniqueInstance() {
        val first = ServiceId.of("app1", "accounts.signup", Kind.App)
        val second = ServiceId.of("app1", "accounts.signup", Kind.App)

        assertNotEquals(first.instance, second.instance)
    }

    @Test
    fun newInstanceKeepsEverythingElseButChangesTheInstance() {
        val original = ServiceId.of("app1", "accounts.signup", Kind.App)
        val renewed = original.newInstance()

        assertNotEquals(original.instance, renewed.instance)
        assertEquals(original.origin, renewed.origin)
        assertEquals(original.install, renewed.install)
        assertNotEquals(original.privateId, renewed.privateId)
    }

    @Test
    fun withOverridesTheInstanceAndTags() {
        val original = ServiceId.of("app1", "accounts.signup", Kind.App)
        val updated = original.with("fixed-instance", listOf(Tag.Basic("a"), Tag.Basic("b")))

        assertEquals("fixed-instance", updated.instance)
        assertEquals(listOf(Tag.Basic("a"), Tag.Basic("b")), updated.tags)
        assertTrue(updated.privateId.endsWith("fixed-instance"))
    }

    @Test
    fun withGeneratesAnInstanceWhenGivenNull() {
        val original = ServiceId.of("app1", "accounts.signup", Kind.App, instance = "i-1")

        assertNotEquals("i-1", original.with(null, listOf()).instance)
    }

    @Test
    fun convenienceFactoriesUseTheMatchingKind() {
        assertEquals(Kind.App, ServiceId.app("c", "s").kind)
        assertEquals(Kind.API, ServiceId.api("c", "s").kind)
        assertEquals(Kind.CLI, ServiceId.cli("c", "s").kind)
        assertEquals(Kind.Job, ServiceId.job("c", "s").kind)
        assertEquals(Kind.Test, ServiceId.test("c", "signup").kind)
    }

    @Test
    fun testFactoryPutsTheIdentityUnderATestsScope() {
        val id = ServiceId.test("acme", "Login Flow")

        assertEquals("tests.login_flow", id.scope)
        assertEquals("dev", id.env)
    }

    @Test
    fun emptyIsThePlaceholderIdentity() {
        assertEquals(":empty:test:empty:latest", ServiceId.empty.install)
    }

    @Test
    fun toStringIsThePrivateId() {
        val id = ServiceId.of("c", "s", Kind.App, instance = "i-1")

        assertEquals(id.privateId, id.toString())
        assertEquals("c:s:app:dev:latest:i-1", id.toString())
    }

    @Test
    fun isEqualWhenThePrivateIdIsEqualIgnoringSideFields() {
        val base = ServiceId.of("c", "s", Kind.App, instance = "i-1")
        val other =
            ServiceId.of(
                "c",
                "s",
                Kind.App,
                instance = "i-1",
                about = "different",
                uri = "x",
                criticality = Criticality.Critical,
                team = "other-team",
            )

        assertEquals(base, other)
        assertEquals(base.hashCode(), other.hashCode())
        assertEquals(base, base.with("i-1", listOf(Tag.Basic("tagged"))))
    }

    @Test
    fun isNotEqualAcrossInstancesEnvVersionOrKind() {
        val base = ServiceId.of("c", "s", Kind.App, instance = "i-1")

        assertNotEquals(base, base.newInstance())
        assertNotEquals(base, ServiceId.of("c", "s", Kind.App, instance = "i-1", env = "qat"))
        assertNotEquals(base, ServiceId.of("c", "s", Kind.App, instance = "i-1", version = "2"))
        assertNotEquals(base, ServiceId.of("c", "s", Kind.Job, instance = "i-1"))
    }

    // Same cases as ports/kiit-service-id-ts/test/fixtures/to-ident-cases.json. Keep the two in sync
    // by hand, they're what guards the TypeScript port's normalize against drifting from this one.
    @Test
    fun normalizeMatchesTheTypeScriptPortFixture() {
        val cases =
            listOf(
                "My Company" to "my_company",
                "Sign Up!" to "sign_up",
                "  Trim Me  " to "trim_me",
                "a.b.c" to "a.b.c",
                "!!!" to "_",
                "   " to "_",
                "" to "_",
                "Über-Svc_1" to "über-svc_1",
                "café" to "café",
                "日本語 サービス" to "日本語_サービス",
            )
        for ((input, expected) in cases) {
            assertEquals(expected, ServiceId.of(input, "s", Kind.App).origin, "normalize(\"$input\")")
        }
    }

    @Test
    fun parseReconstructsTheChainFieldsFromPrivateId() {
        val original = ServiceId.of("acme", "accounts.signup", Kind.API, env = "qat", version = "1.4.2", instance = "i-1")
        val parsed = ServiceId.parse(original.privateId)

        assertEquals(original.origin, parsed.origin)
        assertEquals(original.scope, parsed.scope)
        assertEquals(original.kind, parsed.kind)
        assertEquals(original.env, parsed.env)
        assertEquals(original.version, parsed.version)
        assertEquals(original.instance, parsed.instance)
        assertEquals(original.privateId, parsed.privateId)
    }

    @Test
    fun parsedIdentityIsParsedProvenanceNotDeclared() {
        val id = ServiceId.parse("acme:accounts.signup:api:qat:1.4.2:i-1")

        assertEquals(Provenance.Parsed, id.provenance)
    }

    @Test
    fun parseDoesNotRecoverSideFields() {
        // about/tags/uri/criticality/team were never part of privateId, so a parsed identity gets
        // their defaults, not the original's actual values.
        val original = ServiceId.of("acme", "s", Kind.API, about = "hello", criticality = Criticality.Critical)
        val parsed = ServiceId.parse(original.privateId)

        assertEquals("", parsed.about)
        assertEquals(Criticality.Unspecified, parsed.criticality)
    }

    @Test
    fun parseRejectsTheWrongSegmentCount() {
        assertFailsWith<IllegalArgumentException> { ServiceId.parse("acme:s:api:qat:1.0") }
        assertFailsWith<IllegalArgumentException> { ServiceId.parse("acme:s:api:qat:1.0:i-1:extra") }
        assertFailsWith<IllegalArgumentException> { ServiceId.parse("") }
    }

    @Test
    fun parseRejectsAnUnrecognizedKind() {
        assertFailsWith<IllegalArgumentException> { ServiceId.parse("acme:s:not-a-kind:qat:1.0:i-1") }
    }

    @Test
    fun parseRejectsABlankSegment() {
        assertFailsWith<IllegalArgumentException> { ServiceId.parse("acme::api:qat:1.0:i-1") }
    }

    @Test
    fun parseLowercasesTheChainFieldsLikeOfDoes() {
        val parsed = ServiceId.parse("Acme:Accounts.Signup:API:QAT:1.4.2-RC1:Pod-7F")
        val built = ServiceId.of("Acme", "Accounts.Signup", Kind.API, "QAT", version = "1.4.2-RC1", instance = "Pod-7F")

        assertEquals(built.origin, parsed.origin)
        assertEquals(built.scope, parsed.scope)
        assertEquals(built.kind, parsed.kind)
        assertEquals(built.env, parsed.env)
        assertEquals(built.version, parsed.version)
        assertEquals(built, parsed)
    }

    @Test
    fun parseLeavesTheInstanceAsGiven() {
        assertEquals("Pod-7F", ServiceId.parse("acme:s:api:qat:1.0:Pod-7F").instance)
    }

    @Test
    fun parseRejectsCharactersOfWouldStrip() {
        assertFailsWith<IllegalArgumentException> { ServiceId.parse("acme:accounts signup:api:qat:1.0:i-1") }
        assertFailsWith<IllegalArgumentException> { ServiceId.parse("acme:accounts.signup!:api:qat:1.0:i-1") }
        assertFailsWith<IllegalArgumentException> { ServiceId.parse("ac\u0000me:s:api:qat:1.0:i-1") }
        assertFailsWith<IllegalArgumentException> { ServiceId.parse("acme:s:api:qat:1.0 beta:i-1") }
    }

    @Test
    fun parseNamesTheSegmentThatWasRejected() {
        val e = assertFailsWith<IllegalArgumentException> { ServiceId.parse("acme:bad scope:api:qat:1.0:i-1") }
        assertTrue(e.message!!.startsWith("scope has characters"))
    }
}
