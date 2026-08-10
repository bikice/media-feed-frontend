import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FocusEvent } from 'react';
import {
    Activity,
    Check,
    Clapperboard,
    ChevronRight,
    Hash,
    LogOut,
    Search,
    Sparkles,
    User,
    Users,
    Volume2,
    VolumeX,
    X,
    Zap,
} from 'lucide-react';
import type { FeedQuery, InstantSearchResponse, ProviderInfo } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { getInstantSearch } from '@/lib/api';
import { stripTrailingSlash } from '@/lib/slug';

/** Icon + tint per instant-search source `type`. Providers define `type`
 *  freely, so this is intentionally a lookup with a fallback rather than an
 *  exhaustive switch -- a new/unrecognized type (e.g. something the backend
 *  adds before this list is updated) still renders sensibly. */
const SOURCE_TYPE_META: Record<string, { icon: typeof Sparkles; className: string }> = {
    subreddit: { icon: Users, className: 'text-(--color-purple-soft)' },
    user: { icon: User, className: 'text-(--color-pink)' },
    tag: { icon: Hash, className: 'text-(--color-text-dim)' },
    niche: { icon: Sparkles, className: 'text-(--color-purple-soft)' },
    action: { icon: Zap, className: 'text-(--color-pink)' },
    studio: { icon: Clapperboard, className: 'text-(--color-purple-soft)' },
    producer: { icon: Clapperboard, className: 'text-(--color-purple-soft)' },
};
const DEFAULT_SOURCE_TYPE_META = { icon: Sparkles, className: 'text-(--color-purple-soft)' };

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    providers: ProviderInfo[];
    provider: string;
    onProviderChange: (slug: string) => void;
    query: FeedQuery;
    onQueryChange: (next: FeedQuery) => void;
    availableFlairs: string[] | null;
    muted: boolean;
    onToggleMute: () => void;
    onOpenAdminTracking?: () => void;
}

