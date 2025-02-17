 

import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

import process from "node:process";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  if (env["VITEST_VSCODE"]) {
    return {
      plugins: [react(), tsconfigPaths()],
    };
  }

  if (!env["CONTROLLER_API_URL"] || !env["VITE_CLERK_PUBLISHABLE_KEY"]) {
    throw new Error("CONTROLLER_API_URL or VITE_CLERK_PUBLISHABLE_KEY env var not set.");
  }

  console.info(
    `Proxying websocket to -> ws://${env["CONTROLLER_API_URL"]}/_ws`,
  );

  return {
    plugins: [react(), tsconfigPaths()],
    server: {
      proxy: {
        "/api": {
          target: env["CONTROLLER_API_URL"],
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/_ws": {
          target: `ws://${env["CONTROLLER_API_URL"]}/_ws`,
          ws: true,
          rewrite: (path) => path.replace(/^\/_ws/, ""),
        },
      },
    },
  };
});
