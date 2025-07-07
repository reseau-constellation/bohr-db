import { Ajv, ValidateFunction, type JSONSchemaType } from "ajv";
import {
  splitKey,
  type NestedDatabaseType,
  type NestedValue,
} from "@orbitdb/nested-db";

import {
  ExtractKeys,
  ExtractKeysAsList,
  GetValueFromKey,
  GetValueFromKeyList,
  RecursivePartial,
} from "./types.js";
import { getJoinedKey, removeUndefinedProperties } from "./utils.js";

export type TypedNested<T extends NestedValue> = Omit<
  NestedDatabaseType,
  "put" | "set" | "putNested" | "setNested" | "del" | "get" | "all"
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
  putNested<K extends ExtractKeys<T>>(
    key: K,
    value: RecursivePartial<GetValueFromKey<T, K>>,
  ): Promise<string[]>;
  setNested: TypedNested<T>["putNested"];

  del<K extends ExtractKeys<T> | ExtractKeysAsList<T>>(key: K): Promise<string>;

  get<K extends ExtractKeys<T>>(
    key: K,
  ): Promise<GetValueFromKey<T, K> | undefined>;
  get<K extends ExtractKeysAsList<T>>(
    key: K,
  ): Promise<GetValueFromKeyList<T, K> | undefined>;

  all: () => Promise<
    {
      key: ExtractKeys<T>;
      value: GetValueFromKey<T, ExtractKeys<T>>;
      hash: string;
    }[]
  >;
  allAsJSON(): Promise<RecursivePartial<T>>;
};

export const typedNested = <T extends NestedValue>({
  db,
  schema,
}: {
  db: NestedDatabaseType;
  schema: JSONSchemaType<RecursivePartial<T>>;
}): TypedNested<T> => {
  const ajv = new Ajv({ allowUnionTypes: true });
  const rootValidator = ajv.compile<RecursivePartial<T>>(schema);

  const validators: { [key in ExtractKeys<T>]?: ValidateFunction } = {};
  const getValidator = <K extends ExtractKeys<T>>(
    key: K,
  ): ValidateFunction<GetValueFromKey<T, K>> => {
    let branchSchema = schema;
    for (const k of splitKey(key)) {
      branchSchema =
        branchSchema.properties[k] || branchSchema.additionalProperties;
    }
    if (!validators[key]) {
      validators[key] = ajv.compile(branchSchema);
    }
    return validators[key] as ValidateFunction<GetValueFromKey<T, K>>;
  };

  const supportedKey = (
    key: string | string[],
  ): key is ExtractKeys<T> | ExtractKeysAsList<T> => {
    const keyComponents = typeof key === "string" ? splitKey(key) : key;
    let schemaBranch = schema;
    for (const k of keyComponents) {
      if (schemaBranch.additionalProperties) return true;
      if (schemaBranch.properties[k] === undefined) return false;
      schemaBranch = schemaBranch.properties[k];
    }
    return true;
  };

  return new Proxy(db, {
    get(target, prop) {
      if (prop === "put" || prop === "set") {
        const typedPut: TypedNested<T>["put"] = async (
          ...args: Parameters<TypedNested<T>["put"]>
        ): ReturnType<TypedNested<T>["put"]> => {
          const [key, value] = args;
          if (!supportedKey(key)) throw new Error(`Unsupported key ${key}.`);

          const joinedKey = typeof key === "string" ? key : getJoinedKey(key);
          const valueValidator = getValidator(joinedKey);
          if (valueValidator(value)) return target.put(key, value);
          else
            throw new Error(
              JSON.stringify(valueValidator.errors, undefined, 2),
            );
        };
        return typedPut;
      } else if (prop === "get") {
        const typedGet = async (...args: Parameters<TypedNested<T>["get"]>) => {
          const [key] = args;
          if (!supportedKey(key)) throw new Error(`Unsupported key ${key}.`);

          return target.get(key);
        };
        return typedGet;
      } else if (prop === "del") {
        const typedDel = async (...args: Parameters<TypedNested<T>["del"]>) => {
          const [key] = args;
          if (!supportedKey(key)) throw new Error(`Unsupported key ${key}.`);

          return target.del(key);
        };
        return typedDel;
      } else if (prop === "allAsJSON") {
        const typedAllAsJSON: TypedNested<T>["allAsJSON"] = async () => {
          const jsonValue = await db.all();
          if (rootValidator(jsonValue)) {
            return jsonValue;
          }
          throw new Error(JSON.stringify(rootValidator.errors, undefined, 2));
        };
        return typedAllAsJSON;
      } else if (prop === "setNested" || prop === "putNested") {
        const typedSetNested: TypedNested<T>["setNested"] = async <
          K extends ExtractKeys<T>,
        >(
          keyOrValue: K | RecursivePartial<T>,
          value?: RecursivePartial<GetValueFromKey<T, K>>,
        ): Promise<string[]> => {
          if (typeof keyOrValue === "string") {
            // @ts-expect-error types in progress
            const data = removeUndefinedProperties(value);
            // Todo: type check
            return await db.putNested(keyOrValue, data);
          } else {
            // @ts-expect-error types in progress
            const data = removeUndefinedProperties(keyOrValue);
            // Todo: type check
            return await db.putNested(data);
          }
        };
        return typedSetNested;
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
