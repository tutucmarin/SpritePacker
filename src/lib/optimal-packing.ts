type SizedItem = {
  w: number;
  h: number;
};

export type OptimalPlacement<T> = {
  item: T;
  index: number;
  x: number;
  y: number;
};

export type OptimalShelfPacking<T> = {
  placements: OptimalPlacement<T>[];
  w: number;
  h: number;
};

type IndexedItem<T> = {
  item: T;
  index: number;
};

type PackingCandidate<T> = {
  order: IndexedItem<T>[];
  capacity: number;
  w: number;
  h: number;
  area: number;
  aspect: number;
};

// A slightly larger atlas is worthwhile when it removes a pathological strip.
// These bounds keep area as the main constraint instead of allowing an
// arbitrarily large square layout to win on aspect ratio alone.
const MAX_PRACTICAL_AREA_OVERHEAD = 1.5;
const SIMILAR_AREA_OVERHEAD = 1.15;
const PRACTICAL_ASPECT_RATIO = 2.5;
const EXHAUSTIVE_ITEM_LIMIT = 128;
const SAMPLED_WIDTH_COUNT = 512;

/**
 * Finds a compact shelf packing by trying multiple item orders and shelf
 * widths. Candidate generation begins at sqrt(total sprite area), then adds
 * every meaningful contiguous shelf width for ordinary-sized inputs.
 */
export function findOptimalShelfPacking<T extends SizedItem>(
  items: T[],
  spacing = 0,
  targetWidth?: number | null,
): OptimalShelfPacking<T> | null {
  if (!items.length) return null;

  const pad = Math.max(0, spacing);
  const indexed = items.map((item, index) => ({ item, index }));
  const orders = createOrders(indexed);
  const candidates: PackingCandidate<T>[] = [];

  for (const order of orders) {
    const widths = createCandidateWidths(order, pad, targetWidth);
    for (const width of widths) {
      const measured = measureShelf(order, pad, width);
      const area = measured.w * measured.h;
      candidates.push({
        order,
        capacity: width,
        ...measured,
        area,
        aspect: aspectRatio(measured.w, measured.h),
      });
    }
  }

  if (!candidates.length) return null;

  const minimumArea = Math.min(...candidates.map((candidate) => candidate.area));
  const reasonablySized = candidates.filter(
    (candidate) =>
      candidate.area <= minimumArea * MAX_PRACTICAL_AREA_OVERHEAD,
  );
  const bestAvailableAspect = Math.min(
    ...reasonablySized.map((candidate) => candidate.aspect),
  );
  const practicalAspectLimit = Math.max(
    PRACTICAL_ASPECT_RATIO,
    bestAvailableAspect * 1.1,
  );
  const practical = reasonablySized.filter(
    (candidate) => candidate.aspect <= practicalAspectLimit,
  );
  const minimumPracticalArea = Math.min(
    ...practical.map((candidate) => candidate.area),
  );

  // Within a narrow area band, prefer the result closest to square. This is
  // what turns equal sprites into a compact grid rather than a 1 x N strip.
  const finalists = practical.filter(
    (candidate) =>
      candidate.area <= minimumPracticalArea * SIMILAR_AREA_OVERHEAD,
  );
  finalists.sort(compareCandidates);

  const winner = finalists[0];
  return packShelf(winner.order, pad, winner.capacity);
}

function createOrders<T extends SizedItem>(
  indexed: IndexedItem<T>[],
): IndexedItem<T>[][] {
  const comparators: ((a: IndexedItem<T>, b: IndexedItem<T>) => number)[] = [
    (a, b) =>
      b.item.h - a.item.h || b.item.w - a.item.w || a.index - b.index,
    (a, b) =>
      b.item.w * b.item.h - a.item.w * a.item.h ||
      Math.max(b.item.w, b.item.h) - Math.max(a.item.w, a.item.h) ||
      a.index - b.index,
    (a, b) =>
      Math.max(b.item.w, b.item.h) - Math.max(a.item.w, a.item.h) ||
      b.item.w * b.item.h - a.item.w * a.item.h ||
      a.index - b.index,
    (a, b) =>
      b.item.w - a.item.w || b.item.h - a.item.h || a.index - b.index,
  ];
  const seen = new Set<string>();
  const orders: IndexedItem<T>[][] = [];

  for (const comparator of comparators) {
    const order = [...indexed].sort(comparator);
    const signature = order.map(({ index }) => index).join(",");
    if (seen.has(signature)) continue;
    seen.add(signature);
    orders.push(order);
  }
  return orders;
}

