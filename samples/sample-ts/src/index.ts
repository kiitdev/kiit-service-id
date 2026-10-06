/**
 * Living documentation of @kiitdev/service-id from real TypeScript, type-checked
 * (`npm run typecheck`) against the native port. Mirrors samples/sample-kotlin, with the same
 * example ids. Each example is wrapped in `// <example id="..." tags="...">` ... `// </example>`
 * so the docs site can extract it. The `check(...)` calls sit outside the markers: they fail the
 * run if an API changes, so the docs can't drift from the library.
 */
// <example id="setup-imports" tags="setup">
import { Criticality, Kind, Provenance, ServiceId, Tag } from "@kiitdev/service-id";
// </example>

let checks = 0;

/** Fails the run if a claim an example makes stops being true. Outside the example markers on purpose. */
function check(label: string, condition: boolean): void {
  if (!condition) {
    throw new Error(`FAILED: ${label}`);
  }
  checks++;
  console.log(`  ok: ${label}`);
}

function section(title: string): void {
  console.log(`\n${"=".repeat(60)}\n${title}\n${"=".repeat(60)}`);
}

// A fixed instance id, so the examples below can show exact strings.
const caller = ServiceId.of({
  origin: "acme",
  scope: "accounts.signup",
  kind: Kind.API,
  env: "qat",
  version: "1.4.2",
  instance: "4a3b300b",
});

/** Overview: build an identity and read three forms of it. */
function overviewExample(): void {
  section("Overview");

  // <example id="overview-usage" tags="overview">
  const id = ServiceId.api("acme", "accounts.signup", "qat");

  console.log(id.name); // acme:accounts.signup:api
  console.log(id.install); // acme:accounts.signup:api:qat:latest
  console.log(id.externalId); // acme:accounts.signup
  // </example>

  check("overview-usage: name", id.name === "acme:accounts.signup:api");
  check("overview-usage: install", id.install === "acme:accounts.signup:api:qat:latest");
  check("overview-usage: externalId", id.externalId === "acme:accounts.signup");
}

/** Explanation: an identity never changes, and equality is the private id. */
function explanationExample(): void {
  section("Explanation");

  // <example id="explanation-immutable" tags="explanation">
  const first = ServiceId.job("acme", "accounts.signup");
  const second = first.newInstance();

  console.log(first.equals(second)); // false: a new instance id gives a new privateId
  console.log(first.path === second.path); // true: everything above the instance is the same
  // </example>

  check("explanation-immutable: not equal", !first.equals(second));
  check("explanation-immutable: same path", first.path === second.path);

  // <example id="explanation-parse" tags="explanation">
  const parsed = ServiceId.parse("acme:accounts.signup:api:qat:1.4.2:4a3b300b");

  console.log(parsed.provenance); // Parsed
  console.log(parsed.tags); // []
  // </example>

  check("explanation-parse: provenance", parsed.provenance === Provenance.Parsed);
  check("explanation-parse: defaults", parsed.tags.length === 0 && parsed.team === "");
  check("explanation-parse: equals the original", parsed.equals(caller));

  // <example id="explanation-security" tags="explanation">
  const id = ServiceId.of({
    origin: "acme",
    scope: "accounts.signup",
    kind: Kind.API,
    env: "qat",
    version: "1.4.2",
    instance: "4a3b300b",
  });

  console.log(id.privateId); // acme:accounts.signup:api:qat:1.4.2:4a3b300b, for internal calls only
  console.log(id.externalId); // acme:accounts.signup, safe to send outside
  // </example>

  check("explanation-security: privateId", id.privateId === "acme:accounts.signup:api:qat:1.4.2:4a3b300b");
  check("explanation-security: externalId", id.externalId === "acme:accounts.signup");
}

/** Tutorial: create, copy, send, parse, and send the external form. */
function tutorialExample(): void {
  section("Tutorial");

  // <example id="tutorial-create" tags="tutorial">
  const id = ServiceId.api("acme", "accounts.signup", "qat");

  console.log(`path=${id.path}`);
  console.log(`name=${id.name}`);
  console.log(`fullName=${id.fullName}`);
  console.log(`install=${id.install}`);
  console.log(`privateId=${id.privateId}`);
  console.log(`externalId=${id.externalId}`);
  // </example>

  check("tutorial-create: fullName", id.fullName === "acme:accounts.signup:api:qat");
  check("tutorial-create: privateId starts with install", id.privateId.startsWith(`${id.install}:`));

  // <example id="tutorial-copy" tags="tutorial">
  const original = ServiceId.job("acme", "accounts.signup");
  const tagged = original.with(null, [Tag.Basic("retry"), Tag.Keyed("batch", "42")]);

  console.log(`original tags=[${original.tags.map((t) => t.raw).join(", ")}]`); // []
  console.log(`tagged tags=[${tagged.tags.map((t) => t.raw).join(", ")}]`);
  // </example>

  check("tutorial-copy: original unchanged", original.tags.length === 0);
  check("tutorial-copy: tagged has both", tagged.tags.length === 2);

  // <example id="tutorial-header" tags="tutorial">
  const headers: Record<string, string> = { "caller-id": caller.privateId };

  console.log(headers["caller-id"]); // acme:accounts.signup:api:qat:1.4.2:4a3b300b
  // </example>

  check("tutorial-header: value", headers["caller-id"] === "acme:accounts.signup:api:qat:1.4.2:4a3b300b");

  // <example id="tutorial-parse" tags="tutorial">
  const received = ServiceId.parse(headers["caller-id"]);

  console.log(received.origin); // acme
  console.log(received.scope); // accounts.signup
  // </example>

  check("tutorial-parse: origin", received.origin === "acme");
  check("tutorial-parse: scope", received.scope === "accounts.signup");

  // <example id="tutorial-external" tags="tutorial">
  const outbound: Record<string, string> = { "caller-id": caller.externalId };

  console.log(outbound["caller-id"]); // acme:accounts.signup
  // </example>

  check("tutorial-external: value", outbound["caller-id"] === "acme:accounts.signup");
}

