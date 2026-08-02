import { Menu } from 'lucide-react';

interface OverlayNavProps {
  onToggleSidebar: () => void;
}

export function OverlayNav({ onToggleSidebar }: OverlayNavProps) {
  return (
      <div className="fixed right-4 top-4 z-20 flex flex-col items-end gap-3">
        <div className="glass flex flex-col gap-1 rounded-2xl p-1.5">
          <button
              onClick={onToggleSidebar}
              aria-label="Open discovery menu"
              className="rounded-xl p-2.5 text-(--color-text) transition hover:bg-white/8"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
  );
}