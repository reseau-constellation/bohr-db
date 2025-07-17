import { NestedObjectToMap, NestedValueMap, NestedValueObject, toObject } from "@orbitdb/nested-db";

import { expect } from "aegir/chai";

export const expectNestedMapEqual = <T extends NestedValueObject>(
  map: NestedObjectToMap<T>,
  ref: NestedValueMap | NestedValueObject,
) => {
  // Check type
  expect(map instanceof Map).to.be.true();

  // Check structure
  const refAsObject = ref instanceof Map ? toObject(ref) : ref;
  expect(toObject(map as unknown as NestedValueMap)).to.deep.equal(refAsObject);

  // If `ref` is also a Map, check order of keys
  if (ref instanceof Map) {
    expect([...map.keys()]).to.deep.equal([...ref.keys()]);
    for (const key of ref.keys()) {
      const value = ref.get(key);
      if (value instanceof Map) {
        const mapBranch = map.get(key as Extract<keyof T, string>);
        expect(mapBranch).to.be.instanceOf(Map);
        // @ts-expect-error TODO
        expectNestedMapEqual(mapBranch, value);
      }
    }
  }
};
