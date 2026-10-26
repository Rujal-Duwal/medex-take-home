import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  // What failed, in plain words: "We couldn't load services".
  title: string;
  // What it means and that their choices are kept: "Something went wrong on our side. Your filters are saved."
  description: string;
  // Re-runs the failed request. The caller keeps everything the customer chose.
  onRetry: () => void;
}

// role="alert": a failed load is read out straight away.
// Pressing "Try again" usually unmounts this, so the screen that shows it must move focus
// somewhere sensible (for example its results heading with tabIndex={-1}), not leave it on <body>.
export function ErrorState({ title, description, onRetry }: Readonly<ErrorStateProps>) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      <Button variant="outline" className="mt-3 justify-self-start" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  );
}