export function Sidebar({
                            isOpen,
                            onClose,
                            providers,
                            provider,
                            onProviderChange,
                            query,
                            onQueryChange,
                            availableFlairs,
                            muted,
                            onToggleMute,
                            onOpenAdminTracking,
                        }: SidebarProps) {
    const { username, logout, isAdmin } = useAuth();
    const [searchText, setSearchText] = useState(query.q ?? '');
    const debouncedSearch = useDebouncedValue(searchText, 350);
    const [suggestions, setSuggestions] = useState<InstantSearchResponse | null>(null);

    // The "Related searches" and "Sources" suggestion lists collapse down
    // to a single trigger row (so they behave like the search input in
    // spatial nav -- a single focusable stop, no wasted vertical space)
    // and only expand into their list of buttons when explicitly activated
    // (click, or Enter/Space while focused). Merely tabbing/D-pad-focusing
    // the trigger does *not* expand it.
    const [queriesOpen, setQueriesOpen] = useState(false);
    const [sourcesOpen, setSourcesOpen] = useState(false);
    const [suggestedOpen, setSuggestedOpen] = useState(false);
    const [orderOpen, setOrderOpen] = useState(false);
    const [flairOpen, setFlairOpen] = useState(false);
    const queryTriggerRef = useRef<HTMLButtonElement>(null);
    const sourceTriggerRef = useRef<HTMLButtonElement>(null);
    const suggestedTriggerRef = useRef<HTMLButtonElement>(null);
    const orderTriggerRef = useRef<HTMLButtonElement>(null);
    const flairTriggerRef = useRef<HTMLButtonElement>(null);
    const queryListRef = useRef<HTMLDivElement>(null);
    const sourceListRef = useRef<HTMLDivElement>(null);
    const suggestedListRef = useRef<HTMLDivElement>(null);
    const orderListRef = useRef<HTMLDivElement>(null);
    const flairListRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const clearSourceRef = useRef<HTMLButtonElement>(null);
    const asideRef = useRef<HTMLElement>(null);

    const activeProviderInfo = providers.find((p) => p.slug === provider);
    const orderParam = activeProviderInfo?.feedParams.find((p) => p.name === 'order');

    // The trigger button is unmounted the instant a list expands, which
    // would otherwise drop focus out of the sidebar entirely -- and
    // useSpatialNavigation's own focusout recovery would then land it on
    // the *first* focusable element in the whole panel (the close button),
    // not the list that just appeared. Claim the first item explicitly.
    useLayoutEffect(() => {
        if (!queriesOpen) return;
        queryListRef.current?.querySelector<HTMLElement>('button')?.focus();
    }, [queriesOpen]);

    useLayoutEffect(() => {
        if (!sourcesOpen) return;
        sourceListRef.current?.querySelector<HTMLElement>('button')?.focus();
    }, [sourcesOpen]);

    useLayoutEffect(() => {
        if (!suggestedOpen) return;
        suggestedListRef.current?.querySelector<HTMLElement>('button')?.focus();
    }, [suggestedOpen]);

    useLayoutEffect(() => {
        if (!orderOpen) return;
        orderListRef.current?.querySelector<HTMLElement>('button')?.focus();
    }, [orderOpen]);

    useLayoutEffect(() => {
        if (!flairOpen) return;
        flairListRef.current?.querySelector<HTMLElement>('button')?.focus();
    }, [flairOpen]);

    // Collapse an expanded list back to its single trigger row the moment
    // focus leaves it -- whether that's a click outside (relatedTarget is
    // whatever, if anything, ends up focused; a click on a non-focusable
    // area leaves it null) or D-pad/tab navigation to something else
    // on-screen. Picking an option already closes the list itself (see the
    // onClick handlers below), so this only fires for the "changed my
    // mind" / "looked away" case.
    const handleQueriesBlur = useCallback((e: FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setQueriesOpen(false);
        }
    }, []);

    const handleSourcesBlur = useCallback((e: FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setSourcesOpen(false);
        }
    }, []);

    const handleSuggestedBlur = useCallback((e: FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setSuggestedOpen(false);
        }
    }, []);

    const handleOrderBlur = useCallback((e: FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setOrderOpen(false);
        }
    }, []);

    const handleFlairBlur = useCallback((e: FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setFlairOpen(false);
        }
    }, []);

    // Selecting a suggestion clears the search text, which -- once the
    // debounce settles -- nulls out `suggestions` and unmounts whichever
    // trigger/list was focused (well after the rAF refocus in the click
    // handlers below already ran and became moot). That leaves focus on
    // <body>, and useSpatialNavigation's generic recovery would grab the
    // *first* focusable in the sidebar (the close button). Beat it to the
    // punch: land back on the search input, which is always present, by
    // reacting synchronously (before that recovery's rAF fires) whenever
    // the suggestion data -- or the order/flair options, which can also
    // disappear out from under a focused trigger on a provider/feed change
    // -- itself changes and focus has fallen out of the panel as a result.
    useLayoutEffect(() => {
        if (!isOpen) return;
        if (asideRef.current && !asideRef.current.contains(document.activeElement)) {
            // If a source is active, its chip (with the clear/X button) is
            // what's on screen where the search input used to be conceptually
            // "next" -- land there instead of the search input so a source
            // selection doesn't visually bounce focus back up to search.
            if (query.source) {
                clearSourceRef.current?.focus();
            } else if (!query.q && (activeProviderInfo?.defaultSources.length ?? 0) > 0) {
                // Clearing a source (or a query) un-hides the "Suggested
                // sources" trigger/list in that same on-screen spot -- prefer
                // landing there over the search input, same reasoning as above.
                if (suggestedOpen) {
                    suggestedListRef.current?.querySelector<HTMLElement>('button')?.focus();
                } else {
                    suggestedTriggerRef.current?.focus();
                }
            } else {
                searchInputRef.current?.focus();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [suggestions, orderParam, availableFlairs, query.source, query.q, activeProviderInfo, suggestedOpen]);

    // D-pad navigation for Fire TV etc.: while the sidebar is open, arrow
    // keys move focus between its buttons/input by on-screen position.
    // Pressing left with nothing further left to focus on -- i.e. already
    // at the sidebar's left edge -- closes it, mirroring how ArrowRight at
    // the feed's right edge opens it (see useFeedNavigation).
    const handleEdge = useCallback(
        (direction: 'up' | 'down' | 'left' | 'right') => {
            if (direction === 'left') {
                onClose();
                return true;
            }
            return false;
        },
        [onClose],
    );

    useSpatialNavigation(asideRef, { active: isOpen, onEdge: handleEdge });

    // useSpatialNavigation defaults newly-active focus to the first
    // focusable element (the close button). Override that here: opening
    // the sidebar should land on the search input instead. This effect is
    // declared after the useSpatialNavigation call, so its passive effect
    // runs afterward in the same commit and wins.
    useEffect(() => {
        if (!isOpen) return;
        const input = searchInputRef.current;
        input?.focus();
        // Focusing an <input> with existing text otherwise leaves the browser's
        // default caret placement (end of the text) in place. Pin it to the
        // start instead -- both so reopening with a prior search reads
        // naturally, and so ArrowLeft can immediately close the panel (see
        // useSpatialNavigation's caret-at-edge fallthrough) rather than first
        // requiring a press to walk the caret back to position 0.
        input?.setSelectionRange(0, 0);
    }, [isOpen]);

    useEffect(() => {
        onQueryChange({ ...query, q: debouncedSearch || undefined });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    useEffect(() => {
        if (!debouncedSearch) {
            setSuggestions(null);
            return;
        }
        let cancelled = false;
        getInstantSearch(provider, debouncedSearch)
            .then((res) => {
                if (!cancelled) setSuggestions(res);
            })
            .catch(() => {
                if (!cancelled) setSuggestions(null);
            });
        return () => {
            cancelled = true;
        };
    }, [provider, debouncedSearch]);

    // A fresh search means fresh suggestion lists -- don't leave either
    // box expanded from a previous query.
    useEffect(() => {
        setQueriesOpen(false);
        setSourcesOpen(false);
    }, [debouncedSearch]);

    // Same idea for the "Suggested searches" trigger: don't leave it
    // expanded once its provider-curated list has moved on from under it.
    useEffect(() => {
        setSuggestedOpen(false);
    }, [activeProviderInfo]);

    // Likewise, don't leave the order/flair box expanded once its option
    // set has moved on from under it (provider switch, new feed load).
    useEffect(() => {
        setOrderOpen(false);
    }, [orderParam]);

    useEffect(() => {
        setFlairOpen(false);
    }, [availableFlairs]);

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px]"
                    onClick={onClose}
                    aria-hidden
                />
            )}
            <aside
                ref={asideRef}
                className={`glass scrollbar-visible fixed right-0 top-0 z-40 h-dvh w-[85vw] max-w-sm overflow-y-auto border-l border-(--color-border) p-5 transition-transform duration-300 ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="font-(family-name:--font-display) text-lg font-semibold">Discover</h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1.5 text-(--color-text-dim) hover:bg-white/5 hover:text-(--color-text)"
                        aria-label="Close sidebar"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Provider selector */}
                <label className="mb-1.5 block text-xs font-medium text-(--color-text-dim)">Provider</label>
                <div className="mb-5 flex flex-wrap gap-2" data-tv-row>
                    {providers.map((p) => (
                        <button
                            key={p.slug}
                            onClick={() => onProviderChange(p.slug)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition ${
                                p.slug === provider
                                    ? 'border-transparent bg-gradient-to-r from-(--color-purple) to-(--color-pink) text-white'
                                    : 'border-(--color-border) bg-(--color-surface-2) text-(--color-text-dim) hover:text-(--color-text)'
                            }`}
                        >
                            {p.title}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <label className="mb-1.5 block text-xs font-medium text-(--color-text-dim)" htmlFor="sidebar-search">
                    Search
                </label>
                <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-dim)" />
                    <input
                        id="sidebar-search"
                        ref={searchInputRef}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Search this provider…"
                        className="w-full rounded-lg border border-(--color-border) bg-(--color-surface-2) py-2.5 pl-9 pr-3 text-sm outline-none focus:border-(--color-pink)"
                    />
                </div>

                {/* Provider-curated example searches -- only meaningful as a
                    starting point, so hide them the moment the user has
                    typed a search or picked a source of their own. Same
                    collapse-to-trigger behavior as Related searches below. */}
                {!query.q && !query.source && (activeProviderInfo?.defaultSources.length ?? 0) > 0 && (
                    suggestedOpen ? (
                        <div
                            ref={suggestedListRef}
                            onBlur={handleSuggestedBlur}
                            className="scrollbar-visible mb-5 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-surface-2) p-2"
                        >
                            {activeProviderInfo!.defaultSources.map((s) => {
                                const { icon: TypeIcon, className } =
                                SOURCE_TYPE_META[s.type] ?? DEFAULT_SOURCE_TYPE_META;
                                return (
                                    <button
                                        key={s.slug}
                                        onClick={() => {
                                            onQueryChange({ ...query, source: stripTrailingSlash(s.slug), q: undefined, flair: undefined });
                                            setSearchText('');
                                            setSuggestedOpen(false);
                                            // This whole section (trigger included) unmounts the
                                            // instant query.source is set above -- there's no
                                            // trigger left to hand focus back to. The "Source: …"
                                            // chip's clear button takes its place, same as picking
                                            // from the Sources list below.
                                            requestAnimationFrame(() => clearSourceRef.current?.focus());
                                        }}
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
                                    >
                                        {s.icon ? (
                                            <img
                                                src={s.icon}
                                                alt=""
                                                className="h-4 w-4 shrink-0 rounded-full object-cover"
                                            />
                                        ) : (
                                            <TypeIcon className={`h-3.5 w-3.5 shrink-0 ${className}`} />
                                        )}
                                        <span className="truncate">{s.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <button
                            ref={suggestedTriggerRef}
                            onClick={() => setSuggestedOpen(true)}
                            className="mb-5 flex w-full items-center gap-2 rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2.5 text-left text-sm text-(--color-text-dim) transition hover:text-(--color-text)"
                        >
                            <Sparkles className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate">Suggested sources</span>
                            <ChevronRight className="h-4 w-4 shrink-0" />
                        </button>
                    )
                )}

                {suggestions && suggestions.queries.length > 0 && (
                    queriesOpen ? (
                        <div
                            ref={queryListRef}
                            onBlur={handleQueriesBlur}
                            className="scrollbar-visible mb-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-surface-2) p-2"
                        >
                            {suggestions.queries.map((q) => (
                                <button
                                    key={q}
                                    onClick={() => {
                                        setSearchText(q);
                                        onQueryChange({ ...query, q, source: undefined, flair: undefined });
                                        setQueriesOpen(false);
                                        requestAnimationFrame(() => queryTriggerRef.current?.focus());
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
                                >
                                    <Search className="h-3.5 w-3.5 shrink-0 text-(--color-text-dim)" />
                                    <span className="truncate">{q}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <button
                            ref={queryTriggerRef}
                            onClick={() => setQueriesOpen(true)}
                            className="mb-2 flex w-full items-center gap-2 rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2.5 text-left text-sm text-(--color-text-dim) transition hover:text-(--color-text)"
                        >
                            <Search className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate">Related searches</span>
                            <ChevronRight className="h-4 w-4 shrink-0" />
                        </button>
                    )
                )}

                {suggestions && suggestions.sources.length > 0 && (
                    sourcesOpen ? (
                        <div
                            ref={sourceListRef}
                            onBlur={handleSourcesBlur}
                            className="scrollbar-visible mb-5 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-surface-2) p-2"
                        >
                            {suggestions.sources.map((s) => {
                                const { icon: TypeIcon, className } =
                                SOURCE_TYPE_META[s.type] ?? DEFAULT_SOURCE_TYPE_META;
                                return (
                                    <button
                                        key={s.slug}
                                        onClick={() => {
                                            onQueryChange({ ...query, source: stripTrailingSlash(s.slug), q: undefined });
                                            setSearchText('');
                                            setSourcesOpen(false);
                                            // Selecting a source immediately reveals the "Source: …"
                                            // chip with its own clear (X) button below -- land focus
                                            // there rather than on the trigger, which is about to
                                            // unmount anyway once the cleared search text's debounce
                                            // settles and `suggestions` nulls out.
                                            requestAnimationFrame(() => clearSourceRef.current?.focus());
                                        }}
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
                                    >
                                        {s.icon ? (
                                            <img
                                                src={s.icon}
                                                alt=""
                                                className="h-4 w-4 shrink-0 rounded-full object-cover"
                                            />
                                        ) : (
                                            <TypeIcon className={`h-3.5 w-3.5 shrink-0 ${className}`} />
                                        )}
                                        <span className="truncate">{s.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <button
                            ref={sourceTriggerRef}
                            onClick={() => setSourcesOpen(true)}
                            className="mb-5 flex w-full items-center gap-2 rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2.5 text-left text-sm text-(--color-text-dim) transition hover:text-(--color-text)"
                        >
                            <Users className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate">Sources</span>
                            <ChevronRight className="h-4 w-4 shrink-0" />
                        </button>
                    )
                )}

                {query.source && (
                    <div className="mb-5 flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2 text-sm">
            <span className="truncate text-(--color-text-dim)">
              Source: <span className="text-(--color-text)">{query.source}</span>
            </span>
                        <button
                            ref={clearSourceRef}
                            onClick={() => {
                                // Don't decide the next focus target here -- clearing the
                                // source can un-hide the "Suggested sources" trigger in
                                // this same spot, and the recovery effect above (keyed on
                                // query.source) already knows how to pick between that and
                                // the search input. Hard-coding the search input here would
                                // always win over that logic and re-introduce the bug.
                                onQueryChange({ ...query, source: undefined });
                            }}
                            className="text-(--color-text-dim) hover:text-(--color-text)"
                            aria-label="Clear source"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Order */}
                {orderParam?.enum && (
                    <>
                        <label className="mb-1.5 block text-xs font-medium text-(--color-text-dim)">Sort</label>
                        {orderOpen ? (
                            <div
                                ref={orderListRef}
                                onBlur={handleOrderBlur}
                                className="scrollbar-visible mb-5 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-surface-2) p-2"
                            >
                                {orderParam.enum.map((opt) => {
                                    const selected = (query.order ?? orderParam.default) === opt;
                                    return (
                                        <button
                                            key={opt}
                                            onClick={() => {
                                                onQueryChange({ ...query, order: opt });
                                                setOrderOpen(false);
                                                requestAnimationFrame(() => orderTriggerRef.current?.focus());
                                            }}
                                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm capitalize transition hover:bg-white/5 ${
                                                selected ? 'text-(--color-text)' : 'text-(--color-text-dim)'
                                            }`}
                                        >
                                            <span className="flex-1 truncate">{opt}</span>
                                            {selected && (
                                                <Check className="h-3.5 w-3.5 shrink-0 text-(--color-pink)" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <button
                                ref={orderTriggerRef}
                                onClick={() => setOrderOpen(true)}
                                className="mb-5 flex w-full items-center gap-2 rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2.5 text-left text-sm capitalize text-(--color-text) transition hover:bg-white/5"
                            >
                                <span className="flex-1 truncate">{query.order ?? orderParam.default}</span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-(--color-text-dim)" />
                            </button>
                        )}
                    </>
                )}

                {/* Dynamic flair filter, populated from the current feed response */}
                {availableFlairs && availableFlairs.length > 0 && (
                    <>
                        <label className="mb-1.5 block text-xs font-medium text-(--color-text-dim)">Flair</label>
                        {flairOpen ? (
                            <div
                                ref={flairListRef}
                                onBlur={handleFlairBlur}
                                className="scrollbar-visible mb-5 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-surface-2) p-2"
                            >
                                <button
                                    onClick={() => {
                                        onQueryChange({ ...query, flair: undefined });
                                        setFlairOpen(false);
                                        requestAnimationFrame(() => flairTriggerRef.current?.focus());
                                    }}
                                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-white/5 ${
                                        !query.flair ? 'text-(--color-text)' : 'text-(--color-text-dim)'
                                    }`}
                                >
                                    <span className="flex-1 truncate">All</span>
                                    {!query.flair && <Check className="h-3.5 w-3.5 shrink-0 text-(--color-pink)" />}
                                </button>
                                {availableFlairs.map((f) => {
                                    const selected = query.flair === f;
                                    return (
                                        <button
                                            key={f}
                                            onClick={() => {
                                                onQueryChange({ ...query, flair: f });
                                                setFlairOpen(false);
                                                requestAnimationFrame(() => flairTriggerRef.current?.focus());
                                            }}
                                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-white/5 ${
                                                selected ? 'text-(--color-text)' : 'text-(--color-text-dim)'
                                            }`}
                                        >
                                            <span className="flex-1 truncate">{f}</span>
                                            {selected && (
                                                <Check className="h-3.5 w-3.5 shrink-0 text-(--color-pink)" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <button
                                ref={flairTriggerRef}
                                onClick={() => setFlairOpen(true)}
                                className={`flex w-full items-center gap-2 rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2.5 text-left text-sm transition hover:bg-white/5 ${
                                    query.flair ? 'text-(--color-text)' : 'text-(--color-text-dim)'
                                }`}
                            >
                                <span className="flex-1 truncate">{query.flair ?? 'All'}</span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-(--color-text-dim)" />
                            </button>
                        )}
                    </>
                )}

                {/* Account & playback settings */}
                <div className="mt-5 rounded-lg border border-(--color-border) bg-(--color-surface-2) p-3">
                    <p className="mb-2 truncate text-xs text-(--color-text-dim)">{username ?? 'Signed in'}</p>
                    {isAdmin && onOpenAdminTracking && (
                        <button
                            onClick={onOpenAdminTracking}
                            className="mb-2 flex w-full items-center gap-2 rounded-lg border border-(--color-border) px-3 py-2 text-sm text-(--color-text-dim) transition hover:bg-white/8 hover:text-(--color-text)"
                        >
                            <Activity className="h-4 w-4" />
                            View Tracking
                        </button>
                    )}
                    <div className="flex items-center gap-2" data-tv-row>
                        <button
                            onClick={onToggleMute}
                            aria-label={muted ? 'Unmute' : 'Mute'}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-(--color-border) px-3 py-2 text-sm text-(--color-text) transition hover:bg-white/8"
                        >
                            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                            {muted ? 'Muted' : 'Sound on'}
                        </button>
                        <button
                            onClick={() => logout()}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-(--color-border) px-3 py-2 text-sm text-(--color-text-dim) transition hover:bg-white/8 hover:text-(--color-text)"
                        >
                            <LogOut className="h-4 w-4" />
                            Log out
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}