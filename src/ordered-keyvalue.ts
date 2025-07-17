import { JSONSchemaType } from "ajv";
import { OrderedKeyValueDatabaseType } from "@orbitdb/ordered-keyvalue-db";

import { DBElements } from "./types";
import { generateDictValidator, removeUndefinedProperties } from "./utils.js";
import { DagCborEncodable } from "@orbitdb/core";

export type TypedOrderedKeyValue<T extends { [clef: string]: DagCborEncodable }> = Omit<
  OrderedKeyValueDatabaseType,
  "put" | "set" | "del" | "move" | "get" | "all"
> & {
  put: <K extends Extract<keyof T, string>>(
    key: K,
    value: T[K],
    position?: number,
  ) => Promise<string>;
  set: TypedOrderedKeyValue<T>["put"];
  del: <K extends keyof T>(key: K) => Promise<string>;
  move: <K extends Extract<keyof T, string>>(key: K, position: number) => Promise<void>;
  get: <K extends Extract<keyof T, string>>(
    key: K,
  ) => Promise<T[K] | undefined>;
  all: () => Promise<
    {
      key: Extract<keyof T, string>;
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
        const wrappedGet: TypedOrderedKeyValue<T>["get"] = async (key) => {
          if (!supportedKey(key)) throw new Error(`Unsupported key ${key}.`);

          const value = await target.get(key);
          if (value === undefined) return value;

          const valid = validateKey(value, key);

          return valid ? value : undefined;
        };
        return wrappedGet;
      } else if (prop === "move") {
        const wrappedMove: TypedOrderedKeyValue<T>["move"] = async (key, position) => {
          if (!supportedKey(key)) throw new Error(`Unsupported key ${key}.`);
          return await target.move(key, position);
        };
        return wrappedMove;
      } else if (prop === "put" || prop === "set") {
        const wrappedPut: TypedOrderedKeyValue<T>["put"] = async (
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
        return wrappedPut;
      } else if (prop === "all") {
        const wrappedAll: TypedOrderedKeyValue<T>["all"] = async () => {
          const all = await target.all();
          return all.filter((x) => validateKey(x.value, x.key)) as {
            key: Extract<keyof T, string>;
            value: T[keyof T];
            hash: string;
          }[];
        };
        return wrappedAll;
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as unknown as TypedOrderedKeyValue<T>;
};
