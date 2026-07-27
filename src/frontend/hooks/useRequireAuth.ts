'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const { authReady, isAuthenticated } = useAuthStore();

  return useCallback(
    (callbackUrl?: string) => {
      if (isAuthenticated) return true;
      if (!authReady) return false;

      const currentUrl =
        typeof window === 'undefined'
          ? pathname
          : `${window.location.pathname}${window.location.search}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl || currentUrl)}`);
      return false;
    },
    [authReady, isAuthenticated, pathname, router]
  );
}
