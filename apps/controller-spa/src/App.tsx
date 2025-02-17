import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignedOut } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";

// Css
import "./app.css";

// Other local code
import { DashboardLayout } from "./app/dashboard/dashboard-layout.tsx";
import { DashboardHome } from "./app/dashboard/dashboard-home.tsx";
import { SystemHome } from "./app/system/system-home.tsx";
import { SystemNew } from "./app/system/system-new.tsx";
import { DataStoreNew } from "./app/system/data-store/data-store-new.tsx";
import { ThemeProvider, useTheme } from "./components/theme-provider.tsx";
import { LoginHome } from "./app/login/login-home.tsx";
import type { ReactNode } from "react";
import { NotFoundPage } from "./app/404/404-home.tsx";
import { OnboardingHome } from "./app/onboarding/onboarding-home.tsx";
import { useClerkPublicMetadata } from "./data/clerk/clerk-meta.data.ts";
import { ConnectionOverview } from "./app/connection/connection-overview.tsx";
import { ConnectionNew } from "./app/connection/connection-new.tsx";
import { ConnectionNewPostgres } from "./app/connection/connection-new-postgres.tsx";
import { ConnectionDetail } from "./app/connection/connection-detail.tsx";
import { SchemaTableDetail } from "./app/connection/schema-table-detail.tsx";

const PUBLISHABLE_KEY: string | undefined = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const queryClient = new QueryClient();

function ClerkProviderWithTheme({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (!PUBLISHABLE_KEY) {
    throw new Error("Missing Publishable Key");
  }

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      appearance={{
        baseTheme: isDark ? dark : undefined,
      }}
    >
      {children}
    </ClerkProvider>
  );
}

function SignedInAndOnboarded({ children }: { children: ReactNode }) {
  const metadata = useClerkPublicMetadata();

  if (!metadata) {
    return null;
  }

  if (!metadata.finishedOnboarding) {
    return null;
  }

  return children;
}

function SignedInAndNotOnboarded({ children }: { children: ReactNode }) {
  const metadata = useClerkPublicMetadata();

  if (!metadata) {
    return null;
  }

  if (metadata.finishedOnboarding) {
    return null;
  }

  return children;
}

export function App() {
  return (
    <ThemeProvider>
      <ClerkProviderWithTheme>
        <QueryClientProvider client={queryClient}>
          <SignedOut>
            <LoginHome />
          </SignedOut>
          <SignedInAndOnboarded>
            <BrowserRouter>
              <Routes>
                <Route element={<DashboardLayout />}>
                  <Route index element={<DashboardHome />} />
                  <Route path="/systems/new" element={<SystemNew />} />
                  <Route path="/systems/:systemSlug" element={<SystemHome />} />
                  <Route path="/systems/:systemSlug/data-stores">
                    <Route path="new" element={<Navigate to="select-connection" replace />} />
                    <Route path="new/:step" element={<DataStoreNew />} />
                  </Route>
                  <Route path="/connections" element={<ConnectionOverview />} />
                  <Route path="/connections/new" element={<ConnectionNew />} />
                  <Route path="/connections/new/postgres" element={<ConnectionNewPostgres />} />
                  <Route path="/connections/:connectionSlug" element={<ConnectionDetail />} />
                  <Route
                    path="/connections/:connectionSlug/tables/:tableId"
                    element={<SchemaTableDetail />}
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SignedInAndOnboarded>
          <SignedInAndNotOnboarded>
            <BrowserRouter>
              <Routes>
                <Route element={<DashboardLayout />}>
                  <Route index element={<OnboardingHome />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SignedInAndNotOnboarded>
        </QueryClientProvider>
      </ClerkProviderWithTheme>
    </ThemeProvider>
  );
}
