import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 60_000, // 60s: daha uzun stale time = daha az refetch
      gcTime: 15 * 60_000, // 15dk: cache'i daha uzun tutar
      structuralSharing: true // Aynı data'yı tekrar kullan
    },
    mutations: {
      retry: 0 // Mutation'larda retry yapma
    }
  }
});


