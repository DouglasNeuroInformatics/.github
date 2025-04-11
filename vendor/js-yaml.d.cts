export function load(str: string, opts?: LoadOptions): unknown;

export class Type {
  constructor(tag: string, opts?: TypeConstructorOptions);
  kind: 'sequence' | 'scalar' | 'mapping' | null;
  resolve(data: any): boolean;
  construct(data: any, type?: string): any;
  instanceOf: object | null;
  predicate: ((data: object) => boolean) | null;
  represent: ((data: object) => any) | { [x: string]: (data: object) => any } | null;
  representName: ((data: object) => any) | null;
  defaultStyle: string | null;
  multi: boolean;
  styleAliases: { [x: string]: any };
}

export class Schema {
  constructor(definition: SchemaDefinition | Type[] | Type);
  extend(types: SchemaDefinition | Type[] | Type): Schema;
}

export function loadAll(str: string, iterator?: null, opts?: LoadOptions): unknown[];
export function loadAll(str: string, iterator: (doc: unknown) => void, opts?: LoadOptions): void;

export function dump(obj: any, opts?: DumpOptions): string;

export interface LoadOptions {
  filename?: string | undefined;
  onWarning?(this: null, e: YAMLException): void;
  schema?: Schema | undefined;
  json?: boolean | undefined;
  listener?(this: State, eventType: EventType, state: State): void;
}

export type EventType = 'open' | 'close';

export interface State {
  input: string;
  filename: string | null;
  schema: Schema;
  onWarning: (this: null, e: YAMLException) => void;
  json: boolean;
  length: number;
  position: number;
  line: number;
  lineStart: number;
  lineIndent: number;
  version: null | number;
  checkLineBreaks: boolean;
  kind: string;
  result: any;
  implicitTypes: Type[];
}

export interface DumpOptions {
  indent?: number | undefined;
  noArrayIndent?: boolean | undefined;
  skipInvalid?: boolean | undefined;
  flowLevel?: number | undefined;
  styles?: { [x: string]: any } | undefined;
  schema?: Schema | undefined;
  sortKeys?: boolean | ((a: any, b: any) => number) | undefined;
  lineWidth?: number | undefined;
  noRefs?: boolean | undefined;
  noCompatMode?: boolean | undefined;
  condenseFlow?: boolean | undefined;
  quotingType?: "'" | '"' | undefined;
  forceQuotes?: boolean | undefined;
  replacer?: ((key: string, value: any) => any) | undefined;
}

export interface TypeConstructorOptions {
  kind?: 'sequence' | 'scalar' | 'mapping' | undefined;
  resolve?: ((data: any) => boolean) | undefined;
  construct?: ((data: any, type?: string) => any) | undefined;
  instanceOf?: object | undefined;
  predicate?: ((data: object) => boolean) | undefined;
  represent?: ((data: object) => any) | { [x: string]: (data: object) => any } | undefined;
  representName?: ((data: object) => any) | undefined;
  defaultStyle?: string | undefined;
  multi?: boolean | undefined;
  styleAliases?: { [x: string]: any } | undefined;
}

export interface SchemaDefinition {
  implicit?: Type[] | undefined;
  explicit?: Type[] | undefined;
}

export let FAILSAFE_SCHEMA: Schema;
export let JSON_SCHEMA: Schema;
export let CORE_SCHEMA: Schema;
export let DEFAULT_SCHEMA: Schema;

export interface Mark {
  buffer: string;
  column: number;
  line: number;
  name: string;
  position: number;
  snippet: string;
}

export class YAMLException extends Error {
  constructor(reason?: string, mark?: Mark);
  toString(compact?: boolean): string;
  name: string;
  reason: string;
  message: string;
  mark: Mark;
}
