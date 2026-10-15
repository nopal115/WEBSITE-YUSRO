import { Pill } from '../../../components/ui/Pill';
import type { ContentStatus } from './types';
import { ACTION_LABEL, availableActions, STATUS_LABEL, STATUS_TONE, type ContentAction } from './view';

export function ContentStatusPill({ status }: { status: ContentStatus }): JSX.Element {
  return <Pill status={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
}

interface ContentStatusActionsProps {
  status: ContentStatus;
  isReferenced: boolean;
  /** Nama konten untuk label tombol pembaca layar. */
  name: string;
  onAction: (action: ContentAction, trigger: HTMLElement) => void;
  disabled?: boolean;
  /** Alasan Hapus tidak tersedia walau DRAFT (mis. tahapan masih berisi materi). */
  deleteBlockedReason?: string;
}

const linkButton =
  'min-h-11 whitespace-nowrap rounded-md px-3 text-body hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:text-text-muted';

/** Aksi status SDD 3.5.3/7.7.18: hanya transisi sah; Nonaktifkan disertai keterangan data historis. */
export function ContentStatusActions({ status, isReferenced, name, onAction, disabled = false, deleteBlockedReason }: ContentStatusActionsProps): JSX.Element {
  const actions = availableActions(status, isReferenced);
  return (
    <div className="flex flex-col gap-1">
      <div className="-mx-3 flex flex-wrap items-center">
        {actions.map((action) => {
          const blocked = action === 'delete' && Boolean(deleteBlockedReason);
          return (
            <button
              key={action}
              type="button"
              disabled={disabled || blocked}
              onClick={(event) => onAction(action, event.currentTarget)}
              aria-label={`${ACTION_LABEL[action]}: ${name}`}
              className={`${linkButton} ${action === 'delete' ? 'text-feedback-salah' : 'text-brand-primary'}`}
            >
              {ACTION_LABEL[action]}
            </button>
          );
        })}
      </div>
      {actions.includes('deactivate') && <p className="text-body-s text-text-secondary">Bila dinonaktifkan, data historis tetap tersimpan.</p>}
      {actions.includes('delete') && deleteBlockedReason && <p className="text-body-s text-text-secondary">{deleteBlockedReason}</p>}
    </div>
  );
}
