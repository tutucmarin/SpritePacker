export type OrderMode = "row" | "x";

export interface ComponentBox {
  id?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
}

export interface GridSettings {
  cols: number;
  rows: number;
  offx: number;
  offy: number;
  gapx: number;
  gapy: number;
}
