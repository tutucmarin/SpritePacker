export type OrderMode = "row" | "x";

export interface ComponentBox {
  id?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
  rotated?: boolean;
  trimmed?: boolean;
  spriteSourceSize?: { x: number; y: number; w: number; h: number };
  sourceSize?: { w: number; h: number };
}

export interface GridSettings {
  cols: number;
  rows: number;
  offx: number;
  offy: number;
  gapx: number;
  gapy: number;
}
