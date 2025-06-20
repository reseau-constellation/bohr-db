# Bohr-DB
Discrete types for your orbit-dbs.

[![Tests Bohr-DB](https://github.com/reseau-constellation/bohr-db/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/reseau-constellation/bohr-db/actions/workflows/tests.yml)
[![codecov](https://codecov.io/gh/reseau-constellation/bohr-db/graph/badge.svg?token=LjBS0gKh6n)](https://codecov.io/gh/reseau-constellation/bohr-db)

## Installation
```
$ pnpm add @constl/bohr-db
```
## Introduction
Bohr-DB brings both **TypeScript and runtime-checked types to your orbit-db databases**, so that you can be sure that you'll only receive values that correspond to your specified data schema.

Borh-DB uses AJV to check for data validity behind the scenes. It wraps around existing orbit-db databases with a proxy, so you can use typed Borh-DB databases as a **drop-in and type-safe replacement for the original orbit-db databases** in your code.

Note: `KeyValue` also offers the additional property `.allAsJSON()`, which returns a key, value object instead of a list of entries.

## Why is it called Bohr-DB?
...because now your orbits can only take on [deterministic values](https://en.wikipedia.org/wiki/Bohr_model). 

## Support
Borh-DB currently supports the orbit-db `KeyValue`, as well as the `Feed`, `Set` and `OrderedKeyValue` databases from `@constl/orbit-db-kuiper`. Pull requests for additional db types are of course welcome!

## Examples
Below are a few examples of `bohr-db` with `KeyValue` and `Set` databases. See the test folder for examples with other orbit-db database types.

### Set
As simple example with `Set`:
```ts
import { createOrbit } from "@orbitdb/core";
import { registerSet } from "@orbitdb/set-db";

import { typedSet } from "@constl/bohr-db";

// Register set-db database type. IMPORTANT - must call before creating orbit instance !
registerSet();

const orbit = await createOrbit({ ipfs })

const db = await orbit.open({ type: "set" });
const typedDB = typedSet({
    db,
    schema: numericSchema,
});  // Is exactly the same as `db`, but now type-safe

console.log(typedDB.type) // "set"

// Add valid values
await typedDB.add(1);
await typedDB.add(2);
const all = await typedDB.all();  // [1, 2]

// Invalid values are not added
await typedDB.add("not a number")  // throws both TypeScript and runtime errors !

// Even invalid values somehow added to the log (already present, or received from a peer) will not appear in the data
// Force write invalid value to underlying orbit-db database
await db.add("not a number");
await typedDB.all()  // Yay !! Still [1, 2]
```

Any `ajv` schema can be used, for more complex data types:
```ts
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

const db = await orbit.open({ type: "set" });
const typedDB = typedSet({
    db,
    schema: objectSchema,
});  

// Valid data
await typedDB.add({ a: 1, b: "c" });

// Error !!
await typedDB.add({ a: 1, b: 2 });

```

### KeyValue
A more complex example with `KeyValue`:
```ts
import { typedKeyValue } from "@constl/bohr-db";

type structure = { a: number, b: { c: string, d?: number } };
const schema: JSONSchemaType<Partial<structure>> = {
    type: "object",
    properties: {
        a: { type: "number", nullable: true },
        b: { 
            type: "object",
            properties: {
                c: { type: "string" },
                d: { type: "number", nullable: true}
            }
            nullable: true,
            required: []
        }
    },
    required: [],
};

const db = await orbit.open({ type: "keyvalue" });
const typedDB = typedKeyValue({
    db,
    schema: objectSchema,
});  

// Add valid data
await typedDB.put("a", 1);
await typedDB.put("b", { c: 1, d: "e" });

const values = await typedDB.allAsJSON();

// Invalid data
await typedDB.put("a", "text")  // Error !!

```
