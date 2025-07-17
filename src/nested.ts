import { Ajv, ValidateFunction, type JSONSchemaType } from "ajv";
import {
  joinKey,
  splitKey,
  NestedObjectToMap,
  NestedValueObject,
  NestedDatabaseType,
  toObject,
  asJoinedKey,
  isNestedValueObject
} from "@orbitdb/nested-db";

import {
  ExtractKeys,
  ExtractKeysAsList,
  GetValueFromKey,
  GetValueFromKeyList,
  GetValueFromNestedKey,
  RecursivePartial,
} from "./types.js";
import { NoUndefinedField, getJoinedKey, removeUndefinedProperties } from "./utils.js";

// TODO: organise types
type MapIfObject<T> = T extends NestedValueObject ? NestedObjectToMap<T> : T

export type TypedNested<T extends NestedValueObject> = Omit<
  NestedDatabaseType,
  "put" | "set" | "del" | "get" | "move" | "all"
> & {
  put<K extends ExtractKeys<T>>(
    key: K,
    value: GetValueFromKey<T, K>,
    position?: number,
  ): Promise<string[]>;


  put(value: RecursivePartial<T>): Promise<string[]>;
  put<K extends ExtractKeys<T>>(
    key: K,
    value: RecursivePartial<GetValueFromKey<T, K>>,
    position?: number,
  ): Promise<string[]>;
  put<K extends ExtractKeysAsList<T>>(
    key: K,
    value: RecursivePartial<GetValueFromKeyList<T, K>>,
    position?: number,
  ): Promise<string[]>;
  set: TypedNested<T>["put"];

  move<K extends ExtractKeys<T> | ExtractKeysAsList<T>>(key: K, position: number): Promise<string>;
  
  del<K extends ExtractKeys<T> | ExtractKeysAsList<T>>(key: K): Promise<string>;

  get<K extends ExtractKeys<T>>(
    key: K,
  ): Promise<MapIfObject<GetValueFromKey<T, K>> | undefined>;
  get<K extends ExtractKeysAsList<T>>(
    key: K,
  ): Promise<MapIfObject<GetValueFromKeyList<T, K>> | undefined>;

  all: () => Promise<NestedObjectToMap<T>>;
};

export const typedNested = <T extends NestedValueObject>({
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
      if (branchSchema.additionalProperties) {
        validators[key] =
          branchSchema.additionalProperties === true
            ? ((() => true) as unknown as ValidateFunction)
            : ajv.compile(branchSchema.additionalProperties);
        break;
      }
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
      // .? is necessary if schemaBranch does not have `properties`
      if (schemaBranch.properties?.[k] === undefined) return false;
      schemaBranch = schemaBranch.properties[k];
    }
    return true;
  };

  return new Proxy(db, {
    get(target, prop) {
      if (prop === "get") {
        const typedGet = async <K extends (ExtractKeysAsList<T> | ExtractKeys<T>)>(key: K): Promise<GetValueFromNestedKey<T, K> | undefined> => {
          const joinedKey = (typeof key === "string" ? key : getJoinedKey(key as ExtractKeysAsList<T>)) as ExtractKeys<T>;
          if (!supportedKey(key))
            throw new Error(`Unsupported key ${joinedKey}.`);

          const value = await target.get(key);
          const valueValidator = getValidator(joinedKey);
          if (valueValidator(value)) return value as GetValueFromNestedKey<T, K>;
          return undefined;
        };
        return typedGet;
      } else if (prop === "del") {
        const typedDel: TypedNested<T>["del"] = async (...args) => {
          const [key] = args;
          const joinedKey = typeof key === "string" ? key : joinKey(key);
          if (!supportedKey(key))
            throw new Error(`Unsupported key ${joinedKey}.`);

          return target.del(key);
        };
        return typedDel;
      } else if (prop === "all") {
        const typedAll: TypedNested<T>["all"] = async () => {
          const jsonValue = await db.all();
          if (rootValidator(toObject(jsonValue))) {
            return jsonValue as unknown as NestedObjectToMap<T>;
          }
          throw new Error(JSON.stringify(rootValidator.errors, undefined, 2));
        };
        return typedAll;
      } else if (prop === "set" || prop === "put") {

        const typedPut = async <K extends ExtractKeys<T> | ExtractKeysAsList<T> | RecursivePartial<T>>(
          keyOrValue: K,
          value?: K extends ExtractKeys<T> ? GetValueFromKey<T, K> : K extends ExtractKeysAsList<T> ? GetValueFromKeyList<T, K> : undefined,
          position?: K extends ExtractKeys<T> | ExtractKeysAsList<T> ? number | undefined : undefined,
        ): Promise<string[]> => {
 
          if (typeof keyOrValue === "string" || Array.isArray(keyOrValue)) {
            // @ts-expect-error types in progress
            const data = isNestedValueObject(value) ? removeUndefinedProperties(value) : value;

            const joinedKey = asJoinedKey(keyOrValue) as ExtractKeys<T> ;

            if (!supportedKey(joinedKey))
              throw new Error(`Unsupported key ${joinedKey}.`);

            const valueValidator = getValidator(joinedKey)

            if (valueValidator(data)) {
              return await target.put(joinedKey, data as unknown as NoUndefinedField<T>, position)
            } else{
              throw new Error(
                JSON.stringify(valueValidator.errors, undefined, 2)
              )
            };
          } else {
            // @ts-expect-error types in progress
            const data = removeUndefinedProperties(keyOrValue);

            if (rootValidator(data)) {
              return await db.put(data as unknown as NoUndefinedField<T>);
            } else {
              const firstError = rootValidator.errors?.[0];
              // Provide better error message
              if (
                firstError?.message?.includes(
                  "must NOT have additional properties",
                )
              ) {
                throw new Error(
                  `Unsupported key ${firstError.instancePath.replace(/^\//, "")}/${firstError.params.additionalProperty}.`,
                );
              }
              throw new Error(
                JSON.stringify(rootValidator.errors, undefined, 2),
              );
            }
          }
        };
        return typedPut;
      }

      return target[prop as keyof typeof target];
    },
  }) as unknown as TypedNested<T>;
};
