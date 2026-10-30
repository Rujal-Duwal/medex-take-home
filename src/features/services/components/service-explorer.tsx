"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ErrorState } from "@/components/states/error-state";
import { OfflineBanner } from "@/components/states/offline-banner";
import { useAnnounce } from "@/lib/a11y/live-announcer";
import { toCompareTrayView, toggleCompared, type CompareTrayView } from "../compare";
import { runQuery, type ServiceQuery } from "../engine";
import { applyFilterChange, type FilterChange } from "../filter-changes";
import { toFiltersView, type FiltersView } from "../filters-view";
import { ANNOUNCE_DELAY_MS, toResultsView, type ResultsView } from "../results-view";
import type { Catalogue } from "../types";
import { useCatalogue } from "../use-catalogue";
import { parseServicesUrl, servicesHref, type ServicesUrlState } from "../url-codec";
import { ActiveFilters } from "./active-filters";
import { BottomDock } from "./bottom-dock";
import { CompareTray } from "./compare-tray";
import { ExplorerColumns } from "./explorer-columns";
import { FilterPanel, SortSelect } from "./filter-panel";
import { FiltersDrawer } from "./filters-drawer";
import { NoResults } from "./no-results";
import { ResultsSkeleton } from "./results-skeleton";
import { SearchBox } from "./search-box";
import { ServiceResults } from "./service-results";

// The URL in the address bar, not useSearchParams: Next updates that in a transition, so while
// typing it can be a change behind. A change built on it could undo the one before.
function addressBarState(catalogue: Catalogue): ServicesUrlState {
  return parseServicesUrl(new URLSearchParams(globalThis.location.search), catalogue);
}

const SLOW_MESSAGE = "This is taking longer than usual. We're still loading services.";

// Each change is timed from the moment it reaches the explorer (a click, or typing that
// SearchBox sends on) to the commit that shows its results (T1-12, WBS 3.9). It shows as
// "filter-change" in the Timings track of the DevTools Performance panel; in the console,
// performance.getEntriesByName("filter-change") lists them. Nothing is logged: customers'
// consoles stay clean.
const CHANGE_MEASURE = "filter-change";

