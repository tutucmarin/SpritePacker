export function applyPattern(pattern: string | undefined, vars: Record<string, string | number | undefined>) {
  const p = (pattern || "").trim();
  if (!p) return (vars.name || `item-${vars.index || 1}`).toString();
  return p
    .replace(/\{index\}/gi, String(vars.index ?? ""))
    .replace(/\{row\}/gi, String(vars.row ?? ""))
    .replace(/\{col\}/gi, String(vars.col ?? ""))
    .replace(/\{name\}/gi, String(vars.name ?? "").trim())
    .replace(/[^a-zA-Z0-9_\-.]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
