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
