import { useState } from 'react';
import { LogOut, Menu, User, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface OverlayNavProps {
  muted: boolean;
  onToggleMute: () => void;
  onToggleSidebar: () => void;
}

export function OverlayNav({ muted, onToggleMute, onToggleSidebar }: OverlayNavProps) {
  const { username, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="fixed right-4 top-4 z-20 flex flex-col items-end gap-3">
      <div className="glass flex flex-col gap-1 rounded-2xl p-1.5">
        <button
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="rounded-xl p-2.5 text-(--color-text) transition hover:bg-white/8"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button
          onClick={onToggleSidebar}
          aria-label="Open discovery menu"
          className="rounded-xl p-2.5 text-(--color-text) transition hover:bg-white/8"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Account menu"
            className="rounded-xl p-2.5 text-(--color-text) transition hover:bg-white/8"
          >
            <User className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="glass absolute right-full top-0 mr-2 w-44 rounded-xl p-2">
              <p className="truncate px-2 py-1 text-xs text-(--color-text-dim)">
                {username ?? 'Signed in'}
              </p>
              <button
                onClick={() => logout()}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-(--color-text) hover:bg-white/8"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
