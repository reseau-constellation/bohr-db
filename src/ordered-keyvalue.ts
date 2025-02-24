import { JSONSchemaType } from "ajv";
import { OrderedKeyValueDatabaseType } from "@orbitdb/ordered-keyvalue-db";

import { DBElements } from "./types";
import { generateDictValidator, removeUndefinedProperties } from "./utils.js";

export type TypedOrderedKeyValue<T extends { [clef: string]: unknown }> = Omit<
  OrderedKeyValueDatabaseType,
  "put" | "set" | "del" | "move" | "get" | "all"
> & {
  put: <K extends keyof T>(
    key: K,
    value: T[K],
    position?: number,
  ) => Promise<string>;
  set: TypedOrderedKeyValue<T>["put"];
  del: <K extends keyof T>(key: K) => Promise<string>;
  move: <K extends keyof T>(key: K, position: number) => Promise<string>;
  get: <K extends keyof T>(
    key: K,
  ) => Promise<{ value: T[K]; position?: number } | undefined>;
  all: () => Promise<
    {
      key: Extract<keyof T, "string">;
      value: T[keyof T];
      hash: string;
    }[]
  >;
};

export const typedOrderedKeyValue = <T extends { [clef: string]: DBElements }>({
  db,
  schema,
}: {
  db: OrderedKeyValueDatabaseType;
  schema: JSONSchemaType<Partial<T>>;
}): TypedOrderedKeyValue<T> => {
  const { validateKey, getKeyValidator, supportedKey } =
    generateDictValidator(schema);

  return new Proxy(db, {
    get(target, prop) {
      if (prop === "get") {
        return async (
          key: Extract<keyof T, string>,
        ): Promise<
          { value: T[typeof key]; position: number | undefined } | undefined
        > => {
          if (!supportedKey(key)) throw new Error(`Unsupported key ${key}.`);

          const val = await target.get(key);
          if (val === undefined) return val;

          const { value, position } = val;
          const valid = validateKey(value, key);

          return valid ? { value: value, position } : undefined;
        };
      } else if (prop === "move") {
        return async (
          key: Extract<keyof T, string>,
          position: number,
        ): Promise<string> => {
          if (!supportedKey(key)) throw new Error(`Unsupported key ${key}.`);
          return await target.move(key, position);
        };
      } else if (prop === "put" || prop === "set") {
        return async (
          key: Extract<keyof T, string>,
          value: T[typeof key],
          position?: number,
        ): Promise<string> => {
          if (!supportedKey(key)) throw new Error(`Unsupported key ${key}.`);

          if (typeof value === "object" && !Array.isArray(value)) {
            value = removeUndefinedProperties(value) as T[typeof key];
          }

          const valid = validateKey(value, key);
          if (valid) return await target.put(key, value, position);
          else
            throw new Error(
              JSON.stringify(getKeyValidator(key).errors, undefined, 2),
            );
        };
      } else if (prop === "all") {
        return async () => {
          const all = await target.all();
          return all.filter((x) => validateKey(x.value, x.key));
        };
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as unknown as TypedOrderedKeyValue<T>;
};
