import { useEffect, useState } from "react";
import { createCurrentUser, updateClerkMetadata } from "@/data/clerk/clerk.data";
import { createOrganization, getOrganizations } from "@/data/organizations/organizations.data";
import { useUser } from "@clerk/clerk-react";

type CompletedItem = {
  title: string;
  description: string;
};

export function OnboardingHome() {
  const clerk = useUser();

  const [status, setStatus] = useState("Creating your account...");
  const [isDone, setIsDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [completedItems, setCompletedItems] = useState<CompletedItem[]>([]);

  useEffect(() => {
    async function setupAccount() {
      try {
        // Step 1: Create user
        setStatus("Creating your account...");
        const userResult = await createCurrentUser();
        if (userResult.status === "error") {
          throw new Error("Failed to create user account");
        }
        const user = userResult.data;
        if (!user?.firstName || !user?.lastName) {
          throw new Error("Missing user information");
        }
        setCompletedItems((prev) => [...prev, {
          title: "Account Created",
          description: `Welcome, ${user.firstName} ${user.lastName}!`,
        }]);

        // Step 2: Check for organizations
        setStatus("Checking for organizations...");
        const organizationsResponse = await getOrganizations();
        if (organizationsResponse.status === "error") {
          throw new Error("Failed to check organizations");
        }

        let organizationCode: string;
        if (!organizationsResponse.data || organizationsResponse.data.length === 0) {
          // Create organization if none exist
          setStatus("Creating your personal organization...");
          const orgName = `${user.firstName} ${user.lastName}'s personal org`;
          const orgResult = await createOrganization(orgName);
          if (orgResult.status === "error") {
            throw new Error("Failed to create organization");
          }
          organizationCode = orgResult.data.code;
          setCompletedItems((prev) => [...prev, {
            title: "Organization Created",
            description: orgName,
          }]);
        } else if (organizationsResponse.data[0]?.code) {
          organizationCode = organizationsResponse.data[0].code;
          const orgName = organizationsResponse.data[0].name ?? "Unknown Organization";
          setStatus(`Using existing organization: ${orgName}`);
          setCompletedItems((prev) => [...prev, {
            title: "Organization Connected",
            description: `You've been connected to the existing organization: ${orgName}`,
          }]);
        } else {
          throw new Error("Invalid organization data");
        }

        // Step 3: Update metadata
        setStatus("Finalizing your account setup...");
        const metadataResult = await updateClerkMetadata({
          organizationIds: [organizationCode],
          selectedOrganizationId: organizationCode,
          finishedOnboarding: true,
        });
        if (metadataResult.status === "error") {
          throw new Error("Failed to update metadata");
        }
        setCompletedItems((prev) => [...prev, {
          title: "Setup Completed",
          description: "Your account is ready to use",
        }]);
        setStatus("Setup complete! Redirecting you to your dashboard...");
        setIsDone(true);

        await clerk.user?.reload();
      } catch (error) {
        setHasError(true);
        setStatus(`Error: ${error instanceof Error ? error.message : "Something went wrong"}`);
      }
    }

    setupAccount();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black flex items-center justify-center">
      <div className="max-w-xl w-full mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="flex flex-col space-y-6">
            {/* Completed Items */}
            <div className="space-y-4">
              {completedItems.map((item, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <svg
                      className="w-4 h-4 text-green-600 dark:text-green-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{item.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Current Status */}
            {!isDone && !hasError && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="h-3 w-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="h-3 w-3 bg-blue-500 rounded-full animate-bounce" />
                </div>
                <p className="text-gray-600 dark:text-gray-300">{status}</p>
              </div>
            )}

            {/* Error State */}
            {hasError && (
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                  <svg
                    className="w-4 h-4 text-red-600 dark:text-red-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <p className="text-red-600 dark:text-red-300">{status}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
