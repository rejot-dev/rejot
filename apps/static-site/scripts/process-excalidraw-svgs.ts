import * as fs from "node:fs/promises";

import { load } from "cheerio";

/**
 * This script processes SVG files by replacing font families.
 * Usage: npx tsx process-excalidraw-svgs.ts [--monospace] <file1.svg> <file2.svg> ...
 * Exits with status code 0 only if no files were changed.
 */

const FONT_IMPORT = `@font-face {
  font-family: "Atkinson Hyperlegible";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/atkinson-regular.woff") format("woff");
}`;

const ATKINSON_FONT_FAMILY = "Atkinson Hyperlegible";
const MONOSPACE_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

let filesChanged = false;
const args = process.argv.slice(2);
const useMonospace = args.includes("--monospace");
const filesToProcess = args.filter((arg) => !arg.startsWith("--"));

if (filesToProcess.length === 0) {
  console.error("Error: No files provided");
  console.error(
    "Usage: npx tsx process-excalidraw-svgs.ts [--monospace] <file1.svg> <file2.svg> ...",
  );
  process.exit(1);
}

const targetFontFamily = useMonospace ? MONOSPACE_FONT_FAMILY : ATKINSON_FONT_FAMILY;

async function processSvgFile(filePath: string): Promise<void> {
  try {
    const content = await fs.readFile(filePath, "utf-8");

    if (!content.includes("excalidraw")) {
      return;
    }

    if (
      (useMonospace && content.includes("monospace")) ||
      (!useMonospace && content.includes("Atkinson"))
    ) {
      return;
    }

    const $ = load(content, { xmlMode: true });

    // Store initial state
    const originalContent = $.xml();

    // Remove all style elements and style attributes
    $("style").remove();
    $("[style]").removeAttr("style");

    // Add font import if using Atkinson
    if (!useMonospace) {
      $("svg").prepend(`<style>${FONT_IMPORT}</style>`);
    }

    // Replace font-family attributes
    $("[font-family]").attr("font-family", targetFontFamily);

    // Get new state
    const newContent = $.xml();

    // Only write and log if content actually changed
    if (originalContent !== newContent) {
      await fs.writeFile(filePath, newContent);
      console.log(`Processed: ${filePath}`);
      filesChanged = true;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

Promise.all(filesToProcess.map((file) => processSvgFile(file)))
  .then(() => {
    if (filesChanged) {
      process.exit(1);
    } else {
      console.log("No files were changed.");
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
