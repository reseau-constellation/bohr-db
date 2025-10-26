import { type HeliaLibp2p } from "helia";
import { rimraf } from "rimraf";

import { createTestHelia } from "./config.js";
import { Identities, KeyStore } from "@orbitdb/core";
import type { Identity, KeyStoreType } from "@orbitdb/core";

import { chai, chaiAsPromised, expect } from "aegir/chai";
import { JSONSchemaType } from "ajv";
import { Nested, NestedDatabaseType } from "@orbitdb/nested-db";
import { TypedNested, typedNested } from "@/nested.js";
import { RecursivePartial } from "@/types.js";
import { expectNestedMapEqual } from "./utils.js";
chai.use(chaiAsPromised);

const keysPath = "./testkeys-nested";

describe("Typed Nested", () => {
  let ipfs: HeliaLibp2p;
  let identities;
  let keystore: KeyStoreType;
  let testIdentity1: Identity;
  let db: NestedDatabaseType;

  const databaseId = "nested-AAA";

  before(async () => {
    ipfs = await createTestHelia();

    keystore = await KeyStore({ path: keysPath });
    identities = await Identities({ keystore });
    testIdentity1 = await identities.createIdentity({ id: "userA" });
  });

  after(async () => {
    if (ipfs) {
      await ipfs.stop();
    }

    await rimraf(keysPath);
    await rimraf("./orbitdb");
  });

  describe("Creating a Typed Nested database", () => {
    type structure = { a: number; b: { c: string } };
    const schema: JSONSchemaType<RecursivePartial<structure>> = {
      type: "object",
      properties: {
        a: { type: "number", nullable: true },
        b: {
          type: "object",
          properties: {
            c: { type: "string", nullable: true },
          },
          required: [],
          nullable: true,
        },
      },
      required: [],
    };
    let typedDB: TypedNested<structure>;

    beforeEach(async () => {
      db = await Nested()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
      typedDB = typedNested({
        db,
        schema,
      });
    });

    afterEach(async () => {
      if (typedDB) {
        await typedDB.drop();
        await typedDB.close();
      }
    });

    it("wraps a nested store", async () => {
      expect(typedDB.type).to.equal("nested");
    });

    it("returns 0 items when it's a fresh database", async () => {
      const all = await typedDB.all();

      expect(all).to.be.an.empty("object");
    });
  });

  describe("Typed Nested database - fixed properties", () => {
    type structure = { a: number; b: { c: string } };
    const schema: JSONSchemaType<RecursivePartial<structure>> = {
      type: "object",
      properties: {
        a: { type: "number", nullable: true },
        b: {
          type: "object",
          properties: {
            c: { type: "string", nullable: true },
          },
          required: [],
          nullable: true,
          additionalProperties: false,
        },
      },
      additionalProperties: false,
      required: [],
    };
    let typedDB: TypedNested<structure>;

    beforeEach(async () => {
      db = await Nested()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
      typedDB = typedNested({
        db,
        schema,
      });
    });

    afterEach(async () => {
      if (typedDB) {
        await typedDB.drop();
        await typedDB.close();
      }
    });

    it("put valid key/value", async () => {
      await typedDB.put("a", 1);

      const actual = await typedDB.all();

      expectNestedMapEqual(actual, { a: 1 });
    });

    it("get valid key/value", async () => {
      await typedDB.put("a", 1);

      const actual = await typedDB.get("a");
      expect(actual).to.equal(1);
    });

    it("delete key", async () => {
      await typedDB.put("a", 1);
      await typedDB.del("a");

      const actual = await typedDB.get("a");
      expect(actual).to.be.undefined();
    });

    it("error on put invalid key", async () => {
      // @ts-expect-error Deliberately adding invalid key
      await expect(typedDB.put("c", 3)).to.be.rejectedWith(
        "Unsupported key c.",
      );
    });

    it("error on put invalid value", async () => {
      await expect(
        // @ts-expect-error Deliberately adding invalid value
        typedDB.put("a", "text"),
      ).to.be.rejectedWith("must be number");
    });

    it("error on get invalid key", async () => {
      await expect(
        // @ts-expect-error Deliberately getting invalid key
        typedDB.get("d"),
      ).to.be.rejectedWith("Unsupported key d.");
    });

    it("undefined on get invalid value", async () => {
      // Force write invalid key to underlying orbit-db database
      await db.put("a", "wrong type");

      const val = await typedDB.get("a");
      expect(val).to.be.undefined();
    });

    it("error on delete invalid key", async () => {
      // @ts-expect-error Deliberately deleting invalid key
      await expect(typedDB.del("c")).to.be.rejectedWith("Unsupported key c.");
    });

    it("put valid nested key/value", async () => {
      await typedDB.put("a", 1);
      await typedDB.put("b/c", "test");

      const actual = await typedDB.all();

      expectNestedMapEqual(actual, { a: 1, b: { c: "test" } });
    });

    it("get valid nested key/value", async () => {
      await typedDB.put("b/c", "test");

      const actual = await typedDB.get("b");

      expectNestedMapEqual(actual!, { c: "test" });
    });

    it("delete nested key", async () => {
      await typedDB.put("b/c", "test");
      await typedDB.del("b/c");

      const actual = await typedDB.get("b/c");
      expect(actual).to.be.undefined();
    });

    it("error on put invalid nested key", async () => {
      // @ts-expect-error Deliberately adding invalid key
      await expect(typedDB.put("b/d", 3)).to.be.rejectedWith(
        "Unsupported key b/d.",
      );
    });

    it("error on put invalid value in nested key", async () => {
      await expect(
        // @ts-expect-error Deliberately adding invalid value
        typedDB.put("b/c", 1),
      ).to.be.rejectedWith("must be string");
    });

    it("error on get invalid nested key", async () => {
      await expect(
        // @ts-expect-error Deliberately getting invalid key
        typedDB.get("b/c/d"),
      ).to.be.rejectedWith("Unsupported key b/c/d.");
    });

    it("error on delete invalid nested key", async () => {
      // @ts-expect-error Deliberately deleting invalid key
      await expect(typedDB.del("a/b")).to.be.rejectedWith(
        "Unsupported key a/b.",
      );
    });

    it("put nested valid", async () => {
      await typedDB.put({ b: { c: "test" } });

      const actual = await typedDB.all();

      expectNestedMapEqual(actual, { b: { c: "test" } });
    });

    it("error on put nested invalid key", async () => {
      // @ts-expect-error Deliberately adding invalid key
      await expect(typedDB.put({ b: { d: 3 } })).to.be.rejectedWith(
        "Unsupported key b/d.",
      );
    });

    it("error on put nested invalid value", async () => {
      await expect(
        // @ts-expect-error Deliberately adding invalid value
        typedDB.put({ b: { c: 1 } }),
      ).to.be.rejectedWith("must be string");
    });

    it("put nested valid with key", async () => {
      await typedDB.put("b", { c: "test" });

      const actual = await typedDB.all();

      expectNestedMapEqual(actual, { b: { c: "test" } });
    });

    it("put valid nested key/value - list key", async () => {
      await typedDB.put(["b", "c"], "test");

      const actual = await typedDB.all();

      expectNestedMapEqual(actual, { b: { c: "test" } });
    });

    it("get valid nested key/value - list key", async () => {
      await typedDB.put(["b", "c"], "test");

      const actual = await typedDB.get(["b", "c"]);
      expect(actual).to.deep.equal("test");
    });

    it("delete nested list key", async () => {
      await typedDB.put(["b", "c"], "test");
      await typedDB.del(["b", "c"]);

      const actual = await typedDB.get(["b", "c"]);
      expect(actual).to.be.undefined();
    });

    it("error on delete invalid nested list key", async () => {
      // @ts-expect-error Deliberately deleting invalid key
      await expect(typedDB.del(["a", "b"])).to.be.rejectedWith(
        "Unsupported key a/b.",
      );
    });

    it("error on put nested with invalid key", async () => {
      // @ts-expect-error Deliberately adding invalid value
      await expect(typedDB.put("b/d", 2)).to.be.rejectedWith(
        "Unsupported key b/d.",
      );
    });

    it("error on put invalid nested key - list key", async () => {
      // @ts-expect-error Deliberately adding invalid key
      await expect(typedDB.put(["b", "d"], 3)).to.be.rejectedWith(
        "Unsupported key b/d.",
      );
    });

    it("error on put nested with key and invalid value", async () => {
      // @ts-expect-error Deliberately adding invalid value
      await expect(typedDB.put("b", { c: 1 })).to.be.rejectedWith(
        "must be string",
      );
    });

    it("error on put invalid value in nested key - list key", async () => {
      await expect(
        // @ts-expect-error Deliberately adding invalid value
        typedDB.put(["b", "c"], 1),
      ).to.be.rejectedWith("must be string");
    });

    it("error on get invalid nested key - list key", async () => {
      await expect(
        // @ts-expect-error Deliberately getting invalid key
        typedDB.get(["b", "c", "d"]),
      ).to.be.rejectedWith("Unsupported key b/c/d.");
    });

    it("invalid keys in log lead to error on `db.all()`", async () => {
      // Force write invalid key to underlying orbit-db database
      await db.put("d", 4);

      await typedDB.put("a", 1);
      await typedDB.set("b/c", "text");

      await expect(typedDB.all()).to.be.rejectedWith(
        "must NOT have additional properties",
      );
    });

    it("invalid values in log lead to error on `db.all()`", async () => {
      // Force write invalid value to underlying orbit-db database
      await db.put("a", "text");

      await typedDB.set("b/c", "text 2");

      await expect(typedDB.all()).to.be.rejectedWith("must be number");
    });
  });

  describe("Typed Nested database - additional properties", () => {
    type structure = { a: string; b: { [key: string]: number } };
    const schema: JSONSchemaType<RecursivePartial<structure>> = {
      type: "object",
      properties: {
        a: { type: "string", nullable: true },
        b: {
          type: "object",
          additionalProperties: {
            type: "number",
          },
          required: [],
          nullable: true,
        },
      },
      required: [],
    };
    let typedDB: TypedNested<structure>;

    beforeEach(async () => {
      db = await Nested()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
      typedDB = typedNested({
        db,
        schema,
      });
    });

    afterEach(async () => {
      if (typedDB) {
        await typedDB.drop();
        await typedDB.close();
      }
    });

    it("add additional property key", async () => {
      const hash = (await typedDB.put("b/d", 1))[0];
      expect(hash).to.be.a("string");
    });

    it("get additional property key/value", async () => {
      await typedDB.put("b/d", 1);

      const actual = await typedDB.all();

      expectNestedMapEqual(actual, { b: { d: 1 } });
    });

    it("error on add invalid additional property value", async () => {
      await expect(
        // @ts-expect-error Deliberately adding invalid value
        typedDB.put("b/d", "text"),
      ).to.be.rejectedWith("must be number");
    });

    it("add additional property key - list", async () => {
      const hash = (await typedDB.put(["b", "d"], 1))[0];
      expect(hash).to.be.a("string");
    });

    it("get additional property key/value - list", async () => {
      await typedDB.put(["b", "d"], 1);

      const actual = await typedDB.all();

      expectNestedMapEqual(actual, { b: { d: 1 } });
    });

    it("error on add invalid additional property value - list", async () => {
      await expect(
        // @ts-expect-error Deliberately adding invalid value
        typedDB.put(["b", "d"], "text"),
      ).to.be.rejectedWith("must be number");
    });

    it("invalid values in log lead to error on `db.all()`", async () => {
      // Force write invalid value to underlying orbit-db database
      await db.put(["b", "d"], "text");

      await typedDB.set("a", "text 2");

      await expect(typedDB.all()).to.be.rejectedWith("must be number");
    });
  });

  describe("Typed Nested database - additional structured properties", () => {
    type structure = { a: string; b: { [key: string]: { c: number } } };
    const schema: JSONSchemaType<RecursivePartial<structure>> = {
      type: "object",
      properties: {
        a: { type: "string", nullable: true },
        b: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              c: { type: "number", nullable: true },
            },
          },
          required: [],
          nullable: true,
        },
      },
      required: [],
    };
    let typedDB: TypedNested<structure>;

    beforeEach(async () => {
      db = await Nested()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
      typedDB = typedNested({
        db,
        schema,
      });
    });

    afterEach(async () => {
      if (typedDB) {
        await typedDB.drop();
        await typedDB.close();
      }
    });

    it("add additional property key", async () => {
      const hash = (await typedDB.put("b/d", { c: 1 }))[0];
      expect(hash).to.be.a("string");
    });

    it("get additional property key/value", async () => {
      await typedDB.put("b/d", { c: 1 });

      const actual = await typedDB.all();

      expectNestedMapEqual(actual, { b: { d: { c: 1 } } });
    });

    it("add additional property nested key/raw value", async () => {
      const hash = (await typedDB.put("b/d/c", 1))[0];
      expect(hash).to.be.a("string");
    });

    it("get additional property nested key/raw value", async () => {
      await typedDB.put("b/d", { c: 1 });

      const actual = await typedDB.get("b/d/c");

      expect(actual).to.equal(1);
    });

    it("error on add invalid additional property value", async () => {
      await expect(
        // @ts-expect-error Deliberately adding invalid value
        typedDB.put("b/d", "text"),
      ).to.be.rejectedWith("must be object");
    });

    it("error on add invalid additional nested property value", async () => {
      await expect(
        // @ts-expect-error Deliberately adding invalid value
        typedDB.put("b/d", { c: "text" }),
      ).to.be.rejectedWith("must be number");
    });

    it("add additional property key - list", async () => {
      const hash = (await typedDB.put(["b", "d"], { c: 1 }))[0];
      expect(hash).to.be.a("string");
    });

    it("get additional property key/value - list", async () => {
      await typedDB.put(["b", "d"], { c: 1 });

      const actual = await typedDB.all();

      expectNestedMapEqual(actual, { b: { d: { c: 1 } } });
    });

    it("error on add invalid additional property value - list", async () => {
      await expect(
        // @ts-expect-error Deliberately adding invalid value
        typedDB.put(["b", "d"], "text"),
      ).to.be.rejectedWith("must be object");
    });

    it("error on add invalid additional nested property value - list", async () => {
      await expect(
        // @ts-expect-error Deliberately adding invalid value
        typedDB.put(["b", "d"], { c: "text" }),
      ).to.be.rejectedWith("must be number");
    });

    it("invalid values in log lead to error on `db.all()`", async () => {
      // Force write invalid value to underlying orbit-db database
      await db.put(["b", "d"], "text");

      await typedDB.set("a", "text 2");

      await expect(typedDB.all()).to.be.rejectedWith("must be object");
    });

    it("invalid nested values in log lead to error on `db.all()`", async () => {
      // Force write invalid value to underlying orbit-db database
      await db.put(["b", "d"], { c: "text" });

      await typedDB.set("a", "text 2");

      await expect(typedDB.all()).to.be.rejectedWith("must be number");
    });
  });
});
