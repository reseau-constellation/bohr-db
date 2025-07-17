export type DBElements =
  | number
  | boolean
  | string
  | { [key: string]: DBElements }
  | Array<DBElements>;

export type DBElementsWithUndefined =
  | number
  | boolean
  | string
  | { [clef: string]: DBElements }
  | Array<DBElements>
  | undefined;

export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object | undefined
      ? RecursivePartial<T[P]>
      : T[P];
};

// Alternative: https://www.typescriptlang.org/play/?ssl=26&ssc=1&pln=1&pc=1#code/FAFwngDgpgBACgQxACwJIFsIBsA8AVAGhgGkowYoAPEKAOwBMBnGAazIHsAzGPAPhgC8wGCTIVqdJjEYgATgEtaAc2EwA-DwDapMAF1xNBswBKUAMbtZ9HDIXKiCWmF6qRGgD4wABgBIA3joAvgB0-ogoGNj42mS6RACilGZYAK70UDhsYFxaOnGsHNyOYJq6vPwAZNJyikqBXq4iMJ6+AWQh-onJaRlZOXgxekR9RU6lldV2dQ1NMABcMLRQAG5QsqoLS6uyANzAoJCw4WiYWABM+PwC8EgnUYQF2dx8zY-9ewfQNyiXgt9351+VEMUlstVeIx46n+kUBLwWkLwH3AX2OADUEKkMg84AZJMxjpcrqpccD8d5-IpOGtRGAOn4qTTTDJ6qoNDo8UY3s9GhpmSBOVJCQM8i5Zm5-hisdE8kR+WLxZsVmtGkrtht4ILmIjeVo4LpVYtlbt9ulkghZLBOClaGYQPJ2LQYEooCB8ERSRIucLygAKdgAIwAVgsHhBbgs4ABKSO3KUpbEe3gfCy0GQwQNB8wC65+VSceSyGQAOQQ6CgCwARAAReRQJTsSsEVRYBAlssVmCVgASCAAXk3VAgXQs-GAoBbGAsAMwABkCzZEEFk7CzdqnME0jT8iw7VdMCBY8hATZgqZqAZSIEsG4AbAAOGAL7e78tVgDCjpkSCgp-PCkva8iwWABGM4n0XGADUCGA2zPL8QA+F0QH9YNsyISthygYJx0nSsox2IA
// https://alexop.dev/posts/typescript-extract-all-keys-nested-objects/
export type ExtractKeys<T> = T extends object
  ? {
      [K in keyof T & string]:
        | K
        | (T[K] extends object ? `${K}/${ExtractKeys<T[K]>}` : K);
    }[keyof T & string]
  : never;

export type ExtractKeysAsList<T> = T extends object
  ? {
      [K in keyof T & string]:
        | [K]
        | (T[K] extends object ? [K, ...ExtractKeysAsList<T[K]>] : [K]);
    }[keyof T & string]
  : never;

export type GetValueFromKey<
  T,
  P extends ExtractKeys<T>,
> = P extends `${infer Key}/${infer Rest}`
  ? Key extends keyof T
    ? Rest extends ExtractKeys<T[Key]>
      ? GetValueFromKey<T[Key], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never;

export type GetValueFromKeyList<T, P extends ExtractKeysAsList<T>> = P extends [
  infer Key,
  ...infer Rest,
]
  ? Key extends keyof T
    ? Rest extends ExtractKeysAsList<T[Key]>
      ? GetValueFromKeyList<T[Key], Rest>
      : T[Key]
    : never
  : never;

export type GetValueFromNestedKey<T, K extends (ExtractKeysAsList<T> | ExtractKeys<T>)> = (K extends ExtractKeys<T> ? GetValueFromKey<T, K> : K extends ExtractKeysAsList<T> ?GetValueFromKeyList<T, K> : never);