import { type JSONSchemaType } from "ajv";
import { SetDatabaseType } from "@orbitdb/set-db";

import { DBElements } from "@/types";
import { generateListValidator, removeUndefinedProperties } from "@/utils.js";

export type TypedSet<T extends DBElements> = Omit<
  SetDatabaseType,
  "add" | "del" | "all"
> & {
  add: (value: T) => Promise<string>;
  del: (value: T) => Promise<string>;
  all: () => Promise<
    {
      value: T;
      hash: string;
    }[]
  >;
};

export const typedSet = <T extends DBElements>({
  db,
  schema,
}: {
  db: SetDatabaseType;
  schema: JSONSchemaType<T>;
}): TypedSet<T> => {
  const { validate } = generateListValidator(schema);

  return new Proxy(db, {
    get(target, prop) {
      if (prop === "all") {
        return async (): Promise<{ value: T; hash: string }[]> => {
          const allValues = await target[prop]();
          const valids = allValues.filter((x) => validate(x.value)) as {
            value: T;
            hash: string;
          }[];
          return valids;
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
  }) as TypedSet<T>;
};
