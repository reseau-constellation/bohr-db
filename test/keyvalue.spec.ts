import { type HeliaLibp2p } from "helia";
import { rimraf } from "rimraf";

import { createTestHelia } from "./config.js";
import { OrbitDB, createOrbitDB } from "@orbitdb/core";
import type { KeyValueDatabase } from "@orbitdb/core";

import { TypedKeyValue, typedKeyValue } from "@/keyvalue.js";

import { chai, chaiAsPromised, expect } from "aegir/chai";
import { JSONSchemaType } from "ajv";
chai.use(chaiAsPromised);

const keysPath = "./testkeys";

describe("Typed KeyValue", () => {
  let ipfs: HeliaLibp2p;
  let orbit: OrbitDB;
  let db: KeyValueDatabase;

  const databaseId = "keyValue-AAA";

  before(async () => {
    ipfs = await createTestHelia();

    orbit = await createOrbitDB({ ipfs, directory: "./orbitdb" });
  });

  after(async () => {
    if (ipfs) {
      await ipfs.stop();
    }

    await rimraf(keysPath);
    await rimraf("./orbitdb");
  });

  describe("Creating a Typed KeyValue database", () => {
    type structure = { a: number; b: string };
    const schema: JSONSchemaType<Partial<structure>> = {
      type: "object",
      properties: {
        a: { type: "number", nullable: true },
        b: { type: "string", nullable: true },
      },
      required: [],
    };
    let typedDB: TypedKeyValue<structure>;

    beforeEach(async () => {
      db = (await orbit.open(databaseId, {
        type: "keyvalue",
      })) as unknown as KeyValueDatabase;
      typedDB = typedKeyValue({
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

    it("wraps a keyValue store", async () => {
      expect(typedDB.type).to.equal("keyvalue");
    });

    it("returns 0 items when it's a fresh database", async () => {
      const all = await typedDB.allAsJSON();

      expect(all).to.be.an.empty("object");
    });
  });

  describe("Typed KeyValue database - fixed properties", () => {
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
    let typedDB: TypedKeyValue<structure>;

    beforeEach(async () => {
      db = (await orbit.open(databaseId, {
        type: "keyvalue",
      })) as unknown as KeyValueDatabase;
      typedDB = typedKeyValue({
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

      const actual = await typedDB.allAsJSON();
      expect(actual).to.deep.equal({ a: 1, b: "c" });
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

    it("get valid key", async () => {
      await typedDB.put("a", 1);

      const actual = await typedDB.get("a");
      expect(actual).to.equal(1);
    });

    it("error on get invalid key", async () => {
      await expect(
        // @ts-expect-error Deliberately getting invalid key
        typedDB.get("d"),
      ).to.be.rejectedWith("Unsupported key d.");
    });

    it("invalid keys in log lead to error on `db.allAsJSON()`", async () => {
      // Force write invalid key to underlying orbit-db database
      await db.put("d", 4);

      await typedDB.put("a", 1);
      await typedDB.set("b", "c");

      await expect(typedDB.allAsJSON()).to.be.rejectedWith(
        "must NOT have additional properties",
      );
    });

    it("invalid values in log lead to error on `db.allAsJSON()`", async () => {
      // Force write invalid value to underlying orbit-db database
      await db.put("a", "text");

      await typedDB.set("b", "c");

      await expect(typedDB.allAsJSON()).to.be.rejectedWith("must be number");
    });
  });

  describe("Typed KeyValue database - additional properties", () => {
    type structure = { [key: string]: number };
    const schema: JSONSchemaType<Partial<structure>> = {
      type: "object",
      additionalProperties: {
        type: "number",
      },
      required: [],
    };
    let typedDB: TypedKeyValue<structure>;

    beforeEach(async () => {
      db = (await orbit.open(databaseId, {
        type: "keyvalue",
      })) as unknown as KeyValueDatabase;
      typedDB = typedKeyValue({
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

      const actual = await typedDB.allAsJSON();
      expect(actual).to.deep.equal({ d: 1 });
    });

    it("error on add invalid additional property value", async () => {
      await expect(
        // @ts-expect-error Deliberately adding invalid value
        typedDB.put("d", "text"),
      ).to.be.rejectedWith("must be number");
    });

    it("invalid values in log lead to error on `db.allAsJSON()`", async () => {
      // Force write invalid value to underlying orbit-db database
      await db.put("d", "text");

      await typedDB.set("b", 1);

      await expect(typedDB.allAsJSON()).to.be.rejectedWith("must be number");
    });
  });

  describe("Typed KeyValue database - undefined properties", () => {
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
    let typedDB: TypedKeyValue<structure>;

    beforeEach(async () => {
      db = (await orbit.open(databaseId, {
        type: "keyvalue",
      })) as unknown as KeyValueDatabase;
      typedDB = typedKeyValue({
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

      const actual = await typedDB.allAsJSON();
      expect(actual).to.deep.equal({ a: { b: 1, c: 2 } });
    });

    it("delete entry on undefined value", async () => {
      // @ts-expect-error Deliberately adding explicit undefined value
      await typedDB.put("a", { b: undefined, c: 2 });

      const actual = await typedDB.allAsJSON();
      expect(actual).to.deep.equal({ a: { c: 2 } });
    });
  });
});
