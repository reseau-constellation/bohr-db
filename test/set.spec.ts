import { type Helia } from "helia";
import { rimraf } from "rimraf";

import { createTestHelia } from "./config.js";
import { Identities, Identity, KeyStore, KeyStoreType } from "@orbitdb/core";
import { Set, SetDatabaseType } from "@orbitdb/set-db";

import { TypedSet, typedSet } from "@/set.js";

import { chai, chaiAsPromised, expect } from "aegir/chai";
import { JSONSchemaType } from "ajv";
chai.use(chaiAsPromised);

const keysPath = "./testkeys";

const numericSchema: JSONSchemaType<number> = { type: "number" };

describe("Typed Set", () => {
  let ipfs: Helia;
  let identities;
  let keystore: KeyStoreType;
  let testIdentity1: Identity;
  let db: SetDatabaseType;

  const databaseId = "set-AAA";

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

  describe("Creating a Typed Set database", () => {
    let typedDB: TypedSet<number>;

    beforeEach(async () => {
      db = await Set()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
      typedDB = typedSet({
        db,
        schema: numericSchema,
      });
    });

    afterEach(async () => {
      if (typedDB) {
        await typedDB.drop();
        await typedDB.close();
      }
    });

    it("wraps a set store", async () => {
      expect(typedDB.address.toString()).to.equal(databaseId);
      expect(typedDB.type).to.equal("set");
    });

    it("returns 0 items when it's a fresh database", async () => {
      const all = await typedDB.all();

      expect(all.length).to.equal(0);
    });
  });

  describe("Typed Set database - simple type", () => {
    let typedDB: TypedSet<number>;

    beforeEach(async () => {
      db = await Set()({
        ipfs,
        identity: testIdentity1,
        address: "numeric-set",
      });
      typedDB = typedSet({
        db,
        schema: numericSchema,
      });
    });

    afterEach(async () => {
      if (typedDB) {
        await typedDB.drop();
        await typedDB.close();
      }
    });

    it("add valid values", async () => {
      await typedDB.add(1);
      await typedDB.add(2);
      const actual = await typedDB.all();
      expect(actual.map((x) => x.value)).to.deep.equal([1, 2]);
    });

    it("error on add invalid values", async () => {
      // @ts-expect-error Deliberately adding invalid type
      await expect(typedDB.add("not a number")).to.be.rejectedWith(
        "must be number",
      );
    });

    it("invalid values in log are not returned by `db.all()`", async () => {
      // Force write invalid value to underlying orbit-db database
      await db.add("not a number");

      await typedDB.add(1);
      await typedDB.add(2);

      const actual = await typedDB.all();
      expect(actual.map((x) => x.value)).to.deep.equal([1, 2]);
    });
  });

  describe("Typed Set database - object type", () => {
    type structure = {
      a: number;
      b?: string;
    };
    const objectSchema: JSONSchemaType<structure> = {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "string", nullable: true },
      },
      required: ["a"],
    };

    let typedDB: TypedSet<structure>;

    beforeEach(async () => {
      db = await Set()({
        ipfs,
        identity: testIdentity1,
        address: "object-set",
      });
      typedDB = typedSet({
        db,
        schema: objectSchema,
      });
    });

    afterEach(async () => {
      if (typedDB) {
        await typedDB.drop();
        await typedDB.close();
      }
    });

    it("add valid object", async () => {
      await typedDB.add({ a: 1, b: "c" });
      const actual = await typedDB.all();
      expect(actual.map((x) => x.value)).to.deep.eq([{ a: 1, b: "c" }]);
    });

    it("error on add invalid object", async () => {
      // @ts-expect-error Deliberately adding invalid type
      await expect(typedDB.add({ a: "b", b: 2 })).to.be.rejectedWith(
        "must be number",
      );
    });

    it("invalid values in log are not returned by `db.all()`", async () => {
      // Force write invalid value to underlying orbit-db database
      await db.add({ a: "b", b: 2 });

      await typedDB.add({ a: 1 });
      await typedDB.add({ a: 2, b: "c" });

      const actual = await typedDB.all();
      expect(actual.map((x) => x.value)).to.deep.equal([
        { a: 1 },
        { a: 2, b: "c" },
      ]);
    });
  });
});
