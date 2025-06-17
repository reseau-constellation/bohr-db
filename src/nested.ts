import type { JSONSchemaType } from "ajv";
import {
  splitKey,
  type NestedDatabaseType,
  type NestedValue,
  toNested,
} from "@orbitdb/nested-db";

import {
  DBElements,
  ExtractKeys,
  ExtractKeysAsList,
  GetValueFromKey,
  GetValueFromKeyList,
  RecursivePartial,
} from "./types.js";
import { removeUndefinedProperties } from "./utils.js";

export type TypedNested<T extends NestedValue> = Omit<
  NestedDatabaseType,
  "put" | "set" | "putNested" | "del" | "get" | "all"
> & {
  put<K extends ExtractKeys<T>>(
    key: K,
    value: GetValueFromKey<T, K>,
  ): Promise<string>;
  put<K extends ExtractKeysAsList<T>>(
    key: K,
    value: GetValueFromKeyList<T, K>,
  ): Promise<string>;
  set: TypedNested<T>["put"];
  putNested(value: RecursivePartial<T>): Promise<string[]>;
  setNested: TypedNested<T>["putNested"];
  del<K extends ExtractKeys<T>>(key: K): Promise<string>;
  get<K extends ExtractKeys<T>>(
    key: K,
  ): Promise<GetValueFromKey<T, K> | undefined>;
  all: () => Promise<
    {
      key: ExtractKeys<T>;
      value: GetValueFromKey<T, ExtractKeys<T>>;
      hash: string;
    }[]
  >;
  allAsJSON(): Promise<T>;
};

export const typedNested = <T extends NestedValue>({
  db,
  schema,
}: {
  db: NestedDatabaseType;
  schema: JSONSchemaType<RecursivePartial<T>>;
}): TypedNested<T> => {
  const supportedKey = (key: string | string[]) => {
    const keyComponents = typeof key === "string" ? splitKey(key) : key;
    let schemaBranch = schema;
    for (const k of keyComponents) {
      if (schemaBranch.additionalProperties) return true;
      if (schemaBranch.properties[k] === undefined) return false;
      schemaBranch = schemaBranch.properties[k];
    }
    return true;
  };
  // const compiledValidators: {[key in ExtractKeys<T>]: (x: unknown)=>x is GetValueFromKey<T, key>} = {};

  /*const validateKeyValue = <K extends ExtractKeys<T>>(
    val: unknown, key: K
  ): val is GetValueFromKey<T, K> => {
    return compiledValidators[key](val)
  }*/
  return new Proxy(db, {
    get(target, prop) {
      if (prop === "allAsJSON") {
        // Todo: type check
        return async () => toNested(await db.all());
      } else if (prop === "setNested" || prop === "putNested") {
        return async (data: T): Promise<string[]> => {
          data = removeUndefinedProperties(data) as T;
          // Todo: type check
          return await db.putNested(data);
        };
      }

      /*if (prop === "get") {
        return async <K extends ExtractKeys<T>>(key: K): Promise<GetValueFromKey<T, K> | undefined> => {
          if (!supportedKey(key)) throw new Error(`Unsupported key ${key}.`);
          const val = await target.get(key);
          if (val === undefined) return val;
          if (validateKeyValue(val, key)) {
            return val
          } else {
            return undefined;
          };
        };
      }
      else {
      };*/
      return target[prop as keyof typeof target];
    },
  }) as unknown as TypedNested<T>;
};
