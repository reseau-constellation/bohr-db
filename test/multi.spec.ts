import { type HeliaLibp2p } from "helia";
import { rimraf } from "rimraf";

import { createTestHelia } from "./config.js";
import { Identities, KeyStore } from "@orbitdb/core";
import type { Identity, KeyStoreType } from "@orbitdb/core";
import { merge } from "ts-deepmerge";

import { chai, chaiAsPromised, expect } from "aegir/chai";
import { JSONSchemaType } from "ajv";
import {
  TypedMulti,
  typedMulti,
} from "@/multi/multi.js";
import { TypedSet } from "@/set.js";
import { Multi, MultiDatabaseType } from "@constl/multi-db";
import { SetDatabaseType } from "@orbitdb/set-db";
import { DatabaseApiGenerator, ExtractMultiStructureKeys, ExtractMultiStructureKeysAsList, MultiSchema, MultiStructureValue, MultiStructureWithoutSubDbs, MultiStrucureToJsonSchema } from "@/multi/types.js";
import { extractMultiSchemaKeys, validateMultiValue } from "@/multi/utils.js";

chai.use(chaiAsPromised);

// TODO - formalise default types
type DefaultDbTypes = {
  set: DatabaseApiGenerator<SetDatabaseType>;
};

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
    let typedDB: TypedMulti<Structure, DefaultDbTypes>;

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
  /*
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
*/

  describe("Utils", () => {
    describe("Extract MultiSchema keys", () => {
      it("extract keys", () => {
        const schema: MultiSchema<{a: number, b: string}, DefaultDbTypes> = {
          type: "object",
          properties: {
            a: { type: "number", nullable: true },
            b: { type: "string", nullable: true }
          }
        }
        const actual = extractMultiSchemaKeys(schema)
        expect(actual).to.deep.equal(["a", "b"]);
      })
      it("extract nested", () => {
        const schema: MultiSchema<{a: number, b: { c: string, d: number}}, DefaultDbTypes> = {
          type: "object",
          properties: {
            a: { type: "number", nullable: true },
            b: { type: "object", properties: { c: { type: "string", nullable: true }, d: { type: "number", nullable: true } }, nullable: true }
          }
        }
        const actual = extractMultiSchemaKeys(schema)
        expect(actual).to.deep.equal(["a", "b", "b/c", "b/d"]);
      })
      it("extract sub-db keys", () => {
        const schema: MultiSchema<{ a: number, b: TypedSet<string> }, DefaultDbTypes> = {
          type: "object",
          properties: {
            a: { type: "number", nullable: true },
            b: { dbType: "set", entryType: {type: "string" } }
          }
        }
        const actual = extractMultiSchemaKeys(schema)
        expect(actual).to.deep.equal(["a", "b"]);
      })
      it("extract sub-db nested keys", () => {
        const schema: MultiSchema<{ a: number, b: { c: TypedSet<string> } }, DefaultDbTypes>  = {
          type: "object",
          properties: {
            a: { type: "number", nullable: true },
            b: { type: "object", properties: { c: { dbType: "set", entryType: {type: "string" } } }, nullable: true }
          }
        }
        const actual = extractMultiSchemaKeys(schema)
        expect(actual).to.deep.equal(["a", "b", "b/c"]);
      })
    })
  });

  describe("Types", () => {

    describe("Extract keys", () => {
      it("extract sub-db key", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        }
        const key: ExtractMultiStructureKeys<Structure> = "b"

        expect(typeof key).to.equal("string");  // Nothing to test
      })
      it("error on wrong key", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        }
        // @ts-expect-error  wrong key
        const key: ExtractMultiStructureKeys<Structure> = "c"

        expect(typeof key).to.equal("string");  // Nothing to test
      })
      it("error on sub-db object subkey", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        }
        // @ts-expect-error  sub-db subkey
        const key: ExtractMultiStructureKeys<Structure> = "b/add"

        expect(typeof key).to.equal("string");  // Nothing to test
      })
      it("extract sub-db key - nested", () => {
        type Structure = {
          root: {
            a: number;
            b: TypedSet<string>;
          }
          }
        const key: ExtractMultiStructureKeys<Structure> = "root/b"

        expect(typeof key).to.equal("string");  // Nothing to test
      })
      it("error on wrong key - nested", () => {
        type Structure = {
          root: {
            a: number;
            b: TypedSet<string>;
          }
          }
        // @ts-expect-error  wrong key
        const key: ExtractMultiStructureKeys<Structure> = "root/c"

        expect(typeof key).to.equal("string");  // Nothing to test
      })
      it("error on sub-db object subkey - nested", () => {
        type Structure = {
          root: {
            a: number;
            b: TypedSet<string>;
          }
          }
        // @ts-expect-error  sub-db subkey
        const key: ExtractMultiStructureKeys<Structure> = "root/b/add"

        expect(typeof key).to.equal("string");  // Nothing to test
      })
    });

    describe("Extract keys as list", () => {
      it("extract sub-db key", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        }
        const key: ExtractMultiStructureKeysAsList<Structure> = ["b"];
        
        expect(key).to.be.an("array");  // Nothing to test
      })
      it("error on wrong key", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        }
        // @ts-expect-error  wrong key
        const key: ExtractMultiStructureKeysAsList<Structure> = ["c"];
        
        expect(key).to.be.an("array");  // Nothing to test
      })
      it("error on sub-db object subkey", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        }
        // @ts-expect-error  sub-db subkey
        const key: ExtractMultiStructureKeysAsList<Structure> = ["b", "add"];
        
        expect(key).to.be.an("array");  // Nothing to test
      })
      it("extract sub-db key - nested", () => {
        type Structure = {
          root: {
            a: number;
            b: TypedSet<string>;
          }
          }
        const key: ExtractMultiStructureKeysAsList<Structure> = ["root", "b"];
        
        expect(key).to.be.an("array");  // Nothing to test
      })
      it("error on wrong key - nested", () => {
        type Structure = {
          root: {
            a: number;
            b: TypedSet<string>;
          }
          }
        // @ts-expect-error  wrong key
        const key: ExtractMultiStructureKeysAsList<Structure> = ["root", "c"];
        
        expect(key).to.be.an("array");  // Nothing to test
      })
      it("error on sub-db object subkey - nested", () => {
        type Structure = {
          root: {
            a: number;
            b: TypedSet<string>;
          }
          }
        // @ts-expect-error  sub-db subkey
        const key: ExtractMultiStructureKeysAsList<Structure> = ["root", "b", "add"];
        
        expect(key).to.be.an("array");  // Nothing to test
      })
    });

    describe("MultiStructureValue", () => {
      it("key value", () => {
        type Structure = {
          a: number;
        };
        const value: MultiStructureValue<Structure, DefaultDbTypes> = {
          a: 1,
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("database value", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        };

        const value: MultiStructureValue<Structure, DefaultDbTypes> = {
          a: 1,
          b: new Set(["a", "b"]),
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error on missing value", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        };

        // @ts-expect-error Deliberately missing vallue
        const value: MultiStructureValue<Structure, DefaultDbTypes> = {
          b: new Set(["a", "b"]),
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error on missing database value", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        };

        // @ts-expect-error Deliberately missing vallue
        const value: MultiStructureValue<Structure, DefaultDbTypes> = {
          a: 1,
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error on wrong database content type", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        };

        const value: MultiStructureValue<Structure, DefaultDbTypes> = {
          a: 1,
          // @ts-expect-error Deliberately wrong value
          b: [1, 2, 3],
        };
        expect(value).to.exist(); // Nothing to test
      });

      it("key value - nested", () => {
        type NestedStructure = {
          a: number;
          nested: {
            c: boolean;
          };
        };
        const value: MultiStructureValue<NestedStructure, DefaultDbTypes> = {
          a: 1,
          nested: {
            c: true,
          },
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("database value - nested", () => {
        type NestedStructure = {
          a: number;
          b: TypedSet<string>;
          nested: {
            d: TypedSet<number>;
          };
        };

        const value: MultiStructureValue<NestedStructure, DefaultDbTypes> = {
          a: 1,
          b: new Set(["text"]),
          nested: {
            d: new Set([1, 2]),
          },
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error on missing value - nested", () => {
        type NestedStructure = {
          a: number;
          b: TypedSet<string>;
          nested: {
            c: boolean;
            d: TypedSet<number>;
          };
        };

        const value: MultiStructureValue<NestedStructure, DefaultDbTypes> = {
          a: 3,
          b: new Set(["a", "b"]),
          // @ts-expect-error Deliberately missing vallue
          nested: {
            d: new Set([1, 2]),
          },
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error on missing database value - nested", () => {
        type NestedStructure = {
          a: number;
          b: TypedSet<string>;
          nested: {
            c: boolean;
            d: TypedSet<number>;
          };
        };

        const value: MultiStructureValue<NestedStructure, DefaultDbTypes> = {
          a: 3,
          b: new Set(["a", "b"]),
          // @ts-expect-error Deliberately missing value
          nested: {
            c: false,
          },
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error on wrong database content type - nested", () => {
        type NestedStructure = {
          a: number;
          b: TypedSet<string>;
          nested: {
            c: boolean;
            d: TypedSet<number>;
          };
        };

        const value: MultiStructureValue<NestedStructure, DefaultDbTypes> = {
          a: 3,
          b: new Set(["a", "b"]),
          nested: {
            c: false,
            // @ts-expect-error Deliberately wrong value
            d: new Set(["text"]),
          },
        };
        expect(value).to.exist(); // Nothing to test
      });
    });

    describe("MultiStructureWithoutSubDbs", () => {
      it("key value", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        };

        const value: MultiStructureWithoutSubDbs<Structure, DefaultDbTypes> = {
          a: 1,
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error if missing key", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        };

        // @ts-expect-error Deliberately missing value
        const value: MultiStructureWithoutSubDbs<Structure, DefaultDbTypes> =
          {};
        expect(value).to.exist(); // Nothing to test
      });
      it("error if wrong type", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        };

        const value: MultiStructureWithoutSubDbs<Structure, DefaultDbTypes> = {
          // @ts-expect-error Deliberately wrong type
          a: false,
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error if SubDb included", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        };

        const value: MultiStructureWithoutSubDbs<Structure, DefaultDbTypes> = {
          a: 1,
          // @ts-expect-error Deliberately included SubDB
          b: new Set(["text"]),
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error if SubDb key included with permitted value", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        };

        const value: MultiStructureWithoutSubDbs<Structure, DefaultDbTypes> = {
          a: 1,
          // @ts-expect-error Deliberately included SubDB
          b: 2,
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error if SubDb nested key included", () => {
        type Structure = {
          a: number;
          b: TypedSet<string>;
        };

        const value: MultiStructureWithoutSubDbs<Structure, DefaultDbTypes> = {
          a: 1,
          // @ts-expect-error Deliberately included SubDB
          b: {
            type: "set",
          },
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("key value - nested", () => {
        type Structure = {
          root: { a: number; b: TypedSet<string> };
        };

        const value: MultiStructureWithoutSubDbs<Structure, DefaultDbTypes> = {
          root: { a: 1 },
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error if missing key - nested", () => {
        type Structure = {
          root: {
            a: number;
            b: TypedSet<string>;
          };
        };

        const value: MultiStructureWithoutSubDbs<Structure, DefaultDbTypes> = {
          // @ts-expect-error Deliberately missing value
          root: {},
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error if wrong type - nested", () => {
        type Structure = {
          root: {
            a: number;
            b: TypedSet<string>;
          };
        };

        const value: MultiStructureWithoutSubDbs<Structure, DefaultDbTypes> = {
          // @ts-expect-error Deliberately wrong type
          root: { a: false },
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error if SubDb included - nested", () => {
        type Structure = {
          root: {
            a: number;
            b: TypedSet<string>;
          };
        };

        const value: MultiStructureWithoutSubDbs<Structure, DefaultDbTypes> = {
          root: {
            a: 1,
            // @ts-expect-error Deliberately included SubDB
            b: new Set(["text"]),
          },
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error if SubDb key included with permitted value - nested", () => {
        type Structure = {
          root: {
            a: number;
            b: TypedSet<string>;
          };
        };

        const value: MultiStructureWithoutSubDbs<Structure, DefaultDbTypes> = {
          root: {
            a: 1,
            // @ts-expect-error Deliberately included SubDB
            b: 2,
          },
        };
        expect(value).to.exist(); // Nothing to test
      });
      it("error if SubDb nested key included - nested", () => {
        type Structure = {
          root: {
            a: number;
            b: TypedSet<string>;
          };
        };

        const value: MultiStructureWithoutSubDbs<Structure, DefaultDbTypes> = {
          root: {
            a: 1,
            // @ts-expect-error Deliberately included SubDB
            b: {
              type: "set",
            },
          },
        };
        expect(value).to.exist(); // Nothing to test
      });
    });

    describe("MultiSchema", () => {});

    describe("", () => { 
      it("", () => {
        // MultiStrucureToJsonSchema
        // key value
        // error if missing key
        // error if wrong type
        // error if SubDb included
        // error if SubDb key included with permitted value
        // error if SubDb nested key included (set.add)
        // key value - nested
        // error if missing key - nested
        // error if wrong type - nested
        // error if SubDb included - nested
        // error if SubDb key included with permitted value - nested
        type Structure = {
          a: number;
          b: TypedSet<string>;
        }
        const jsonSchema: MultiStrucureToJsonSchema<Structure, DefaultDbTypes> = {
          type: "object",
          properties: {
            a: { type: "number" },
          },
          required: ["a"],
        };

        const schema: MultiSchema<Structure, DefaultDbTypes> = merge(jsonSchema, {
          properties: { b: { dbType: "set", entryType: {type: "string" } } },
        });
        const value: MultiStructureValue<Structure, DefaultDbTypes> = {
          a: 1,
          b: new Set(["text"])
        }
        const actual = multiSchemaToJSONSchema(schema)
        expect(actual).to.deep.equal(jsonSchema);

        subDbJSONSchema(schema.properties["b"]) === { type: "string" }

        validateMultiValue(value, schema);
      });
    });
  });
});
