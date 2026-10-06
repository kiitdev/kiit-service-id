import { describe, expect, it } from "vitest";
import { Criticality, Kind, Provenance, ServiceId, Tag } from "../src/index.js";
import toIdentCases from "./fixtures/to-ident-cases.json" with { type: "json" };

// Ported from ServiceIdTest.kt. Kotlin's named/default arguments become an options object.

describe("ServiceId naming", () => {
  it("path, name, fullName, install and privateId follow the documented convention", () => {
    const id = ServiceId.of({ origin: "app1", scope: "accounts.signup", kind: Kind.Job, env: "qat", version: "1.0.2" });

    expect(id.path).toBe("app1:accounts.signup");
    expect(id.name).toBe("app1:accounts.signup:job");
    expect(id.fullName).toBe("app1:accounts.signup:job:qat");
    expect(id.install).toBe("app1:accounts.signup:job:qat:1.0.2");
    expect(id.privateId.startsWith("app1:accounts.signup:job:qat:1.0.2:")).toBe(true);
  });

  it("externalId is the path", () => {
    const id = ServiceId.of({ origin: "app1", scope: "accounts.signup", kind: Kind.Job, env: "qat", version: "1.0.2" });

    expect(id.externalId).toBe(id.path);
    expect(id.externalId).toBe("app1:accounts.signup");
  });

  // origin/scope/env are already normalized by `of`, so there's no public way to construct a
  // ServiceId with those un-lowercased (the constructor is private). What's left to prove the
  // accessors lowercase regardless: Kind's own casing ("API", not "api") and version, which `of`
  // normalizes but doesn't otherwise alter the case of digits/letters it already had.
  it("lowercases kind and version in the derived accessors", () => {
    const id = ServiceId.of({ origin: "app1", scope: "s", kind: Kind.API, version: "1.0.RC1" });

    expect(id.name).toBe("app1:s:api");
    expect(id.install).toBe("app1:s:api:dev:1.0.rc1");
  });
});

describe("ServiceId.of", () => {
  it("normalizes origin and scope into identifiers", () => {
    const id = ServiceId.of({ origin: "My Company", scope: "Accounts Team.Sign Up!", kind: Kind.API });

    expect(id.origin).toBe("my_company");
    expect(id.scope).toBe("accounts_team.sign_up");
  });

  it("normalizes env and version too", () => {
    // A colon in env/version would otherwise silently add extra segments to the chain.
    const id = ServiceId.of({ origin: "acme", scope: "checkout", kind: Kind.API, env: "QAT:staging", version: "1.0:beta" });

    expect(id.env).toBe("qatstaging");
    expect(id.version).toBe("1.0beta");
    expect(id.install).toBe("acme:checkout:api:qatstaging:1.0beta");
  });

  it("rejects an instance containing the delimiter", () => {
    expect(() => ServiceId.of({ origin: "acme", scope: "checkout", kind: Kind.API, instance: "pod:1" })).toThrow();
  });

  it("defaults version to latest and env to dev", () => {
    const id = ServiceId.of({ origin: "app1", scope: "accounts.signup", kind: Kind.App });

    expect(id.version).toBe("latest");
    expect(id.env).toBe("dev");
    expect(id.about).toBe("");
    expect(id.tags).toEqual([]);
    expect(id.uri).toBeNull();
    expect(id.criticality).toBe(Criticality.Unspecified);
    expect(id.team).toBe("");
    expect(id.provenance).toBe(Provenance.Declared);
  });

  it("treats null optional fields like missing ones", () => {
    const id = ServiceId.of({
      origin: "c", scope: "s", kind: Kind.App, version: null, about: null, instance: null, uri: null,
      criticality: null, team: null,
    });

    expect(id.version).toBe("latest");
    expect(id.about).toBe("");
    expect(id.uri).toBeNull();
    expect(id.instance).not.toBe("");
    expect(id.criticality).toBe(Criticality.Unspecified);
    expect(id.team).toBe("");
  });

  it("keeps every explicit optional field", () => {
    const id = ServiceId.of({
      origin: "c", scope: "s", kind: Kind.Worker, instance: "i-1", version: "2.0", about: "hello",
      tags: [Tag.Basic("retry"), Tag.Keyed("region", "us-east-1")], uri: "svc-7.internal",
      criticality: Criticality.High, team: "payments-platform",
    });

    expect(id.tags).toEqual([Tag.Basic("retry"), Tag.Keyed("region", "us-east-1")]);
    expect(id.instance).toBe("i-1");
    expect(id.version).toBe("2.0");
    expect(id.about).toBe("hello");
    expect(id.uri).toBe("svc-7.internal");
    expect(id.criticality).toBe(Criticality.High);
    expect(id.team).toBe("payments-platform");
  });

  it("declared is the only provenance of can produce", () => {
    const id = ServiceId.of({ origin: "app1", scope: "accounts.signup", kind: Kind.App });

    expect(id.provenance).toBe(Provenance.Declared);
  });

  it("gives every identity a unique instance", () => {
    const first = ServiceId.of({ origin: "app1", scope: "accounts.signup", kind: Kind.App });
    const second = ServiceId.of({ origin: "app1", scope: "accounts.signup", kind: Kind.App });

    expect(first.instance).not.toBe(second.instance);
  });
});

