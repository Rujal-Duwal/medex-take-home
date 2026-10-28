"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ErrorState } from "@/components/states/error-state";
import { OfflineBanner } from "@/components/states/offline-banner";
import { useAnnounce } from "@/lib/a11y/live-announcer";
import { runQuery } from "../engine";
import { toResultsView, type ResultsView } from "../results-view";
import { useCatalogue } from "../use-catalogue";
import { parseServicesUrl } from "../url-codec";
import { ResultsSkeleton } from "./results-skeleton";
import { ServiceResults } from "./service-results";

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
// The filters (WBS 3.6) will change the URL; this re-renders from it.
export function ServiceExplorer({ serverView }: Readonly<{ serverView: ResultsView }>) {
  const { state, retry } = useCatalogue();
  const searchParams = useSearchParams();
  const announce = useAnnounce();
  const resultsRef = useRef<HTMLElement>(null);

  const clientView = useMemo(() => {
    if (state.kind !== "ready") return undefined;
    const urlState = parseServicesUrl(searchParams, state.catalogue);
    return toResultsView(runQuery(state.catalogue, urlState.query), urlState);
  }, [state, searchParams]);

  // The results on screen: the client's once it has the catalogue; the server's on a first
  // load and offline; none while an error or the retry skeleton shows.
  const showsServerView = state.kind === "offline" || (state.kind === "loading" && !state.isRetry);
  const shownView = clientView ?? (showsServerView ? serverView : undefined);

  // The count (and page) is read out when it changes (T1-14), whichever side rendered it. It
  // starts at the server's, so the hand-over itself is silent: nothing changed for the customer.
  const lastAnnounced = useRef(serverView.announcement);
  useEffect(() => {
    if (shownView === undefined || shownView.announcement === lastAnnounced.current) return;
    lastAnnounced.current = shownView.announcement;
    announce(shownView.announcement);
  }, [shownView, announce]);

  const isSlow = state.kind === "loading" && state.isSlow;
  useEffect(() => {
    if (isSlow) announce(SLOW_MESSAGE);
  }, [isSlow, announce]);

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
    </div>
  );
}
