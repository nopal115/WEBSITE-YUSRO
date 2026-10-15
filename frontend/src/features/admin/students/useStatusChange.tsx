import { useCallback, useRef, useState } from 'react';
import type { AccountStatus } from '../../auth/types';
import { StudentStatusDialog, type StatusTarget } from './StudentStatusDialog';

/**
 * Membuka dialog ubah status dari tombol mana pun (daftar atau detail), mengembalikan fokus ke
 * tombol pemicu saat dialog tertutup, dan menyiapkan pemberitahuan hasil untuk ditampilkan.
 */
export function useStatusChange() {
  const [target, setTarget] = useState<StatusTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((student: StatusTarget, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setNotice(null);
    setTarget(student);
  }, []);

  const handleClose = useCallback(
    (changedTo: AccountStatus | null) => {
      if (changedTo && target) setNotice(changedTo === 'INACTIVE' ? `Akun ${target.name} dinonaktifkan.` : `Akun ${target.name} diaktifkan kembali.`);
      setTarget(null);
      triggerRef.current?.focus();
    },
    [target],
  );

  const dialog = target ? <StudentStatusDialog key={target.id} student={target} onClose={handleClose} /> : null;
  return { open, dialog, notice };
}
