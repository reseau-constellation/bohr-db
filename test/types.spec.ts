import { ExtractKeys, ExtractKeysAsList, GetValueFromKey, GetValueFromKeyList } from "@/types";

describe("Types", () => {
  type S = {
    a: string;
    b: { c: number; d: { e: boolean } };
    f: { g: { h: "i" } };
  };
  describe("Extract keys as list", () => {
    
    let _value: ExtractKeys<S>;
    it("Root key assignable", () => {
      _value = "a";
    });
    it("Nested key assignable", () => {
      _value = "b/d";
    });
    it("Deep nested key assignable", () => {
      _value = "f/g/h";
    });
    it("Error for list", () => {
      //@ts-expect-error list
      _value = ["a"];
    });
    it("Error for wrong order", () => {
      //@ts-expect-error wrong order
      _value = "f/h/g";
    });
    it("Error for wrong nested key", () => {
      //@ts-expect-error wrong key
      _value = "f/g/z";
    });
    it("Error for too deep", () => {
      //@ts-expect-error too long
      _value = "f/g/h/i";
    });
  });
  describe("Extract keys as list", () => {
    type S = {
      a: string;
      b: { c: number; d: { e: boolean } };
      f: { g: { h: "i" } };
    };
    let _value: ExtractKeysAsList<S>;
    it("Root key assignable", () => {
      _value = ["a"];
    });
    it("Nested key assignable", () => {
      _value = ["b", "d"];
    });
    it("Deep nested key assignable", () => {
      _value = ["f", "g", "h"];
    });
    it("Error for string", () => {
      //@ts-expect-error string
      _value = "a";
    });
    it("Error for wrong order", () => {
      //@ts-expect-error wrong order
      _value = ["f", "h", "g"];
    });
    it("Error for wrong nested key", () => {
      //@ts-expect-error wrogn key
      _value = ["f", "g", "z"];
    });
    it("Error for too deep", () => {
      //@ts-expect-error too long
      _value = ["f", "g", "h", "i"];
    });
  });
  describe("Get path value", () => {
    it("Root key", () => {
      let _value: GetValueFromKey<S, "a"> = "test";
      
      // @ts-expect-error wrong type
      _value = 1
    })
    it("Nested key", () => {
      let _value: GetValueFromKey<S, "b/c"> = 1;
      
      // @ts-expect-error wrong type
      _value = false
    })
    
    it("Nested key object value", () => {
      let _value: GetValueFromKey<S, "b/d"> = { e: true };
    
      // @ts-expect-error wrong type
      _value = {e: 1}
    })

    it("Incomplete object type", () => {
      let _value: GetValueFromKey<S, "b"> = { d: { e: false }, c: 2 };
      
      // @ts-expect-error incomplete type
      _value = { c: 1 };
    })

    it("Deep nested key", () => {
      let _value: GetValueFromKey<S, "b/d/e"> = true;
        
      // @ts-expect-error wrong type
      _value = 1;
    })
  });
  describe("Get path value from list", () => {
    it("Root key", () => {
      let _value: GetValueFromKeyList<S, ["a"]> = "test";
      
      // @ts-expect-error wrong type
      _value = 1
    })
    it("Nested key", () => {
      let _value: GetValueFromKeyList<S, ["b", "c"]> = 1;
      
      // @ts-expect-error wrong type
      _value = false
    })
    
    it("Nested key object value", () => {
      let _value: GetValueFromKeyList<S, ["b", "d"]> = { e: true };
    
      // @ts-expect-error wrong type
      _value = {e: 1}
    })

    it("Incomplete object type", () => {
      let _value: GetValueFromKeyList<S, ["b"]> = { d: { e: false }, c: 2 };
      
      // @ts-expect-error incomplete type
      _value = { c: 1 };
    })

    it("Deep nested key", () => {
      let _value: GetValueFromKeyList<S, ["b", "d", "e"]> = true;
        
      // @ts-expect-error wrong type
      _value = 1;
    })
  });
});
