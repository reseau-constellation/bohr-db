/*import { Ajv, ValidateFunction, type JSONSchemaType } from "ajv";
import {
  joinKey,
  splitKey,
  NestedObjectToMap,
  NestedValueObject,
  NestedDatabaseType,
  toObject
} from "@orbitdb/nested-db";
import type {MultiDatabaseType} from "@constl/multi-db";

import {
  ExtractKeys,
  ExtractKeysAsList,
  GetValueFromKey,
  GetValueFromKeyList,
  GetValueFromNestedKey,
  RecursivePartial,
} from "./types.js";
import { NoUndefinedField, getJoinedKey, removeUndefinedProperties } from "./utils.js";
import { BaseDatabase, DagCborEncodable, InternalDatabase } from "@orbitdb/core";

// TODO : import from MultiDB
export type DatabaseApiGenerator<T extends BaseDatabase = BaseDatabase> =
  (args: { database: BaseDatabase }) => DatabaseApi<T>;
export type DatabaseApi<T extends BaseDatabase = BaseDatabase> = Omit<
  T,
  Exclude<keyof InternalDatabase, "all"> | "type"
>;
export type DatabaseFromApi<T extends DatabaseApi> =
  T extends DatabaseApi<infer D> ? D : never;
export type DbTypes = {
  [key: string]: DatabaseApiGenerator;
};

export type AllReturnValue<T extends BaseDatabase> = Awaited<
  ReturnType<T["all"]>
>;
// End TODO

export type MultiStructure<S extends NestedValueObject> = {
    [key: string]: DagCborEncodable | NestedValueObject;
};

export type MultiSchema<T> = JSONSchemaType<T>

export type MultiStructureWithoutSubDbs<T extends MultiSchema> = {
  [K in keyof T] -?: T[K] extends BaseDatabase ? never: T[K]
}

export type MultiStrucureToJsonSchema<T extends MultiSchema> = JSONSchemaType<MultiStructureWithoutSubDbs<T>>;


export type TypedMulti<T extends MultiSchema> = Omit<
  MultiDatabaseType,
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
  set: TypedMulti<T, M>["put"];

  putNested(value: RecursivePartial<T>): Promise<string[]>;
  putNested<K extends ExtractKeys<T>>(
    key: K,
    value: RecursivePartial<GetValueFromKey<T, K>>,
  ): Promise<string[]>;
  setNested: TypedMulti<T, M>["putNested"];

  del<K extends ExtractKeys<T> | ExtractKeysAsList<T>>(key: K): Promise<string>;

  get<K extends ExtractKeys<T>>(
    key: K,
  ): Promise<GetValueFromKey<T, K> | undefined>;
  get<K extends ExtractKeysAsList<T>>(
    key: K,
  ): Promise<GetValueFromKeyList<T, K> | undefined>;

  subDb(): Promise;

  all: () => Promise<NestedObjectToMap<T>>;
};

export const typedMulti = <T extends NestedValueObject>({
  db,
  schema,
}: {
  db: MultiDatabaseType;
  schema: JSONSchemaType<RecursivePartial<T>>;
}): TypedMulti<T> => {}
*/