function createCandidateWidths<T extends SizedItem>(
  order: IndexedItem<T>[],
  pad: number,
  targetWidth?: number | null,
): number[] {
  const minWidth = Math.max(...order.map(({ item }) => item.w));
  const totalArea = order.reduce(
    (sum, { item }) => sum + item.w * item.h,
    0,
  );
  const maximumWidth = order.reduce(
    (sum, { item }, index) => sum + item.w + (index > 0 ? pad : 0),
    0,
  );
  const squareStart = Math.max(minWidth, Math.ceil(Math.sqrt(totalArea)));
  const widths = new Set<number>([minWidth, squareStart, maximumWidth]);

  if (targetWidth && targetWidth > 0) {
    widths.add(Math.max(minWidth, Math.round(targetWidth)));
  }

  if (order.length <= EXHAUSTIVE_ITEM_LIMIT) {
    // A shelf in a fixed ordering is always a contiguous run. Trying all run
    // widths covers its meaningful wrap points and works well for mixed sizes.
    for (let start = 0; start < order.length; start += 1) {
      let width = 0;
      for (let end = start; end < order.length; end += 1) {
        width += order[end].item.w + (end > start ? pad : 0);
        widths.add(Math.max(minWidth, width));
      }
    }
  } else {
    // Keep very large imports responsive while still surveying the full range.
    for (let index = 0; index <= SAMPLED_WIDTH_COUNT; index += 1) {
      const ratio = index / SAMPLED_WIDTH_COUNT;
      widths.add(
        Math.round(minWidth + (maximumWidth - minWidth) * ratio),
      );
    }
    let prefixWidth = 0;
    for (let index = 0; index < order.length; index += 1) {
      prefixWidth += order[index].item.w + (index > 0 ? pad : 0);
      widths.add(Math.max(minWidth, prefixWidth));
    }
  }

  // Survey densely around the square-root starting point even when the input
  // is large enough to use sampled candidate generation.
  for (let percent = 50; percent <= 200; percent += 2) {
    widths.add(
      Math.min(
        maximumWidth,
        Math.max(minWidth, Math.round(squareStart * (percent / 100))),
      ),
    );
  }

  return [...widths]
    .filter((width) => width >= minWidth && width <= maximumWidth)
    .sort((a, b) => {
      const distanceA = Math.abs(a - squareStart);
      const distanceB = Math.abs(b - squareStart);
      return distanceA - distanceB || a - b;
    });
}

function packShelf<T extends SizedItem>(
  order: IndexedItem<T>[],
  pad: number,
  capacity: number,
): OptimalShelfPacking<T> {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let usedWidth = 0;
  const placements: OptimalPlacement<T>[] = [];

  for (const { item, index } of order) {
    if (x > 0 && x + item.w > capacity) {
      x = 0;
      y += rowHeight + pad;
      rowHeight = 0;
    }
    placements.push({ item, index, x, y });
    x += item.w + pad;
    rowHeight = Math.max(rowHeight, item.h);
    usedWidth = Math.max(usedWidth, x - pad);
  }

  return {
    placements,
    w: usedWidth,
    h: y + rowHeight,
  };
}

function measureShelf<T extends SizedItem>(
  order: IndexedItem<T>[],
  pad: number,
  capacity: number,
): { w: number; h: number } {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let usedWidth = 0;

  for (const { item } of order) {
    if (x > 0 && x + item.w > capacity) {
      x = 0;
      y += rowHeight + pad;
      rowHeight = 0;
    }
    x += item.w + pad;
    rowHeight = Math.max(rowHeight, item.h);
    usedWidth = Math.max(usedWidth, x - pad);
  }

  return { w: usedWidth, h: y + rowHeight };
}

function aspectRatio(w: number, h: number): number {
  const shorterSide = Math.max(1, Math.min(w, h));
  return Math.max(w, h) / shorterSide;
}

function compareCandidates<T>(
  a: PackingCandidate<T>,
  b: PackingCandidate<T>,
): number {
  return (
    a.aspect - b.aspect ||
    a.area - b.area ||
    Math.max(a.w, a.h) - Math.max(b.w, b.h) ||
    a.w - b.w
  );
}
