import { useEffect, useLayoutEffect, useRef } from 'react';
import type { FocusEvent, ReactNode, RefObject } from 'react';
import { Check, ChevronRight } from 'lucide-react';

export interface CollapsibleOption {
    /** Unique key (also used as the React key). */
    key: string;
    label: string;
    /** Rendered before the label, e.g. a lucide icon or an <img> avatar. */
    icon?: ReactNode;
    /** Omit entirely for plain suggestion lists (queries/sources) that have
     *  no notion of a "current" value. Provide it for lists that do
     *  (order/flair) to get the dimmed/active text color and trailing
     *  checkmark for free. */
    selected?: boolean;
    onSelect: () => void;
}

interface CollapsibleOptionListProps {
    isOpen: boolean;
    onOpen: () => void;
    /** Fires both when focus leaves the expanded list and (indirectly, via
     *  each option's own onSelect) when a choice collapses it. */
    onClose: () => void;
    triggerIcon?: ReactNode;
    triggerLabel: ReactNode;
    options: CollapsibleOption[];
    /** Appended to the trigger button's classes -- margin, color, hover. */
    triggerClassName?: string;
    /** Appended to the expanded list's classes -- margin, max-height. */
    listClassName?: string;
    /** Appended to every option button's classes, e.g. 'capitalize'. */
    optionClassName?: string;
    triggerRef?: RefObject<HTMLButtonElement | null>;
    listRef?: RefObject<HTMLDivElement | null>;
}

/**
 * A trigger row that collapses down to a single focusable stop and expands
 * into a scrollable list of option buttons -- the "Suggested sources",
 * "Related searches", "Sources", "Sort", and "Flair" panels in the Sidebar
 * all follow this exact shape.
 *
 * Two behaviors are handled here so callers don't have to repeat them:
 *  - The moment the list expands, focus jumps to its first option (the
 *    trigger unmounts immediately, so generic focus-out recovery would
 *    otherwise grab the wrong element).
 *  - The list collapses the instant focus leaves it for anything outside
 *    (click elsewhere, tab/D-pad away) -- but *not* when focus moves
 *    between options within it.
 *
 * Everything else (what happens on open/close, what a selection does
 * besides collapsing, where focus should land afterward) stays with the
 * caller via onOpen/onClose and each option's onSelect.
 */
export function CollapsibleOptionList({
                                          isOpen,
                                          onOpen,
                                          onClose,
                                          triggerIcon,
                                          triggerLabel,
                                          options,
                                          triggerClassName = '',
                                          listClassName = '',
                                          optionClassName = '',
                                          triggerRef,
                                          listRef,
                                      }: CollapsibleOptionListProps) {
    // Owned internally so the centering effect below always has a DOM node
    // to work with, regardless of whether the caller passed a listRef of
    // its own (some callers need one, to imperatively refocus into this
    // list later -- e.g. after a source is cleared elsewhere in Sidebar).
    const internalListRef = useRef<HTMLDivElement>(null);
    const setListNode = (node: HTMLDivElement | null) => {
        internalListRef.current = node;
        if (listRef) (listRef as { current: HTMLDivElement | null }).current = node;
    };

    useLayoutEffect(() => {
        if (!isOpen) return;
        internalListRef.current?.querySelector<HTMLElement>('button')?.focus();
    }, [isOpen]);

    // Keep the focused option roughly centered as arrow-key navigation
    // moves through the list, rather than the browser's default "scroll
    // just enough to bring it into view" (which pins it to whichever edge
    // it approached from). scrollTop is naturally clamped to
    // [0, scrollHeight - clientHeight], so this settles at the top for the
    // first couple of options and at the bottom for the last couple --
    // true centering only happens, and is only needed, in between.
    useEffect(() => {
        if (!isOpen) return;
        const container = internalListRef.current;
        if (!container) return;

        const handleFocusIn = (e: globalThis.FocusEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target || !container.contains(target)) return;
            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const delta =
                targetRect.top + targetRect.height / 2 - (containerRect.top + containerRect.height / 2);
            container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' });
        };

        container.addEventListener('focusin', handleFocusIn);
        return () => container.removeEventListener('focusin', handleFocusIn);
    }, [isOpen]);

    const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            onClose();
        }
    };

    if (!isOpen) {
        return (
            <button
                ref={triggerRef}
                onClick={onOpen}
                className={`flex w-full items-center gap-2 rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2.5 text-left text-sm transition ${triggerClassName}`}
            >
                {triggerIcon}
                <span className="flex-1 truncate">{triggerLabel}</span>
                <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
        );
    }

    return (
        <div
            ref={setListNode}
            onBlur={handleBlur}
            className={`scrollbar-visible space-y-1 overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-surface-2) p-2 ${listClassName}`}
        >
            {options.map((opt) => (
                <button
                    key={opt.key}
                    onClick={opt.onSelect}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-white/5 ${
                        opt.selected === undefined
                            ? ''
                            : opt.selected
                                ? 'text-(--color-text)'
                                : 'text-(--color-text-dim)'
                    } ${optionClassName}`}
                >
                    {opt.icon}
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.selected && <Check className="h-3.5 w-3.5 shrink-0 text-(--color-pink)" />}
                </button>
            ))}
        </div>
    );
}