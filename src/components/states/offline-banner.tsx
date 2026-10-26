"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useIsOffline } from "@/lib/api/use-is-offline";

// Shown at the top of a route while the browser is offline or ?mockOffline=1 is set.
// Each route passes its own message (design/HANDOFF.md section 4), because what still works
// offline is different on each screen.
// Polite, as in the design files (they use role="status"; jsx-a11y wants <output> for that role,
// which can't hold the Alert's block content, so aria-live gives the same behaviour).
// Not an assertive alert: it can appear just after the page loads, and an alert would cut into
// whatever the screen reader is reading.
export function OfflineBanner({ message }: Readonly<{ message: string }>) {
  const offline = useIsOffline();
  if (!offline) return null;

  return (
    <Alert variant="warning" aria-live="polite" aria-atomic="true">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
