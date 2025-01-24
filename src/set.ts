import { type JSONSchemaType } from "ajv";
import { SetDatabaseType } from "@orbitdb/set-db";

import { DBElements } from "@/types";
import { generateListValidator } from "@/utils.js";

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
          const tous = await target[prop]();
          const valides = tous.filter((x) => validate(x.value)) as {
            value: T;
            hash: string;
          }[];
          return valides;
        };
      } else if (prop === "add") {
        return async (data: T): Promise<string> => {
          const valid = validate(data);
          if (valid) {
            return await target.add(data);
          }
          throw new Error(
            JSON.stringify(data) + JSON.stringify(validate.errors, undefined, 2),
          );
        };
      } else {
        return target[prop as keyof typeof target];
      }
    },
  }) as TypedSet<T>;
};
