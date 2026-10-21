import { useQuery } from '@tanstack/react-query';
import { profileApi } from './api';

export const PROFILE_KEY = ['profile'] as const;

/** Profil Santri; dipakai halaman Profil dan avatar di header (cache yang sama, jadi perubahan langsung terlihat). */
export function useProfile(enabled = true) {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: ({ signal }) => profileApi.get(signal), enabled });
}
