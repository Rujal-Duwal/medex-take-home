interface EmptyStateProps {
  // "No services match"
  title: string;
  // Why it is empty: "Try removing a filter. Your other choices will stay as they are."
  description: string;
  // The way out, as a Button or a Link: "Clear all filters", "Browse services".
  action?: React.ReactNode;
}

// Not an alert: an empty result is a normal answer, and the result count is announced
// through the shared live region by the screen that shows it.
export function EmptyState({ title, description, action }: Readonly<EmptyStateProps>) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-text-secondary">{description}</p>
      {action}
    </div>
  );
}
