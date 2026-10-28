// The frame around /services, shared by page.tsx and loading.tsx, so the heading stays put
// while the first view loads.
export default function ServicesLayout({ children }: Readonly<LayoutProps<"/services">>) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6">
      <h1 className="text-2xl font-semibold md:text-3xl">Services</h1>
      {children}
    </div>
  );
}
