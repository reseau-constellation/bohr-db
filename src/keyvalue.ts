import type { JSONSchemaType } from "ajv";
import type { KeyValue } from "@orbitdb/core";

import type { DBElements } from "./types.js";
import { generateDictValidator } from "./utils.js";

export type TypedKeyValue<T extends { [clef: string]: unknown }> = Omit<
  KeyValue,
  "put" | "set" | "del" | "get" | "all"
> & {
  put<K extends keyof T>(key: K, value: T[K]): Promise<string>;
  set: TypedKeyValue<T>["put"];
  del<K extends keyof T>(key: K): Promise<string>;
  get<K extends keyof T>(key: K): Promise<T[K] | undefined>;
  all(): Promise<T>;
};

export const typedKeyValueStore = <T extends { [clef: string]: DBElements }>({
  db,
  schema,
}: {
  db: KeyValue;
  schema: JSONSchemaType<Partial<T>>;
}): TypedKeyValue<T> => {
  const { validateRoot, validateKey, getKeyValidator, supportedKey } =
    generateDictValidator(schema);

  return new Proxy(db, {
    get(target, prop) {
      if (prop === "get") {
        return async (
          key: Extract<keyof T, string>,
        ): Promise<T[typeof key] | undefined> => {
          const val = await target.get(key);
          if (val === undefined) return val;
          const valide = validateKey(val, key);
          return valide ? val : undefined;
        };
      } else if (prop === "put" || prop === "set") {
        return async (
          key: Extract<keyof T, string>,
          value: T[typeof key],
        ): Promise<string> => {
          const valid = validateKey(value, key);
          if (valid) return await target.put(key, value);
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
  }) as unknown as TypedKeyValue<T>;
};
