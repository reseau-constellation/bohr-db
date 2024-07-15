import Ajv, { JSONSchemaType, ValidateFunction } from "ajv";

import type { DBElements } from "./types";

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
  const validateRoot = ajv.compile(schema) as ValidateFunction<Partial<T>>;

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
