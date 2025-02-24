import type { JSONSchemaType } from "ajv";
import type { FeedDatabaseType } from "@orbitdb/feed-db";

import type { DBElements } from "./types";
import { generateListValidator, removeUndefinedProperties } from "./utils.js";

export type TypedFeed<T extends DBElements> = Omit<
  FeedDatabaseType,
  "add" | "all"
> & {
  add: (value: T) => Promise<string>;
  all: () => Promise<
    {
      value: T;
      hash: string;
    }[]
  >;
};

export const typedFeed = <T extends DBElements>({
  db,
  schema,
}: {
  db: FeedDatabaseType;
  schema: JSONSchemaType<T>;
}): TypedFeed<T> => {
  const { validate } = generateListValidator(schema);

  return new Proxy(db, {
    get(target, prop) {
      if (prop === "all") {
        return async (): Promise<{ value: T; hash: string }[]> => {
          const all = await target[prop]();
          const valid = all.filter((x) => validate(x.value)) as {
            value: T;
            hash: string;
          }[];
          return valid;
        };
      } else if (prop === "add") {
        return async (data: T): Promise<string> => {
          if (typeof data === "object" && !Array.isArray(data)) {
            data = removeUndefinedProperties(data) as T;
          }

          const valid = validate(data);
          if (valid) {
            return await target.add(data);
          }
          throw new Error(
            JSON.stringify(data) +
              JSON.stringify(validate.errors, undefined, 2),
          );
        };
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as TypedFeed<T>;
};
