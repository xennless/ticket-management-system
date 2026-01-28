import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

/**
 * Hook: Kullanıcının 2FA durumunu kontrol eder
 */
export function useTwoFactor() {
  const { data, isLoading, error } = useQuery<{ enabled: boolean; method: string | null }>({
    queryKey: ['auth', '2fa', 'status'],
    queryFn: () => apiFetch('/api/auth/2fa/status'),
    retry: false,
    staleTime: 5 * 60 * 1000 // 5 dakika cache
  });

  return {
    isEnabled: data?.enabled ?? false,
    isLoading,
    error
  };
}

