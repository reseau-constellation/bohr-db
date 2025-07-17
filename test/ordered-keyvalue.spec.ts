import { type HeliaLibp2p } from "helia";
import { rimraf } from "rimraf";

import { createTestHelia } from "./config.js";
import { Identities, Identity, KeyStore, KeyStoreType } from "@orbitdb/core";
import {
  OrderedKeyValue,
  OrderedKeyValueDatabaseType,
} from "@orbitdb/ordered-keyvalue-db";

import {
  TypedOrderedKeyValue,
  typedOrderedKeyValue,
} from "@/ordered-keyvalue.js";

import { chai, chaiAsPromised, expect } from "aegir/chai";
import { JSONSchemaType } from "ajv";
chai.use(chaiAsPromised);

const keysPath = "./testkeys";

const removeHash = <T>(
  data: { key: string; value: T; hash: string }[],
): { key: string; value: T }[] =>
  data.map((x) => ({ key: x.key, value: x.value }));

describe("Typed OrderedKeyValue", () => {
  let ipfs: HeliaLibp2p;
  let identities;
  let keystore: KeyStoreType;
  let testIdentity1: Identity;
  let db: OrderedKeyValueDatabaseType;

  const databaseId = "ordered-keyvalue-AAA";

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

    if (keystore) {
      await keystore.close();
    }

    await rimraf(keysPath);
    await rimraf("./orbitdb");
  });

  describe("Creating a Typed OrderedKeyValue database", () => {
    type structure = { a: number; b: string };
    const schema: JSONSchemaType<Partial<structure>> = {
      type: "object",
      properties: {
        a: { type: "number", nullable: true },
        b: { type: "string", nullable: true },
      },
      required: [],
    };
    let typedDB: TypedOrderedKeyValue<structure>;

    beforeEach(async () => {
      db = await OrderedKeyValue()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
      typedDB = typedOrderedKeyValue({
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

    it("wraps an OrderedKeyValue store", async () => {
      expect(typedDB.type).to.equal("ordered-keyvalue");
    });

    it("returns 0 items when it's a fresh database", async () => {
      const all = await typedDB.all();

      expect(all).to.be.an.empty("object");
    });
  });

  describe("Typed OrderedKeyValue database - fixed properties", () => {
    type structure = { a: number; b: string };
    const schema: JSONSchemaType<Partial<structure>> = {
      type: "object",
      properties: {
        a: { type: "number", nullable: true },
        b: { type: "string", nullable: true },
      },
      additionalProperties: false,
      required: [],
    };
    let typedDB: TypedOrderedKeyValue<structure>;

    beforeEach(async () => {
      db = await OrderedKeyValue()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
      typedDB = typedOrderedKeyValue({
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
      await typedDB.put("b", "c");

      const actual = await typedDB.all();
      expect(removeHash(actual)).to.deep.equal([
        { key: "a", value: 1 },
        { key: "b", value: "c" },
      ]);
    });

    it("error on put invalid key", async () => {
      // @ts-expect-error Deliberately adding invalid key
      await expect(typedDB.put("c", 3)).to.be.rejectedWith(
        "Unsupported key c.",
      );
    });

    it("error on move invalid key", async () => {
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

    it("get valid key", async () => {
      await typedDB.put("a", 1);

      const actual = await typedDB.get("a");
      expect(actual).to.equal(1);
    });

    it("move valid key", async () => {
      await typedDB.put("a", 1);
      await typedDB.put("b", "c");

      await typedDB.move("a", 1);

      const actual = await typedDB.all();
      expect(removeHash(actual)).to.deep.equal([
        { key: "b", value: "c" },
        { key: "a", value: 1 },
      ]);
    });

    it("error on get invalid key", async () => {
      await expect(
        // @ts-expect-error Deliberately getting invalid key
        typedDB.get("d"),
      ).to.be.rejectedWith("Unsupported key d.");
    });

    it("error on move invalid key", async () => {
      await typedDB.put("a", 1);
      await typedDB.put("b", "c");

      // @ts-expect-error Deliberately moving invalid key
      await expect(typedDB.move("d", 1)).to.be.rejectedWith(
        "Unsupported key d.",
      );
    });

    it("invalid keys in log do not appear on `db.all()`", async () => {
      // Force write invalid key to underlying orbit-db database
      await db.put("d", 4);

      await typedDB.put("a", 1);
      await typedDB.set("b", "c");

      const actual = await typedDB.all();
      expect(removeHash(actual)).to.deep.equal([
        { key: "a", value: 1 },
        { key: "b", value: "c" },
      ]);
    });

    it("invalid keys moved in log do not appear on `db.all()`", async () => {
      await typedDB.put("a", 1);
      await typedDB.set("b", "c");

      // Force write invalid key to underlying orbit-db database
      await db.move("d", 2);

      const actual = await typedDB.all();
      expect(removeHash(actual)).to.deep.equal([
        { key: "a", value: 1 },
        { key: "b", value: "c" },
      ]);
    });

    it("invalid values in log lead do not appear on `db.all()`", async () => {
      // Force write invalid value to underlying orbit-db database
      await db.put("a", "text");

      await typedDB.set("b", "c");

      const actual = await typedDB.all();
      expect(removeHash(actual)).to.deep.equal([{ key: "b", value: "c" }]);
    });
  });

  describe("Typed OrderedKeyValue database - additional properties", () => {
    type structure = { [key: string]: number };
    const schema: JSONSchemaType<Partial<structure>> = {
      type: "object",
      additionalProperties: {
        type: "number",
      },
      required: [],
    };
    let typedDB: TypedOrderedKeyValue<structure>;

    beforeEach(async () => {
      db = await OrderedKeyValue()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
      typedDB = typedOrderedKeyValue({
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
      const hash = await typedDB.put("d", 1);
      expect(hash).to.be.a("string");
    });

    it("get additional property key/value", async () => {
      await typedDB.put("d", 1);

      const actual = await typedDB.all();
      expect(removeHash(actual)).to.deep.equal([{ key: "d", value: 1 }]);
    });

    it("error on add invalid additional property value", async () => {
      await expect(
        // @ts-expect-error Deliberately adding invalid value
        typedDB.put("d", "text"),
      ).to.be.rejectedWith("must be number");
    });

    it("invalid values in log do not appear on `db.all()`", async () => {
      // Force write invalid value to underlying orbit-db database
      await db.put("d", "text");

      await typedDB.put("a", 1);
      await typedDB.set("b", 2);

      const actual = await typedDB.all();
      expect(removeHash(actual)).to.deep.equal([
        { key: "a", value: 1 },
        { key: "b", value: 2 },
      ]);
    });
  });

  describe("Typed OrderedKeyValue database - undefined properties", () => {
    type structure = { a: { b?: number; c: number } };
    const schema: JSONSchemaType<Partial<structure>> = {
      type: "object",
      properties: {
        a: {
          type: "object",
          properties: {
            b: { type: "number", nullable: true },
            c: { type: "number" },
          },
          required: ["c"],
          nullable: true,
        },
      },
      additionalProperties: false,
      required: [],
    };
    let typedDB: TypedOrderedKeyValue<structure>;

    beforeEach(async () => {
      db = await OrderedKeyValue()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
      typedDB = typedOrderedKeyValue({
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
      await typedDB.put("a", { b: 1, c: 2 });

      const actual = await typedDB.all();
      expect(removeHash(actual)).to.deep.equal([
        { key: "a", value: { b: 1, c: 2 } },
      ]);
    });

    it("delete key with undefined value", async () => {
      // @ts-expect-error Deliberately adding explicit undefined value
      await typedDB.put("a", { b: undefined, c: 2 });

      const actual = await typedDB.all();
      expect(removeHash(actual)).to.deep.equal([{ key: "a", value: { c: 2 } }]);
    });
  });
});
