import type { JSONSchemaType } from "ajv";
import type { NestedDatabaseType, NestedValue } from "@orbitdb/nested-db";

import { Path, PathValue, RecursivePartial } from "./types.js";

export type TypedNested<T extends NestedValue> = Omit<
  NestedDatabaseType,
  "put" | "set" | "del" | "get" | "all"
> & {
  put<K extends Path<T>>(key: K, value: PathValue<T, K>): Promise<string>;
  set: TypedNested<T>["put"];
  putNested<K extends Path<T>>(value: PathValue<T, K>): Promise<string[]>;
  del<K extends Path<T>>(key: K): Promise<string>;
  get<K extends Path<T>>(key: K): Promise<PathValue<T, K> | undefined>;
  all: () => Promise<
    {
      key: Extract<keyof T, "string">;
      value: T[keyof T];
      hash: string;
    }[]
  >;
  allAsJSON(): Promise<T>;
};

export const typedNested = <T extends NestedValue>({
  db,
  _schema,  // TODO
}: {
  db: NestedDatabaseType;
  _schema: JSONSchemaType<RecursivePartial<T>>;
}): TypedNested<T> => {
  return db as unknown as TypedNested<T>;
};
