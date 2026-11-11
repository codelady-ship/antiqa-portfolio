/**
 * Failed-login limiter. A login first RESERVES a slot on each of its keys atomically
 * (so a burst of parallel requests cannot all pass a read-only check), a successful
 * login gives the slots back, a failed one keeps them until the window expires.
 */
export interface LimitStore {
  /** atomically add 1 if the counter is below max; false = blocked */
  reserve(key: string, max: number): Promise<boolean>;
  /** give one slot back */
  release(key: string): Promise<void>;
  /** forget the key */
  reset(key: string): Promise<void>;
}

export type Limit = readonly [key: string, max: number];

/** Reserve all limits or none. */
export async function reserveAll(store: LimitStore, limits: readonly Limit[]) {
  const taken: string[] = [];
  for (const [key, max] of limits) {
    if (!(await store.reserve(key, max))) {
      await Promise.all(taken.map((k) => store.release(k)));
      return false;
    }
    taken.push(key);
  }
  return true;
}

/** In-memory store with the same semantics, for tests. */
export function memoryStore(): LimitStore & { n: Map<string, number> } {
  const n = new Map<string, number>();
  return {
    n,
    async reserve(key, max) {
      await Promise.resolve(); // behave like an async store
      const v = n.get(key) ?? 0;
      if (v >= max) return false;
      n.set(key, v + 1);
      return true;
    },
    async release(key) {
      const v = n.get(key) ?? 0;
      if (v > 0) n.set(key, v - 1);
    },
    async reset(key) {
      n.delete(key);
    },
  };
}
