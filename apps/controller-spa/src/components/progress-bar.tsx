import type { ReactNode } from "react";

interface ProgressBarProps {
  steps: Array<{
    label: string;
    children: ReactNode;
    description?: string;
  }>;
  currentStep: number;
}

export function ProgressBar({ steps, currentStep }: ProgressBarProps) {
  return (
    <div className="relative flex items-center">
      {/* Connecting lines */}
      <div className="absolute left-0 right-0 top-5 h-[2px] bg-gray-200 dark:bg-gray-700" />
      <div className="w-1" /> {/* Left spacer */}
      {steps.map((step, index) => (
        <div key={step.label} className="relative z-10 flex flex-1 flex-col items-center">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              index <= currentStep ? "bg-blue-500 text-white" : "bg-gray-300 dark:bg-gray-700"
            }`}
          >
            {step.children}
          </div>
          <div className="mt-2 flex flex-col items-center text-center">
            <span
              className={`text-sm ${
                index <= currentStep
                  ? "font-medium text-blue-500"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {step.label}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{step.description}</span>
          </div>
        </div>
      ))}
      <div className="w-1" /> {/* Right spacer */}
    </div>
  );
}
