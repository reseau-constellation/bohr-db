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
  all: () => Promise<Set<T>>;
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
        const wrappedAll: TypedSet<T>["all"] = async () => {
          const allValues = await target.all();
          const valids = [...allValues].filter((x) => validate(x)) as T[];
          return new Set(valids);
        };
        return wrappedAll
      } else if (prop === "add") {
        const wrappedAdd: TypedSet<T>["add"] = async (data) => {
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
        return wrappedAdd;
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as  unknown as TypedSet<T>;
};