describe("normalize (through ServiceId.of)", () => {
  it.each(toIdentCases)("normalizes $input", ({ input, expected }) => {
    expect(ServiceId.of({ origin: input, scope: "s", kind: Kind.App }).origin).toBe(expected);
  });
});

describe("ServiceId copies", () => {
  it("with rejects an instance containing the delimiter", () => {
    const id = ServiceId.of({ origin: "acme", scope: "checkout", kind: Kind.API });

    expect(() => id.with("pod:1", [])).toThrow();
  });

  it("newInstance keeps everything else but changes the instance", () => {
    const original = ServiceId.of({ origin: "app1", scope: "accounts.signup", kind: Kind.App });
    const renewed = original.newInstance();

    expect(renewed.instance).not.toBe(original.instance);
    expect(renewed.origin).toBe(original.origin);
    expect(renewed.install).toBe(original.install);
    expect(renewed.privateId).not.toBe(original.privateId);
  });

  it("with overrides the instance and tags", () => {
    const original = ServiceId.of({ origin: "app1", scope: "accounts.signup", kind: Kind.App });
    const updated = original.with("fixed-instance", [Tag.Basic("a"), Tag.Basic("b")]);

    expect(updated.instance).toBe("fixed-instance");
    expect(updated.tags).toEqual([Tag.Basic("a"), Tag.Basic("b")]);
    expect(updated.privateId.endsWith("fixed-instance")).toBe(true);
  });

  it("with generates an instance when given null", () => {
    const original = ServiceId.of({ origin: "c", scope: "s", kind: Kind.App, instance: "i-1" });

    expect(original.with(null, []).instance).not.toBe("i-1");
  });

  it("does not mutate the original", () => {
    const original = ServiceId.of({ origin: "c", scope: "s", kind: Kind.App, instance: "i-1" });
    original.with("i-2", [Tag.Basic("x")]);
    original.newInstance();

    expect(original.instance).toBe("i-1");
    expect(original.tags).toEqual([]);
  });

  it("copies the tags array, so later changes to the input don't leak in", () => {
    const tags = [Tag.Basic("a")];
    const id = ServiceId.of({ origin: "c", scope: "s", kind: Kind.App }).with("i", tags);
    tags.push(Tag.Basic("b"));

    expect(id.tags).toEqual([Tag.Basic("a")]);
    expect(Object.isFrozen(id.tags)).toBe(true);
  });

  it("newInstance and with preserve provenance, matching Kotlin's copy() semantics", () => {
    const original = ServiceId.of({ origin: "c", scope: "s", kind: Kind.App });

    expect(original.newInstance().provenance).toBe(Provenance.Declared);
    expect(original.with("i-2", []).provenance).toBe(Provenance.Declared);
  });
});

describe("ServiceId factories", () => {
  it("use the matching kind", () => {
    expect(ServiceId.app("c", "s").kind).toBe(Kind.App);
    expect(ServiceId.api("c", "s").kind).toBe(Kind.API);
    expect(ServiceId.cli("c", "s").kind).toBe(Kind.CLI);
    expect(ServiceId.job("c", "s").kind).toBe(Kind.Job);
    expect(ServiceId.test("c", "signup").kind).toBe(Kind.Test);
  });

  it("default env to dev and accept an override", () => {
    expect(ServiceId.api("c", "s").env).toBe("dev");
    expect(ServiceId.api("c", "s", "PRO").env).toBe("pro");
  });

  it("test puts the identity under a tests scope, on dev", () => {
    const id = ServiceId.test("acme", "Login Flow");

    expect(id.scope).toBe("tests.login_flow");
    expect(id.env).toBe("dev");
  });

  it("empty is the placeholder identity", () => {
    expect(ServiceId.empty.install).toBe(":empty:test:empty:latest");
  });
});

