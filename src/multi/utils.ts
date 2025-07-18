import { MultiStructure, DbTypes, MultiSchema, ExtractMultiStructureKeys, MultiStructureValue } from "./types";

const joinRoot = <K extends string, R extends string | undefined, T extends  R extends string ? `${R}/${K}` : K>(key: K, root: R): T => {
  return (typeof root === "string" ? `${root}/${key}` : key) as  T;
}
export const extractMultiSchemaKeys = <S extends MultiStructure<T>, T extends DbTypes>(schema: MultiSchema<S, T>): ExtractMultiStructureKeys<MultiStructure<T>>[] => {
    const recursiveExtract = <U extends MultiStructure<T>>(x: MultiSchema<U, T>, root?: string): ExtractMultiStructureKeys<MultiStructure<T>>[] => {
      const keys: string[] = [];
      if (x.type !== "object") return keys;
      for (const [key, value] of Object.entries(x.properties || {})) {
        const rootedKey = joinRoot(key, root);
        keys.push(rootedKey);
        if (typeof value === "object" && value !== null)
            keys.push(...recursiveExtract(value, rootedKey))
      }
      return keys
    }
    
    return recursiveExtract(schema)
  }
  
  export const validateMultiValue = <
    T extends MultiStructure<D>,
    D extends DbTypes,
  >(
    value: MultiStructureValue<MultiStructure<D>, D>,
    schema: MultiSchema<T, D>,
  ): value is MultiStructureValue<T, D> => {
    const { jsonSchema, subDbSchemas } = extractSchemas(schema);
    const { jsonValue, subDbValues } = extractValues(value);
    
  };