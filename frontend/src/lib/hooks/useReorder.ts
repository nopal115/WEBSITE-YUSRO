import { useState } from 'react';

/**
 * Urutan lokal yang belum disimpan (SDD 3.5.4: disimpan sekaligus lewat satu permintaan reorder).
 * Selama belum diubah, urutan mengikuti data server; reset() kembali ke urutan server.
 */
export function useReorder<T>(source: T[], getId: (item: T) => string) {
  const [order, setOrder] = useState<string[] | null>(null);
  const byId = new Map(source.map((item) => [getId(item), item]));
  const items = order ? order.map((id) => byId.get(id)).filter((item): item is T => item !== undefined) : source;
  const sourceIds = source.map(getId);
  const dirty = order !== null && (order.length !== sourceIds.length || order.some((id, index) => id !== sourceIds[index]));

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const ids = items.map(getId);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    setOrder(ids);
  };

  return { items, dirty, move, reset: () => setOrder(null), orderedIds: items.map(getId) };
}