describe("ServiceId equality and string form", () => {
  const base = () => ServiceId.of({ origin: "c", scope: "s", kind: Kind.App, instance: "i-1" });

  it("toString is the privateId", () => {
    expect(String(base())).toBe(base().privateId);
    expect(`${base()}`).toBe("c:s:app:dev:latest:i-1");
  });

  it("is equal when the privateId is equal, ignoring tags/about/uri/criticality/team", () => {
    const other = ServiceId.of({
      origin: "c", scope: "s", kind: Kind.App, instance: "i-1",
      about: "different", uri: "x", criticality: Criticality.Critical, team: "other-team",
    });

    expect(base().equals(other)).toBe(true);
    expect(base().equals(base().with("i-1", [Tag.Basic("tagged")]))).toBe(true);
  });

  it("is not equal across instances, env, version or kind", () => {
    expect(base().equals(base().newInstance())).toBe(false);
    expect(base().equals(ServiceId.of({ origin: "c", scope: "s", kind: Kind.App, instance: "i-1", env: "qat" }))).toBe(false);
    expect(base().equals(ServiceId.of({ origin: "c", scope: "s", kind: Kind.App, instance: "i-1", version: "2" }))).toBe(false);
    expect(base().equals(ServiceId.of({ origin: "c", scope: "s", kind: Kind.Job, instance: "i-1" }))).toBe(false);
  });
});

describe("ServiceId.parse", () => {
  it("reconstructs the chain fields from privateId", () => {
    const original = ServiceId.of({ origin: "acme", scope: "accounts.signup", kind: Kind.API, env: "qat", version: "1.4.2", instance: "i-1" });
    const parsed = ServiceId.parse(original.privateId);

    expect(parsed.origin).toBe(original.origin);
    expect(parsed.scope).toBe(original.scope);
    expect(parsed.kind).toBe(original.kind);
    expect(parsed.env).toBe(original.env);
    expect(parsed.version).toBe(original.version);
    expect(parsed.instance).toBe(original.instance);
    expect(parsed.privateId).toBe(original.privateId);
  });

  it("marks a parsed identity as Parsed, not Declared", () => {
    expect(ServiceId.parse("acme:accounts.signup:api:qat:1.4.2:i-1").provenance).toBe(Provenance.Parsed);
  });

  it("does not recover side fields", () => {
    // about/tags/uri/criticality/team were never part of privateId, so a parsed identity gets
    // their defaults, not the original's actual values.
    const original = ServiceId.of({ origin: "acme", scope: "s", kind: Kind.API, about: "hello", criticality: Criticality.Critical });
    const parsed = ServiceId.parse(original.privateId);

    expect(parsed.about).toBe("");
    expect(parsed.criticality).toBe(Criticality.Unspecified);
  });

  it("rejects the wrong segment count", () => {
    expect(() => ServiceId.parse("acme:s:api:qat:1.0")).toThrow();
    expect(() => ServiceId.parse("acme:s:api:qat:1.0:i-1:extra")).toThrow();
    expect(() => ServiceId.parse("")).toThrow();
  });

  it("rejects an unrecognized kind", () => {
    expect(() => ServiceId.parse("acme:s:not-a-kind:qat:1.0:i-1")).toThrow();
  });

  it("rejects a blank segment", () => {
    expect(() => ServiceId.parse("acme::api:qat:1.0:i-1")).toThrow();
  });

  it("lowercases the chain fields like of does", () => {
    const parsed = ServiceId.parse("Acme:Accounts.Signup:API:QAT:1.4.2-RC1:Pod-7F");
    const built = ServiceId.of({
      origin: "Acme",
      scope: "Accounts.Signup",
      kind: Kind.API,
      env: "QAT",
      version: "1.4.2-RC1",
      instance: "Pod-7F",
    });

    expect(parsed.origin).toBe(built.origin);
    expect(parsed.scope).toBe(built.scope);
    expect(parsed.kind).toBe(built.kind);
    expect(parsed.env).toBe(built.env);
    expect(parsed.version).toBe(built.version);
    expect(parsed.equals(built)).toBe(true);
  });

  it("leaves the instance as given", () => {
    expect(ServiceId.parse("acme:s:api:qat:1.0:Pod-7F").instance).toBe("Pod-7F");
  });

  it("rejects characters of would strip", () => {
    expect(() => ServiceId.parse("acme:accounts signup:api:qat:1.0:i-1")).toThrow();
    expect(() => ServiceId.parse("acme:accounts.signup!:api:qat:1.0:i-1")).toThrow();
    expect(() => ServiceId.parse("ac\u0000me:s:api:qat:1.0:i-1")).toThrow();
    expect(() => ServiceId.parse("acme:s:api:qat:1.0 beta:i-1")).toThrow();
  });

  it("names the segment that was rejected", () => {
    expect(() => ServiceId.parse("acme:bad scope:api:qat:1.0:i-1")).toThrow(/^scope has characters/);
  });
});
