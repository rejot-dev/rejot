import { SignIn } from "@clerk/clerk-react";

export function LoginHome() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <SignIn />
    </div>
  );
}
