import { SignIn } from "@clerk/clerk-react";

export function LoginHome() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="flex flex-col items-center">
        <SignIn />
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <a
            href="https://rejot.dev/privacy-policy"
            className="hover:text-gray-700 dark:hover:text-gray-300"
          >
            Privacy Policy
          </a>
          <span className="mx-2">•</span>
          <a
            href="https://rejot.dev/terms-of-use"
            className="hover:text-gray-700 dark:hover:text-gray-300"
          >
            Terms of Use
          </a>
        </div>
      </div>
    </div>
  );
}
