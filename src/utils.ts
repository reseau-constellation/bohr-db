import Ajv, { JSONSchemaType, ValidateFunction } from "ajv";

import type { DBElements, ExtractKeys, ExtractKeysAsList } from "./types";
import { DagCborEncodable } from "@orbitdb/core";
import { CID } from "multiformats/cid";
import { NestedValue, joinKey } from "@orbitdb/nested-db";

const ajv = new Ajv({ allowUnionTypes: true });

export const generateListValidator = <T extends DBElements>(
  schema: JSONSchemaType<T>,
): { validate: ValidateFunction<T> } => {
  const validate = ajv.compile(schema);
  return {
    validate,
  };
};
export const generateDictValidator = <T extends { [clef: string]: DBElements }>(
  schema: JSONSchemaType<Partial<T>>,
): {
  validateRoot: ValidateFunction<Partial<T>>;
  getKeyValidator: <K extends keyof T>(key: K) => ValidateFunction<T[K]>;
  validateKey: <K extends keyof T>(v: unknown, key: K) => v is T[K];
  supportedKey: <K extends string>(key: K) => boolean;
} => {
  const validateRoot = ajv.compile<Partial<T>>(schema);

  const compileKeySchema = (
    s: JSONSchemaType<T[keyof T]> | JSONSchemaType<T[keyof T]>["properties"],
  ) => {
    // Apparently necessary to avoid AJV error if `nullable: true` and value is `undefined`
    if (s === true) {
      return () => true;
    }
    return ajv.compile(s);
  };
  const validators = Object.fromEntries(
    (
      Object.entries(schema.properties || {}) as [
        keyof T,
        JSONSchemaType<T[keyof T]>,
      ][]
    ).map(([c, p]) => [c, compileKeySchema(p)]),
  ) as { [clef in keyof T]: ValidateFunction<T[clef]> };

  const validateAdditionalProperties = schema.additionalProperties
    ? compileKeySchema(schema.additionalProperties)
    : () => false;

  const validateKey = <K extends keyof T>(v: unknown, key: K): v is T[K] => {
    const vld = getKeyValidator(key);
    return vld(v);
  };

  const getKeyValidator = <K extends keyof T>(key: K) => {
    return validators[key] || validateAdditionalProperties;
  };

  const supportedKey = (key: string): boolean => {
    return !!validators[key] || !!schema.additionalProperties;
  };

  return {
    validateRoot,
    validateKey,
    getKeyValidator,
    supportedKey,
  };
};

type NoUndefinedField<T> = {
  [P in keyof T]-?: NonNullable<T[P]>;
};

export const removeUndefinedProperties = <
  T extends { [clef: string]: DagCborEncodable | undefined },
>(
  objet: T,
): NoUndefinedField<T> => {
  return Object.fromEntries(
    Object.entries(objet)
      .filter(([_clef, val]) => val !== undefined)
      .map(([clef, val]): [string, DBElements] => {
        return [
          clef,
          typeof val === "object" &&
          !Array.isArray(val) &&
          !(val instanceof CID)
            ? removeUndefinedProperties(val as NestedValue)
            : val!,
        ] as [string, DBElements];
      }),
  ) as NoUndefinedField<T>;
};

export const getJoinedKey = <T extends NestedValue>(
  key: ExtractKeysAsList<T>,
): ExtractKeys<T> => {
  return joinKey(key) as ExtractKeys<T>;
};
