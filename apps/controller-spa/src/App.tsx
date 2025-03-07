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
import { DataStoreOverview } from "./app/system/data-store/data-store-overview.tsx";
import { ThemeProvider, useTheme } from "./components/theme-provider.tsx";
import { LoginHome } from "./app/login/login-home.tsx";
import type { ReactNode } from "react";
import { NotFoundPage } from "./app/404/404-home.tsx";
import { OnboardingHome } from "./app/onboarding/onboarding-home.tsx";
import { useClerkPublicMetadata } from "./data/clerk/clerk-meta.data.ts";
import { ConnectionOverview } from "./app/connection/connection-overview.tsx";
import { ConnectionNew } from "./app/connection/connection-new.tsx";
import { ConnectionDetail } from "./app/connection/connection-detail.tsx";
import { SchemaTableDetail } from "./app/connection/schema-table-detail.tsx";
import { PublicSchemaOverview } from "./app/public-schema/public-schema-overview.tsx";
import { PublicSchemaNew } from "./app/public-schema/public-schema-new.tsx";
import { PublicSchemaDetail } from "./app/public-schema/public-schema-detail.tsx";
import { ConsumerSchemaOverview } from "./app/consumer-schema/consumer-schema-overview.tsx";
import { ConsumerSchemaNew } from "./app/consumer-schema/consumer-schema-new.tsx";
import { ConsumerSchemaDetail } from "./app/consumer-schema/consumer-schema-detail.tsx";
import { DataStoreDetail } from "./app/system/data-store/data-store-detail.tsx";
import { SchemaTableOverview } from "./app/system/data-store/table-overview/overview.tsx";

const PUBLISHABLE_KEY: string | undefined = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const queryClient = new QueryClient();

function ClerkProviderWithTheme({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const isDark =
    theme === "dark" ||
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
                  <Route path="/systems">
                    <Route path="new" element={<SystemNew />} />
                    <Route path=":systemSlug">
                      <Route index element={<SystemHome />} />
                      <Route path="data-stores">
                        <Route index element={<DataStoreOverview />} />
                        <Route path="new" element={<Navigate to="select-connection" replace />} />
                        <Route path="new/:step" element={<DataStoreNew />} />
                        <Route path=":dataStoreSlug" element={<DataStoreDetail />} />
                        <Route path=":dataStoreSlug/tables" element={<SchemaTableOverview />} />
                      </Route>
                    </Route>
                  </Route>
                  <Route path="/connections">
                    <Route index element={<ConnectionOverview />} />
                    <Route path="new">
                      <Route index element={<Navigate to="select-type" replace />} />
                      <Route path=":step" element={<ConnectionNew />} />
                    </Route>
                    <Route path=":connectionSlug">
                      <Route index element={<ConnectionDetail />} />
                      <Route path="tables/:tableId" element={<SchemaTableDetail />} />
                    </Route>
                  </Route>
                  <Route path="/public-schemas">
                    <Route index element={<PublicSchemaOverview />} />
                    <Route path="new">
                      <Route index element={<Navigate to="select-data-store" replace />} />
                      <Route path=":step" element={<PublicSchemaNew />} />
                    </Route>
                    <Route path=":publicSchemaId" element={<PublicSchemaDetail />} />
                  </Route>
                  <Route path="/consumer-schemas">
                    <Route index element={<ConsumerSchemaOverview />} />
                    <Route path="new">
                      <Route index element={<Navigate to="select-data-store" replace />} />
                      <Route path=":step" element={<ConsumerSchemaNew />} />
                    </Route>
                    <Route path=":consumerSchemaId" element={<ConsumerSchemaDetail />} />
                  </Route>
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
