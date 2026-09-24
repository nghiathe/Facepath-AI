/**
 * Bổ sung op "all" (AND nhiều điều kiện) cho rules engine — dùng cho luật brow_kiem.
 * Ghép vào hàm matchRule hiện có: nếu rule.op === 'all' thì gọi matchAll.
 * Accessor chưa có (undefined) → điều kiện coi như không khớp, giống cách engine bỏ qua feature_key lạ.
 */
export interface Cond { feature_key: string; op: 'gt' | 'gte' | 'lt' | 'lte' | 'between'; v_min?: number; v_max?: number }

export function matchCond(v: number | undefined, c: Cond): boolean {
  if (v === undefined || !Number.isFinite(v)) return false;
  switch (c.op) {
    case 'gt': return v > (c.v_min as number);
    case 'gte': return v >= (c.v_min as number);
    case 'lt': return v < (c.v_max as number);
    case 'lte': return v <= (c.v_max as number);
    case 'between': return v >= (c.v_min as number) && v <= (c.v_max as number);
  }
}

export function matchAll(get: (key: string) => number | undefined, conds: Cond[]): boolean {
  return conds.length > 0 && conds.every(c => matchCond(get(c.feature_key), c));
}
