import { ResultsSkeleton } from "@/features/services/components/results-skeleton";

// Shown while the server prepares the first view of /services. That is instant unless the URL
// has ?mockDelay, which is how a reviewer sees the loading state. layout.tsx draws the heading.
export default function ServicesLoading() {
  return (
    <section aria-label="Results" aria-busy="true" className="flex flex-col gap-4">
      <ResultsSkeleton />
    </section>
  );
}
