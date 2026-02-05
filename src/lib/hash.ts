export function hashBytes(data: ArrayLike<number>): string {
  let h = 0 >>> 0;
  for (let i = 0; i < data.length; i++) {
    h = (h * 31 + (data[i] & 0xff)) >>> 0;
  }
  return h.toString(16);
}
