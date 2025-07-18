import { RecursivePartial } from "@/types";
import { DatabaseFromApiGenerator } from "@constl/multi-db/dist/types";
import { BaseDatabase, InternalDatabase } from "@orbitdb/core";
import { JSONSchemaType } from "ajv";

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
export type BaseDagCborEncodable =
  | number
  | string
  | boolean
  | null
  | BaseDagCborEncodable[];
export type MultiStructure<T extends DbTypes> = {
  [key: string]:
    | BaseDagCborEncodable
    | DatabaseFromApiGenerator<T[keyof T]>
    | MultiStructure<T>;
};

export type MultiSchema<
  S extends MultiStructure<T>,
  T extends DbTypes,
> = JSONSchemaType<RecursivePartial<MultiStructureWithoutSubDbs<S, T>>>;

export type MultiStructureWithoutSubDbs<
  T extends MultiStructure<D>,
  D extends DbTypes,
> = {
  [K in keyof T as T[K] extends BaseDatabase
    ? never
    : K]: T[K] extends MultiStructure<D>
    ? MultiStructureWithoutSubDbs<T[K], D>
    : T[K];
};
export type MultiStructureValue<
  T extends MultiStructure<D>,
  D extends DbTypes,
> = {
  [K in keyof T]: T[K] extends BaseDatabase
    ? AllReturnValue<T[K]>
    : T[K] extends MultiStructure<D>
      ? MultiStructureValue<T[K], D>
      : T[K];
};

export type GetValueFromMultiStructureKey<
  T,
  P extends ExtractMultiStructureKeys<T>,
> = P extends `${infer Key}/${infer Rest}`
  ? Key extends keyof T
    ? Rest extends ExtractMultiStructureKeys<T[Key]>
      ? GetValueFromMultiStructureKey<T[Key], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never;

export type GetValueFromMultiStructureKeyList<T, P extends ExtractMultiStructureKeysAsList<T>> = P extends [
  infer Key,
  ...infer Rest,
]
  ? Key extends keyof T
    ? Rest extends ExtractMultiStructureKeysAsList<T[Key]>
      ? GetValueFromMultiStructureKeyList<T[Key], Rest>
      : T[Key]
    : never
  : never;

export type ExtractMultiStructureSubDbs<
  T extends MultiStructure<D>,
  D extends DbTypes,
> = {
  [K in ExtractMultiStructureKeys<T> as GetValueFromMultiStructureKey<
    T,
    K
  > extends BaseDatabase
    ? K
    : never]: T[K];
};

export type MultiStrucureToJsonSchema<
  S extends MultiStructure<T>,
  T extends DbTypes,
> = JSONSchemaType<MultiStructureWithoutSubDbs<S, T>>;

export type ExtractMultiStructureKeys<T> = T extends object
  ? {
      [K in keyof T & string]:
        | K
        | (T[K] extends object
            ? (T[K] extends BaseDatabase ? never : `${K}/${ExtractMultiStructureKeys<T[K]>}`)
            : K);
    }[keyof T & string]
  : never;

export type ExtractMultiStructureKeysAsList<T> = T extends object
  ? {
      [K in keyof T & string]:
        | [K]
        | (T[K] extends object
            ? (T[K] extends BaseDatabase ? never : [K, ...ExtractMultiStructureKeysAsList<T[K]>])
            : [K]);
    }[keyof T & string]
  : never;