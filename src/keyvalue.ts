import type { JSONSchemaType } from "ajv";
import type { KeyValueDatabase } from "@orbitdb/core";

import type { DBElements } from "./types.js";
import { generateDictValidator, removeUndefinedProperties } from "./utils.js";

export type TypedKeyValue<T extends { [clef: string]: unknown }> = Omit<
  KeyValueDatabase,
  "put" | "set" | "del" | "get" | "all"
> & {
  put<K extends keyof T>(key: K, value: T[K]): Promise<string>;
  set: TypedKeyValue<T>["put"];
  del<K extends keyof T>(key: K): Promise<string>;
  get<K extends keyof T>(key: K): Promise<T[K] | undefined>;
  all: () => Promise<
    {
      key: Extract<keyof T, "string">;
      value: T[keyof T];
      hash: string;
    }[]
  >;
  allAsJSON(): Promise<T>;
};

export const typedKeyValue = <T extends { [clef: string]: DBElements }>({
  db,
  schema,
}: {
  db: KeyValueDatabase;
  schema: JSONSchemaType<Partial<T>>;
}): TypedKeyValue<T> => {
  const { validateRoot, validateKey, getKeyValidator, supportedKey } =
    generateDictValidator(schema);

  return new Proxy(db, {
    get(target: KeyValueDatabase, prop) {
      if (prop === "get") {
        return async (
          key: Extract<keyof T, string>,
        ): Promise<T[typeof key] | undefined> => {
          if (!supportedKey(key)) throw new Error(`Unsupported key ${key}.`);
          const val = await target.get(key);
          if (val === undefined) return val;
          const valid = validateKey(val, key);
          return valid ? val : undefined;
        };
      } else if (prop === "put" || prop === "set") {
        return async (
          key: Extract<keyof T, string>,
          value: T[typeof key],
        ): Promise<string> => {
          if (!supportedKey(key)) throw new Error(`Unsupported key ${key}.`);

          if (typeof value === "object" && !Array.isArray(value)) {
            value = removeUndefinedProperties(value) as T[typeof key];
          }

          const valid = validateKey(value, key);

          if (valid) return await target.put(key, value);
          else
            throw new Error(
              JSON.stringify(getKeyValidator(key).errors, undefined, 2),
            );
        };
      } else if (prop === "all") {
        return async () => {
          // Todo: check why types don't work automatically here
          const all = (await target.all()) as {
            key: string;
            value: unknown;
            hash: string;
          }[];
          return all.filter((x) => validateKey(x.value, x.key));
        };
      } else if (prop === "allAsJSON") {
        return async () => {
          // Todo: check why types don't work automatically here
          const all = (await target.all()) as {
            key: string;
            value: unknown;
            hash: string;
          }[];
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
  }) as unknown as TypedKeyValue<T>;
};