// The hand-over from the server's first view to the client (spec "Rendering and states").
//
// 1. The server page reads the URL, runs the engine on its own copy of the data and passes the
//    finished view in as serverView. Until the client has the catalogue, this shows serverView,
//    so the first client render is the server's HTML: no flash, no hydration mismatch.
// 2. Meanwhile useCatalogue loads the three endpoints (with the mock flags).
// 3. Once loaded, the client reads the URL itself and runs the same codec, engine and view.
//    Same URL and same data, so it renders the same thing, through the same ServiceResults in
//    the same place: React keeps the DOM, and nothing moves.
//
// The filter panel goes through the same hand-over, from serverFilters.
//
// Filters (WBS 3.6): the panel reports a FilterChange; handleFilterChange applies it to the
// URL with the native history API, which Next.js syncs into useSearchParams without asking the
// server again (https://nextjs.org/docs/app/getting-started/linking-and-navigating, "Native
// History API"). This then re-renders from the new URL. Next applies that URL in a transition,
// so React can drop a render that a newer keystroke makes stale. The search box keeps its own
// text, so typing shows at once; a tick shows together with the new results.
//
// Small screens (WBS 3.8): the panel is hidden. The search box sits above the results and
// applies as you type, as on large screens; the other filters open in FiltersDrawer, which
// edits a draft and hands it to handleApply.
//
// Compare (WBS 3.10): each card's Compare box and the tray change the compare list in the URL
// through handleCompareChange. The tray goes through the same hand-over, from serverCompareTray.
export function ServiceExplorer({
  serverView,
  serverFilters,
  serverCompareTray,
}: Readonly<{
  serverView: ResultsView;
  serverFilters: FiltersView;
  serverCompareTray: CompareTrayView;
}>) {
  const { state, retry } = useCatalogue();
  const searchParams = useSearchParams();
  const announce = useAnnounce();
  const resultsRef = useRef<HTMLElement>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // The query the drawer's draft starts from, read from the address bar as it opens.
  const [drawerStartQuery, setDrawerStartQuery] = useState<ServiceQuery | undefined>(undefined);

  const clientViews = useMemo(() => {
    if (state.kind !== "ready") return undefined;
    const urlState = parseServicesUrl(searchParams, state.catalogue);
    const result = runQuery(state.catalogue, urlState.query);
    return {
      urlState,
      urlQuery: urlState.query,
      results: toResultsView(result, urlState),
      filters: toFiltersView(state.catalogue, result, urlState.query),
      compareTray: toCompareTrayView(state.catalogue, urlState.compareProviderIds),
    };
  }, [state, searchParams]);

  // The results on screen: the client's once it has the catalogue; the server's on a first
  // load and offline; none while an error or the retry skeleton shows.
  const showsServerView = state.kind === "offline" || (state.kind === "loading" && !state.isRetry);
  const shownView = clientViews?.results ?? (showsServerView ? serverView : undefined);
  // The panel always shows: the server's until the client has the catalogue, then disabled
  // (see FilterPanel), since a change couldn't be counted yet.
  const shownFilters = clientViews?.filters ?? serverFilters;
  const shownCompareTray = clientViews?.compareTray ?? serverCompareTray;
  const isReady = state.kind === "ready";

  // The count (and page) is read out when it changes (T1-14), whichever side rendered it. It
  // starts at the server's, so the hand-over itself is silent: nothing changed for the customer.
  // It waits for the count to settle (ANNOUNCE_DELAY_MS). FiltersDrawer reads out its pending
  // count the same way.
  const lastAnnounced = useRef(serverView.announcement);
  useEffect(() => {
    if (shownView === undefined || shownView.announcement === lastAnnounced.current) return;
    const message = shownView.announcement;
    const timer = setTimeout(() => {
      lastAnnounced.current = message;
      announce(message);
    }, ANNOUNCE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [shownView, announce]);

  // Whether the current history entry was made by typing, so the next letter replaces it
  // rather than adding another. Back or forward lands on some other entry, so it resets.
  const isTypingEntry = useRef(false);
  // When the change waiting to be shown started (performance.now()), set by writeQuery.
  const changeStartedAt = useRef<number | undefined>(undefined);
  useEffect(() => {
    function landedOnOtherEntry() {
      isTypingEntry.current = false;
      // Back or forward replaces the change being timed: its commit isn't that change's.
      changeStartedAt.current = undefined;
    }
    globalThis.addEventListener("popstate", landedOnOtherEntry);
    return () => {
      globalThis.removeEventListener("popstate", landedOnOtherEntry);
    };
  }, []);

  // A layout effect runs right after React has put the new results in the page, before the
  // browser paints them, so the measure ends at the commit.
  useLayoutEffect(() => {
    const start = changeStartedAt.current;
    if (start === undefined) return;
    // While typing, a commit for an earlier letter can land after a newer letter was written.
    // Only the commit that matches the address bar shows the latest change.
    const addressBar = new URLSearchParams(globalThis.location.search);
    if (searchParams.toString() !== addressBar.toString()) return;
    changeStartedAt.current = undefined;
    performance.measure(CHANGE_MEASURE, { start });
  }, [searchParams]);

  const isSlow = state.kind === "loading" && state.isSlow;
  useEffect(() => {
    if (isSlow) announce(SLOW_MESSAGE);
  }, [isSlow, announce]);

  // Writes query to the URL, keeping the rest of current (the compare selection). startedAt is
  // when the customer acted, for the timing above.
  function writeQuery(
    current: ServicesUrlState,
    query: ServiceQuery,
    isSearch: boolean,
    startedAt: number,
  ) {
    const href = servicesHref({ ...current, query });
    // Nothing changed (a space typed, the same price applied again): no entry, or Back would
    // seem to do nothing.
    if (href === servicesHref(current)) return;
    changeStartedAt.current = startedAt;
    // Every change adds a history entry, so Back undoes it (T1-10). Typing adds one for the
    // first letter, then replaces it, so Back undoes the whole edit, not each letter.
    if (isSearch && isTypingEntry.current) globalThis.history.replaceState(null, "", href);
    else globalThis.history.pushState(null, "", href);
    isTypingEntry.current = isSearch;
  }

  function handleFilterChange(change: FilterChange) {
    const startedAt = performance.now();
    if (state.kind !== "ready") return;
    const current = addressBarState(state.catalogue);
    const query = applyFilterChange(current.query, change, state.catalogue.categories);
    writeQuery(current, query, change.kind === "search", startedAt);
  }

  // Compare (WBS 3.10): update gets the address bar's compare list and returns the new one
  // (compare.ts has the rules). A history entry each, like a filter, so Back undoes a tick.
  // Not timed: it doesn't change the results.
  function handleCompareChange(update: (ids: number[]) => number[]) {
    if (state.kind !== "ready") return;
    const current = addressBarState(state.catalogue);
    const next = { ...current, compareProviderIds: update(current.compareProviderIds) };
    const href = servicesHref(next);
    if (href === servicesHref(current)) return;
    globalThis.history.pushState(null, "", href);
    isTypingEntry.current = false;
  }

  function handleCompareToggle(providerId: number) {
    handleCompareChange((ids) => toggleCompared(ids, providerId));
  }

  // The drawer's "Show N results": the whole draft becomes one history entry, so Back undoes
  // the drawer edit in one go. Closing returns focus to the Filters button (Radix), and the
  // new count is read out by the effect above.
  function handleApply(query: ServiceQuery) {
    const startedAt = performance.now();
    if (state.kind !== "ready") return;
    const current = addressBarState(state.catalogue);
    writeQuery(current, query, false, startedAt);
    setIsDrawerOpen(false);
  }

  // The draft starts from the address bar, not useSearchParams, like every change above. The
  // tap on Filters takes focus from the search box, which sends its waiting text (SearchBox);
  // Next applies that in a transition, which may not have run before the drawer opens.
  function handleDrawerOpenChange(isOpen: boolean) {
    if (isOpen && state.kind === "ready") {
      setDrawerStartQuery(addressBarState(state.catalogue).query);
    }
    setIsDrawerOpen(isOpen);
  }

  // Focus waits on the results area when the control that had it goes away (a way out of the
  // empty state, the last chip, Clear all in the chip row) and after any page link. Stable, so
  // ActiveFilters' focus effect runs only when its chips change.
  const focusResults = useCallback(() => {
    resultsRef.current?.focus();
  }, []);

  function handleRetry() {
    // Read the count out again when the results come back, even if it is the same as before.
    lastAnnounced.current = "";
    retry();
    // The error and its button are about to go; focus waits on the results area instead.
    focusResults();
  }

  function renderResults() {
    // No sections means no results (results-view.ts).
    if (shownView?.sections.length === 0) {
      return (
        <NoResults
          waysOut={shownFilters.waysOut}
          isEnabled={isReady}
          onChange={handleFilterChange}
          onWayOut={focusResults}
        />
      );
    }
    if (shownView) {
      return (
        <ServiceResults
          view={shownView}
          isCompareEnabled={isReady}
          onCompareToggle={handleCompareToggle}
          onPageChange={focusResults}
        />
      );
    }
    if (state.kind === "failed") {
      return (
        <ErrorState
          title="We couldn't load services"
          description={
            state.reason === "network"
              ? "We didn't hear back. Check your connection and try again. Your filters are saved."
              : "Something went wrong on our side. Your filters are saved."
          }
          onRetry={handleRetry}
        />
      );
    }
    return <ResultsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4">
      <OfflineBanner message="You're offline. We'll update these results when you're back online." />
      <ExplorerColumns
        filters={
          // One panel in the page at a time: while the drawer is open its fields would repeat
          // every id in this one, and a label would point at the hidden copy. The panel is
          // hidden on screens where the drawer opens, so taking it out changes nothing seen.
          !isDrawerOpen && (
            <FilterPanel view={shownFilters} isEnabled={isReady} onChange={handleFilterChange} />
          )
        }
      >
        <div className="lg:hidden">
          <SearchBox
            id="services-search-small"
            urlText={shownFilters.search}
            disabled={!isReady}
            onChange={handleFilterChange}
          />
        </div>
        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <FiltersDrawer
            // The handoff's label: the number of chips, so the customer sees filters are on.
            label={
              shownFilters.chips.length > 0
                ? `Filters (${String(shownFilters.chips.length)})`
                : "Filters"
            }
            loaded={
              state.kind === "ready" && clientViews
                ? {
                    catalogue: state.catalogue,
                    urlQuery: drawerStartQuery ?? clientViews.urlQuery,
                  }
                : undefined
            }
            isOpen={isDrawerOpen}
            onOpenChange={handleDrawerOpenChange}
            onApply={handleApply}
          />
          <SortSelect sort={shownFilters.sort} isEnabled={isReady} onChange={handleFilterChange} />
        </div>
        <ActiveFilters
          chips={shownFilters.chips}
          isEnabled={isReady}
          onChange={handleFilterChange}
          onFiltersGone={focusResults}
        />
        {/* tabIndex -1: focus can be moved here (after Try again) without adding a tab stop. */}
        <section
          ref={resultsRef}
          tabIndex={-1}
          aria-label="Results"
          aria-busy={state.kind === "loading" && state.isRetry}
          className="flex flex-col gap-4"
        >
          {renderResults()}
        </section>
      </ExplorerColumns>
      {/* The slow note above the compare tray, both fixed at the bottom of the window. The
          live region reads the note out (the effects above). */}
      <BottomDock>
        {isSlow && (
          <div className="mx-4 mb-3 sm:mx-auto sm:w-full sm:max-w-md">
            <Alert variant="info">
              <AlertDescription>{SLOW_MESSAGE}</AlertDescription>
            </Alert>
          </div>
        )}
        <CompareTray
          tray={shownCompareTray}
          loaded={
            state.kind === "ready" && clientViews
              ? {
                  catalogue: state.catalogue,
                  urlState: clientViews.urlState,
                  chips: clientViews.filters.chips,
                }
              : undefined
          }
          onCompareChange={handleCompareChange}
          onTrayGone={focusResults}
        />
      </BottomDock>
    </div>
  );
}
