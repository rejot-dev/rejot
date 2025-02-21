import type { Logger } from "drizzle-orm/logger";

export function formatSql(queryWithParams: { sql: string; params: unknown[] }): string {
  const { sql: query, params } = queryWithParams;

  // Replace $1, $2, etc with actual parameter values
  let interpolatedQuery = query;
  params.forEach((param, index) => {
    const placeholder = `$${index + 1}`;
    const displayValue = typeof param === "string" ? `'${param}'` : param;
    interpolatedQuery = interpolatedQuery.replace(placeholder, String(displayValue));
  });

  const keywordsToInsertNewline = [
    "SELECT",
    "FROM",
    "WHERE",
    "JOIN",
    "LEFT",
    "RIGHT",
    "INNER",
    "OUTER",
    "AND",
    "OR",
    "ORDER BY",
    "GROUP BY",
    "HAVING",
    "LIMIT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "INTO",
    "VALUES",
    "SET",
    "WITH",
    "DEFAULT",
    "RETURNING",
  ];

  // Format the interpolated query
  const formattedQuery = (() => {
    // Normalize and uppercase SQL keywords as before
    const queryNormalized = interpolatedQuery
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(new RegExp(`\\b(${keywordsToInsertNewline.join("|")})\\b`, "gi"), (match) =>
        match.toUpperCase(),
      )
      .replace(new RegExp(`\\s*(${keywordsToInsertNewline.join("|")})\\s+`, "gi"), "\n$1 ");

    const lines = queryNormalized.split("\n");
    let indentLevel = 0;
    const indentedLines = lines.map((line) => {
      const trimmed = line.trim();
      // If the line starts with a closing parenthesis,
      // reduce the indentation for that line.
      let currentIndent = indentLevel;
      if (trimmed.startsWith(")")) {
        currentIndent = Math.max(currentIndent - 1, 0);
      }
      // Apply the current indent to the trimmed line.
      const indentedLine = "  ".repeat(currentIndent) + trimmed;

      // Count '(' and ')' occurrences in the line and update indent level.
      const openCount = (trimmed.match(/\(/g) || []).length;
      const closeCount = (trimmed.match(/\)/g) || []).length;
      indentLevel = Math.max(indentLevel + (openCount - closeCount), 0);

      return "  " + indentedLine;
    });

    return indentedLines.join("\n");
  })();

  return formattedQuery;
}

export class SqlFormattingLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    console.log("SQL Query:", formatSql({ sql: query, params }));
  }
}
