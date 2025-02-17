export function NotFoundPage() {
  return (
    <div className="bg-background mt-32 flex items-center justify-center">
      <div className="space-y-8 px-4 text-center">
        <div className="space-y-4">
          <h1 className="text-primary text-8xl font-extrabold tracking-widest">404</h1>
          <div className="bg-primary mx-auto h-2 w-24 rounded-full"></div>
        </div>

        <div className="space-y-4">
          <p className="text-foreground text-2xl font-semibold tracking-wide">Page Not Found</p>
          <p className="text-muted-foreground">
            Sorry, we couldn&apos;t find the page you&apos;re looking for.
          </p>
        </div>
      </div>
    </div>
  );
}
