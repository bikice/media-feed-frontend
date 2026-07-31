import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LoginScreen } from './LoginScreen';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-(--color-bg)">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-(--color-purple) border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
