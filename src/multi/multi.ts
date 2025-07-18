import type { MultiDatabaseType } from "@constl/multi-db";

import { DbTypes } from "@constl/multi-db/dist/types.js";
import { asJoinedKey } from "@orbitdb/nested-db";
import { MultiStructure, ExtractMultiStructureKeys, MultiStructureValue, MultiSchema } from "./types";
import { extractMultiSchemaKeys } from "./utils";



export type TypedMulti<T extends MultiStructure<D>, D extends DbTypes> = Omit<
  MultiDatabaseType,
  "put" | "set" | "del" | "get" | "all"
> & {
  set: TypedMulti<T, D>["put"];

  del<
    K extends ExtractMultiStructureKeys<T>,
  >(
    key: K,
  ): Promise<string>;

  all: () => Promise<MultiStructureValue<T, D>>;
};

export const typedMulti = <T extends MultiStructure<D>, D extends DbTypes>({
  db,
  schema,
}: {
  db: MultiDatabaseType;
  schema: MultiSchema<T, D>;
}): TypedMulti<T, D> => {
  const supportedKeys = extractMultiSchemaKeys(schema);

  return new Proxy(db, {
    get(target, prop) {
      if (prop === "del") {
        const typedDel: TypedMulti<T, D>["del"] = async (...args) => {
          const [key] = args;
          const joinedKey = asJoinedKey(key);
          if (!supportedKeys.includes(joinedKey))
            throw new Error(`Unsupported key ${joinedKey}.`);

          return target.del(key);
        };
        return typedDel;
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as unknown as TypedMulti<T, D>;
};
