import { JSONSchemaType } from "ajv";
import { OrderedKeyValueDatabaseType } from "@constl/orbit-db-kuiper";

import { DBElements } from "./types";
import { generateDictValidator } from "./utils.js";

export type OrderedKeyValueStoreTypé<T extends { [clef: string]: unknown }> =
  Omit<
    OrderedKeyValueDatabaseType,
    "put" | "set" | "del" | "move" | "get" | "all"
  > & {
    put: <K extends keyof T>(
      key: K,
      value: T[K],
      position?: number,
    ) => Promise<string>;
    set: OrderedKeyValueStoreTypé<T>["put"];
    del: <K extends keyof T>(key: K) => Promise<string>;
    move: <K extends keyof T>(key: K, position: number) => Promise<string>;
    get: <K extends keyof T>(key: K) => Promise<T[K] | undefined>;
    all: () => Promise<
      {
        key: keyof T;
        value: T[keyof T];
        hash: string;
      }[]
    >;
  };

export const typedOrderedKeyValueStore = <
  T extends { [clef: string]: DBElements },
>({
  db,
  schema,
}: {
  db: OrderedKeyValueDatabaseType;
  schema: JSONSchemaType<Partial<T>>;
}): OrderedKeyValueStoreTypé<T> => {
  const { validateRoot, validateKey, getKeyValidator, supportedKey } =
    generateDictValidator(schema);

  return new Proxy(db, {
    get(target, prop) {
      if (prop === "get") {
        return async (
          key: Extract<keyof T, string>,
        ): Promise<{ value: T[typeof key]; position?: number } | undefined> => {
          const val = await target.get(key);
          if (val === undefined) return val;
          const { value, position } = val;
          const valid = validateKey(value, key);
          if (valid) return { value: value, position };
          else return undefined;
        };
      } else if (prop === "put" || prop === "set") {
        return async (
          key: Extract<keyof T, string>,
          value: T[typeof key],
          position?: number,
        ): Promise<string> => {
          const valid = validateKey(value, key);
          if (valid) return await target.put(key, value, position);
          else
            throw new Error(
              supportedKey(key)
                ? JSON.stringify(getKeyValidator(key).errors, undefined, 2)
                : `Unsupported key ${key}.`,
            );
        };
      } else if (prop === "all") {
        return async () => {
          const all = await target.all();
          const data = Object.fromEntries(all.map((x) => [x.key, x.value]));
          const valid = validateRoot(data);
          if (valid) {
            return data;
          } else {
            throw new Error(JSON.stringify(validateRoot.errors, undefined, 2));
          }
        };
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as unknown as OrderedKeyValueStoreTypé<T>;
};
