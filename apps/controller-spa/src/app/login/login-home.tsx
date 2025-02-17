import { SignIn } from "@clerk/clerk-react";

export function LoginHome() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
      <SignIn />
    </div>
  );
}
