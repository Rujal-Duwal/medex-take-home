"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ErrorState } from "@/components/states/error-state";
import { OfflineBanner } from "@/components/states/offline-banner";
import { useAnnounce } from "@/lib/a11y/live-announcer";
import { runQuery } from "../engine";
import { applyFilterChange, type FilterChange } from "../filter-changes";
import { toFiltersView, type FiltersView } from "../filters-view";
import { toResultsView, type ResultsView } from "../results-view";
import { useCatalogue } from "../use-catalogue";
import { parseServicesUrl, servicesHref } from "../url-codec";
import { ExplorerColumns } from "./explorer-columns";
import { FilterPanel, SortSelect } from "./filter-panel";
import { ResultsSkeleton } from "./results-skeleton";
import { ServiceResults } from "./service-results";

// How long the count must stay the same before it is read out; see the effect below.
const ANNOUNCE_DELAY_MS = 500;

const SLOW_MESSAGE = "This is taking longer than usual. We're still loading services.";

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
export function ServiceExplorer({
  serverView,
  serverFilters,
}: Readonly<{ serverView: ResultsView; serverFilters: FiltersView }>) {
  const { state, retry } = useCatalogue();
  const searchParams = useSearchParams();
  const announce = useAnnounce();
  const resultsRef = useRef<HTMLElement>(null);

  const clientViews = useMemo(() => {
    if (state.kind !== "ready") return undefined;
    const urlState = parseServicesUrl(searchParams, state.catalogue);
    const result = runQuery(state.catalogue, urlState.query);
    return {
      results: toResultsView(result, urlState),
      filters: toFiltersView(state.catalogue, result, urlState.query),
    };
  }, [state, searchParams]);

  // The results on screen: the client's once it has the catalogue; the server's on a first
  // load and offline; none while an error or the retry skeleton shows.
  const showsServerView = state.kind === "offline" || (state.kind === "loading" && !state.isRetry);
  const shownView = clientViews?.results ?? (showsServerView ? serverView : undefined);
  // The panel always shows: the server's until the client has the catalogue, then disabled
  // (see FilterPanel), since a change couldn't be counted yet.
  const shownFilters = clientViews?.filters ?? serverFilters;
  const isReady = state.kind === "ready";

  // The count (and page) is read out when it changes (T1-14), whichever side rendered it. It
  // starts at the server's, so the hand-over itself is silent: nothing changed for the customer.
  // It waits for the count to settle: typing "thyroid" changes it on most letters, and a count
  // per letter would talk over the letters a screen reader echoes.
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
  useEffect(() => {
    function landedOnOtherEntry() {
      isTypingEntry.current = false;
    }
    globalThis.addEventListener("popstate", landedOnOtherEntry);
    return () => {
      globalThis.removeEventListener("popstate", landedOnOtherEntry);
    };
  }, []);

  const isSlow = state.kind === "loading" && state.isSlow;
  useEffect(() => {
    if (isSlow) announce(SLOW_MESSAGE);
  }, [isSlow, announce]);

  function handleFilterChange(change: FilterChange) {
    if (state.kind !== "ready") return;
    // Read from the address bar, not useSearchParams, so a change made before the last one
    // has rendered still builds on it.
    const current = parseServicesUrl(new URLSearchParams(window.location.search), state.catalogue);
    const query = applyFilterChange(current.query, change, state.catalogue.categories);
    const href = servicesHref({ ...current, query });
    // Nothing changed (a space typed, the same price applied again): no entry, or Back would
    // seem to do nothing.
    if (href === servicesHref(current)) return;
    // Every change adds a history entry, so Back undoes it (T1-10). Typing adds one for the
    // first letter, then replaces it, so Back undoes the whole edit, not each letter.
    const isSearch = change.kind === "search";
    if (isSearch && isTypingEntry.current) globalThis.history.replaceState(null, "", href);
    else globalThis.history.pushState(null, "", href);
    isTypingEntry.current = isSearch;
  }

  function handleRetry() {
    // Read the count out again when the results come back, even if it is the same as before.
    lastAnnounced.current = "";
    retry();
    // The error and its button are about to go; focus waits on the results area instead.
    resultsRef.current?.focus();
  }

  function renderResults() {
    if (shownView) return <ServiceResults view={shownView} />;
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
      {isSlow && (
        <Alert variant="info">
          <AlertDescription>{SLOW_MESSAGE}</AlertDescription>
        </Alert>
      )}
      <ExplorerColumns
        filters={
          <FilterPanel view={shownFilters} isEnabled={isReady} onChange={handleFilterChange} />
        }
      >
        <SortSelect sort={shownFilters.sort} isEnabled={isReady} onChange={handleFilterChange} />
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
    </div>
  );
}
