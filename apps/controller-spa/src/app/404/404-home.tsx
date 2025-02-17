export function NotFoundPage() {
  return (
    <div className="flex items-center justify-center bg-background mt-32">
      <div className="text-center space-y-8 px-4">
        <div className="space-y-4">
          <h1 className="text-8xl font-extrabold tracking-widest text-primary">404</h1>
          <div className="h-2 w-24 bg-primary mx-auto rounded-full"></div>
        </div>

        <div className="space-y-4">
          <p className="text-2xl font-semibold tracking-wide text-foreground">Page Not Found</p>
          <p className="text-muted-foreground">
            Sorry, we couldn't find the page you're looking for.
          </p>
        </div>
      </div>
    </div>
  );
}
