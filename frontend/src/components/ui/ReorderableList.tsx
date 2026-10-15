import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Button } from './Button';

interface ReorderableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  /** Nama butir untuk label tombol dan pengumuman, mis. "Huruf Ba". */
  getLabel: (item: T) => string;
  onMove: (from: number, to: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
  /** Nonaktifkan pengurutan (mis. saat menyimpan). */
  disabled?: boolean;
  /** Nama daftar untuk pembaca layar. */
  label: string;
}

/**
 * Daftar yang bisa diurutkan (SDD 7.11): seret-lepas bawaan browser (HTML Drag and Drop API) lewat
 * pegangan, ditambah tombol Naik/Turun untuk papan ketik dan layar sentuh. Perpindahan diumumkan lewat
 * aria-live. Tombol tetap terfokus pada butir yang sama setelah dipindah.
 */
export function ReorderableList<T>({ items, getId, getLabel, onMove, renderItem, disabled = false, label }: ReorderableListProps<T>): JSX.Element {
  const [announcement, setAnnouncement] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const pendingFocus = useRef<{ id: string; direction: 'up' | 'down' } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    onMove(from, to);
    setAnnouncement(`${getLabel(items[from])} dipindah ke posisi ${to + 1} dari ${items.length}.`);
  };

  // Fokus dikembalikan ke tombol butir yang dipindah; di ujung daftar, ke tombol arah sebaliknya.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target || !listRef.current) return;
    pendingFocus.current = null;
    const row = listRef.current.querySelector<HTMLElement>(`[data-reorder-id="${CSS.escape(target.id)}"]`);
    const preferred = row?.querySelector<HTMLButtonElement>(`[data-direction="${target.direction}"]:not(:disabled)`);
    (preferred ?? row?.querySelector<HTMLButtonElement>('[data-direction]:not(:disabled)'))?.focus();
  }, [items]);

  const press = (index: number, direction: 'up' | 'down') => {
    pendingFocus.current = { id: getId(items[index]), direction };
    move(index, direction === 'up' ? index - 1 : index + 1);
  };

  const onDrop = (event: DragEvent<HTMLLIElement>, index: number) => {
    event.preventDefault();
    const from = dragIndex ?? Number(event.dataTransfer.getData('text/plain'));
    setDragIndex(null);
    setOverIndex(null);
    if (Number.isInteger(from)) move(from, index);
  };

  return (
    <>
      <ol ref={listRef} className="flex flex-col gap-3" aria-label={label}>
        {items.map((item, index) => {
          const id = getId(item);
          const name = getLabel(item);
          return (
            <li
              key={id}
              data-reorder-id={id}
              onDragOver={(event) => {
                if (dragIndex === null) return;
                event.preventDefault();
                setOverIndex(index);
              }}
              onDragLeave={() => setOverIndex((current) => (current === index ? null : current))}
              onDrop={(event) => onDrop(event, index)}
              className={`flex items-stretch gap-2 rounded-md border bg-neutral-surface p-3 ${overIndex === index && dragIndex !== index ? 'border-brand-primary' : 'border-neutral-border'} ${dragIndex === index ? 'opacity-60' : ''}`}
            >
              <div className="flex shrink-0 flex-col items-center justify-center gap-1">
                <span
                  draggable={!disabled}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(index));
                    setDragIndex(index);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  title="Seret untuk mengubah urutan"
                  aria-hidden="true"
                  className={`hidden h-11 w-8 items-center justify-center rounded-sm text-text-muted md:flex ${disabled ? 'cursor-not-allowed' : 'cursor-grab hover:bg-neutral-surface-alt'}`}
                >
                  <GripVertical size={20} />
                </span>
              </div>
              <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  data-direction="up"
                  onClick={() => press(index, 'up')}
                  disabled={disabled || index === 0}
                  aria-label={`Naikkan ${name}`}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:text-text-muted disabled:opacity-50"
                >
                  <ArrowUp size={20} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-direction="down"
                  onClick={() => press(index, 'down')}
                  disabled={disabled || index === items.length - 1}
                  aria-label={`Turunkan ${name}`}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:text-text-muted disabled:opacity-50"
                >
                  <ArrowDown size={20} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}

/** Bilah "urutan belum disimpan" dengan SIMPAN URUTAN / BATALKAN (keputusan A4 butir 4). */
export function ReorderBar({ onSave, onCancel, saving, label = 'Urutan belum disimpan.' }: { onSave: () => void; onCancel: () => void; saving: boolean; label?: string }): JSX.Element {
  return (
    <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-md border border-brand-primary-line bg-brand-primary-soft p-4 shadow-raised sm:flex-row sm:items-center sm:justify-between" role="region" aria-label="Perubahan urutan">
      <p className="text-body font-semibold text-brand-primary">{label}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          BATALKAN
        </Button>
        <Button onClick={onSave} isLoading={saving} loadingText="MENYIMPAN…">
          SIMPAN URUTAN
        </Button>
      </div>
    </div>
  );
}
