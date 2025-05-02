import * as fs from "node:fs/promises";
import * as path from "node:path";

const svgFilePath = path.resolve(__dirname, "../apps/static-site/public/microservices.svg");

// Define the animation element string
const animationString = `
        <animate
          attributeName="stroke-dashoffset"
          values="100;0"
          dur="60s"
          calcMode="linear"
          repeatCount="indefinite" />`;

async function addAnimationToSvgPathsDirectly(filePath: string): Promise<void> {
  try {
    console.log(`Reading SVG file: ${filePath}`);
    let svgContent = await fs.readFile(filePath, "utf-8");

    const groupStartTag = 'id="request-flow"';
    const groupEndTag = "</g>";

    const groupStartIndex = svgContent.indexOf(groupStartTag);
    if (groupStartIndex === -1) {
      console.warn(
        'Could not find the start of target group <g id="request-flow">. No animations will be added.',
      );
      return;
    }

    // Find the end of the start tag '>'
    const groupStartTagEndIndex = svgContent.indexOf(">", groupStartIndex);
    if (groupStartTagEndIndex === -1) {
      console.warn('Could not find the end of the start tag for <g id="request-flow">.');
      return;
    }

    // Find the corresponding closing </g> tag *after* the opening tag ends
    // This is a simple search, might break with nested identical groups, but okay for this structure.
    const groupEndIndex = svgContent.indexOf(groupEndTag, groupStartTagEndIndex);
    if (groupEndIndex === -1) {
      console.warn('Could not find the end of target group </g> for "request-flow".');
      return;
    }

    // Extract the content of the target group
    const groupContent = svgContent.substring(groupStartTagEndIndex + 1, groupEndIndex);
    let modifiedGroupContent = groupContent;
    let animationsAdded = 0;

    // Regex to find path tags (simplified, may need adjustments for complex attributes)
    // It captures the full path tag
    const pathRegex = /<path[^>]*?\/>|<path[^>]*?>/g;

    // Define an interface for the match structure
    interface PathMatch {
      tag: string;
      index: number;
    }

    let match: RegExpExecArray | null;
    const matches: PathMatch[] = []; // Explicitly type the array

    // Collect all matches first to avoid issues with modifying the string during iteration
    while ((match = pathRegex.exec(groupContent)) !== null) {
      // Ensure match[0] (the full matched tag) exists and is a string
      if (typeof match[0] === "string") {
        matches.push({ tag: match[0], index: match.index });
      }
    }

    // Iterate backwards through matches to avoid index shifting during replacement
    for (let i = matches.length - 1; i >= 0; i--) {
      const { tag: pathTag, index: pathIndex } = matches[i]; // Types should now be correct
      const relativePathIndex = pathIndex; // Index relative to groupContent

      // Condition 1: Check for stroke-dasharray attribute or style
      const hasStrokeDasharray = /stroke-dasharray:[^;"]+|stroke-dasharray=("[^"]*"|'[^"]*')/.test(
        pathTag,
      );

      // Condition 2: Check if our specific animation already exists (simple check)
      const hasExistingAnimation = pathTag.includes('attributeName="stroke-dashoffset"');

      if (hasStrokeDasharray && !hasExistingAnimation) {
        let modifiedPathTag;
        if (pathTag.endsWith("/>")) {
          // Convert self-closing tag: <path .../> -> <path ...>animation</path>
          modifiedPathTag = pathTag.slice(0, -2) + ">" + animationString + "</path>";
        } else if (pathTag.endsWith(">")) {
          // Inject into non-self-closing tag: <path ...> -> <path ...>animation</path>
          // This assumes the path is empty or we append before potential content ending with </path>
          // A safer bet for potentially non-empty paths would require finding the specific </path>
          // For now, we'll adopt the same strategy as self-closing: assume we can wrap it.
          // If paths *truly* had content, this would be incorrect.
          modifiedPathTag = pathTag + animationString + "</path>"; // This might be wrong if path wasn't empty.
          // A slightly safer approach for non-self-closing, assuming they are empty:
          // modifiedPathTag = pathTag.slice(0, -1) + '>' + animationString + '</path>'; // Replace '>' with '>animation</path>'

          // Let's go with the replacement assuming it's effectively self-closing or empty:
          modifiedPathTag = pathTag.slice(0, -1) + ">" + animationString + "</path>";
        } else {
          // Should not happen with the regex, but include for safety
          console.warn(`Skipping path with unexpected ending: ${pathTag}`);
          continue;
        }

        // Replace the original path tag in the modifiedGroupContent string
        modifiedGroupContent =
          modifiedGroupContent.substring(0, relativePathIndex) +
          modifiedPathTag +
          modifiedGroupContent.substring(relativePathIndex + pathTag.length);

        animationsAdded++;
        console.log(`Added animation to a path within the group.`);
      }
    }

    if (animationsAdded > 0) {
      console.log(`Added animation to ${animationsAdded} paths within the group.`);
      // Reconstruct the full SVG content
      svgContent =
        svgContent.substring(0, groupStartTagEndIndex + 1) +
        modifiedGroupContent +
        svgContent.substring(groupEndIndex);

      console.log("Serializing modified SVG...");
      console.log(`Writing modified SVG back to: ${filePath}`);
      await fs.writeFile(filePath, svgContent, "utf-8");
      console.log("SVG file updated successfully.");
    } else {
      console.log("No paths within the target group required animation addition.");
    }
  } catch (error) {
    console.error("Error processing SVG file:", error);
    process.exit(1); // Exit with error code
  }
}

addAnimationToSvgPathsDirectly(svgFilePath);
