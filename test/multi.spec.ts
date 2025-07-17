/*import { type HeliaLibp2p } from "helia";
import { rimraf } from "rimraf";

import { createTestHelia } from "./config.js";
import { Identities, KeyStore, OrbitDB, createOrbitDB } from "@orbitdb/core";
import type { Identity, KeyStoreType, KeyValueDatabase } from "@orbitdb/core";

import { TypedKeyValue, typedKeyValue } from "@/keyvalue.js";

import { chai, chaiAsPromised, expect } from "aegir/chai";
import { JSONSchemaType } from "ajv";
import { MultiSchema, TypedMulti, typedMulti } from "@/multi.js";
import { TypedSet } from "@/set.js";
import { Multi, MultiDatabaseType } from "@constl/multi-db";

chai.use(chaiAsPromised);

const keysPath = "./testkeys";

describe("Typed Multi", () => {
  let ipfs: HeliaLibp2p;
  let identities;
  let keystore: KeyStoreType;
  let testIdentity1: Identity;
  let db: MultiDatabaseType;
  

  const databaseId = "multi-AAA";

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

  describe("Creating a Typed Multi database", () => {
    type Structure = { a: number; b: string };
    const schema: JSONSchemaType<Partial<Structure>> = {
      type: "object",
      properties: {
        a: { type: "number", nullable: true },
        b: { type: "string", nullable: true },
      },
      required: [],
    };
    let typedDB: TypedMulti<Structure>;

    beforeEach(async () => {
      db = await Multi()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
      typedDB = typedMulti({
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
      const all = await typedDB.all();

      expect(all).to.be.empty();
    });
  });

  describe("Typed Multi database - fixed properties", () => {
    type Structure = { a: number; b: { c: string, d: TypedSet<string> } };
    
    const schema: MultiSchema<Structure> = {
      type: "object",
      properties: {
        a: { type: "number", nullable: true },
        b: {
          type: "object",
          properties: {
            c: { type: "string", nullable: true },
            d: { type: "Set", subType: { type: "string" } }
          },
          required: [],
          nullable: true,
          additionalProperties: false,
        },
      },
      additionalProperties: false,
      required: [],
    };
    let typedDB: TypedMulti<Structure>;

    beforeEach(async () => {
      db = await Multi()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
      typedDB = typedMulti({
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

    it("", async () => {
      typedDB.set("b/c", "text");

      const cValue = await typedDB.subDb("set", "b/c");
      await cValue.add("a")

      cValue.all() // Set(["a"]);
      typedDB.all()  // => { a: 1, b: { c: "text", d: Set(["a"]) } }
    });  
    it("move subDb", async () => {
      await typedDB.move("b/d", 0)

      typedDB.all()  // => { a: 1, b: { d: Set(["a"]), c: "text" } }

    });

    it("", async () => {
      // @ts-expect-error Assigning value to subDb key
      await typedDB.set("b/d", "test") 

      // Force add wrong value
      await db.addOperation()

      // Output is still correct

    }); 

    it("error on wrong subDb type", async () => {
      // @ts-expect-error Wrong subDb type
      await typedDB.subDb("feed", "b/c");

      // Force add wrong subDb type
      await db.addOperation()

      // Output is still correct

    }); it("", async () => {

      // @ts-expect-error Wrong subDb key
      await typedDB.subDb("set", "b");

      // Force add subDb to wrong key
      await db.addOperation()

      // Output is still correct

    }); it("error on wrong value in subDb", async () => {
      // @ts-expect-error Wrong value type
      await cValue.add(1)

    });
  });

  describe("Typed Nested database - additional properties", () => {});

  describe("Types", () => {

  })
});
*/