// <example id="guide-gateway" tags="guide">
/** At the edge: replace the internal id with the external one before a call leaves your infrastructure. */
function toExternal(headers: Record<string, string>): Record<string, string> {
  const internal = ServiceId.parse(headers["caller-id"]);
  return { ...headers, "caller-id": internal.externalId };
}
// </example>

/** Guide: tasks you come back for. */
function guideExample(): void {
  section("Guide");

  // <example id="guide-kinds" tags="guide">
  const frontend = ServiceId.of({ origin: "acme", scope: "storefront", kind: Kind.Web, env: "pro" });
  const edge = ServiceId.of({ origin: "acme", scope: "edge", kind: Kind.Gateway, env: "pro" });
  const assistant = ServiceId.of({ origin: "acme", scope: "support.assistant", kind: Kind.Agent, env: "pro" });

  console.log(frontend.name); // acme:storefront:web
  console.log(edge.name); // acme:edge:gateway
  console.log(assistant.name); // acme:support.assistant:agent
  // </example>

  check("guide-kinds: web", frontend.name === "acme:storefront:web");
  check("guide-kinds: gateway", edge.name === "acme:edge:gateway");
  check("guide-kinds: agent", assistant.name === "acme:support.assistant:agent");

  const stripped = toExternal({ "caller-id": caller.privateId });
  check("guide-gateway: external only", stripped["caller-id"] === "acme:accounts.signup");

  // <example id="guide-tags" tags="guide">
  const tags = [Tag.Basic("retry"), Tag.parse("region=us-east-1")];
  const tagged = ServiceId.job("acme", "accounts.signup").with(null, tags);

  console.log(tagged.tags.map((t) => t.raw)); // [ 'retry', 'region=us-east-1' ]
  // </example>

  check("guide-tags: basic", tagged.tags[0].variant === "Basic" && tagged.tags[0].raw === "retry");
  check("guide-tags: keyed", tagged.tags[1].variant === "Keyed" && tagged.tags[1].raw === "region=us-east-1");

  // <example id="guide-criticality" tags="guide">
  const worker = ServiceId.of({
    origin: "acme",
    scope: "accounts.signup",
    kind: Kind.Worker,
    env: "pro",
    version: "1.0.2",
    about: "Sends the welcome email after signup",
    uri: "worker-7.acme.internal",
    criticality: Criticality.High,
    team: "payments-platform",
  });

  console.log(worker.criticality); // High
  console.log(worker.team); // payments-platform
  console.log(worker.provenance); // Declared
  // </example>

  check("guide-criticality: criticality", worker.criticality === Criticality.High);
  check("guide-criticality: team", worker.team === "payments-platform");
  check("guide-criticality: provenance", worker.provenance === Provenance.Declared);

  // <example id="guide-malformed" tags="guide">
  try {
    ServiceId.parse("acme:accounts.signup");
  } catch (e) {
    console.log((e as Error).message); // expected 6 segments (origin:scope:kind:env:version:instance), got 2: ...
  }
  // </example>

  let failure: Error | undefined;
  try {
    ServiceId.parse("acme:accounts.signup");
  } catch (e) {
    failure = e as Error;
  }
  check("guide-malformed: throws", failure !== undefined);
  check("guide-malformed: says what", failure?.message.startsWith("expected 6 segments") === true);
}

/** Not in the docs: `of` normalizes names, and the accessors lowercase. Kept so a change shows up here. */
function normalizationCheck(): void {
  section("Normalization (sample only)");

  const id = ServiceId.of({
    origin: "Code Helix",
    scope: "Accounts Team.Sign Up!",
    kind: Kind.Worker,
    env: "PRO",
    version: "1.0.2",
  });

  check("normalize: fullName", id.fullName === "code_helix:accounts_team.sign_up:worker:pro");
}

overviewExample();
explanationExample();
tutorialExample();
guideExample();
normalizationCheck();
console.log(`\nAll ${checks} checks passed.`);
