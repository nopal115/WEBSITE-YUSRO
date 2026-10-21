import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/hooks/useAuth';

// Logout bersama tata letak Santri dan Admin (SRS FR-AUTH-03).
export function useLogout(): { onLogout: () => void; pending: boolean } {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  const handleLogout = async (): Promise<void> => {
    setPending(true);
    await logout();
    navigate('/login', { replace: true });
  };

  return { onLogout: () => void handleLogout(), pending };
}
