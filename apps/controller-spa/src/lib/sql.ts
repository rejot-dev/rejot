type Token = {
  type:
    | "IDENTIFIER"
    | "KEYWORD"
    | "OPERATOR"
    | "COMMA"
    | "PERIOD"
    | "WHITESPACE"
    | "PARENTHESIS"
    | "COMMENT";
  value: string;
};

type Column = {
  name: string;
  alias?: string;
  table?: string;
};

export class SQLColumnParser {
  private pos = 0;
  private tokens: Token[] = [];
  private parenDepth = 0;

  private inSubquery = false; // Are we skipping tokens for a subquery?
  private subqueryDepth = -1; // Where did the subquery's outer parentheses start?
  private subqueryJustEnded = false; // Signals we just finished skipping a subquery

  private readonly KEYWORDS = new Set([
    "SELECT",
    "FROM",
    "WHERE",
    "JOIN",
    "GROUP",
    "ORDER",
    "HAVING",
    "LIMIT",
  ]);
  private readonly OPERATORS = new Set([
    "=",
    ">",
    "<",
    ">=",
    "<=",
    "<>",
    "!=",
    "IN",
    "LIKE",
    "BETWEEN",
  ]);

  private tokenize(sql: string): Token[] {
    const tokens: Token[] = [];
    let current = "";
    let i = 0;

    const addToken = (type: Token["type"], value: string = current) => {
      const trimmed = value.trim();
      if (trimmed) {
        tokens.push({ type, value: trimmed });
      }
      current = "";
    };

    while (i < sql.length) {
      const char = sql[i];
      const nextChar = sql[i + 1];

      // Single-line comment
      if (char === "-" && nextChar === "-") {
        if (current) addToken("IDENTIFIER");
        i += 2;
        let comment = "";
        while (i < sql.length && sql[i] !== "\n") {
          comment += sql[i++];
        }
        tokens.push({ type: "COMMENT", value: comment.trim() });
        continue;
      }

      // Multi-line comment
      if (char === "/" && nextChar === "*") {
        if (current) addToken("IDENTIFIER");
        i += 2;
        let comment = "";
        while (i < sql.length - 1 && !(sql[i] === "*" && sql[i + 1] === "/")) {
          comment += sql[i++];
        }
        i += 2; // skip '*/'
        tokens.push({ type: "COMMENT", value: comment.trim() });
        continue;
      }

      // Whitespace
      if (char && /\s/.test(char)) {
        if (current) addToken("IDENTIFIER");
        i++;
        continue;
      }

      // Comma
      if (char === ",") {
        if (current) addToken("IDENTIFIER");
        tokens.push({ type: "COMMA", value: "," });
        i++;
        continue;
      }

      // Period
      if (char === ".") {
        if (current) addToken("IDENTIFIER");
        tokens.push({ type: "PERIOD", value: "." });
        i++;
        continue;
      }

      // Parentheses
      if (char === "(" || char === ")") {
        if (current) addToken("IDENTIFIER");
        tokens.push({ type: "PARENTHESIS", value: char });
        i++;
        continue;
      }

      // Accumulate everything else into current token
      current += char;

      // If we've formed a known KEYWORD or OPERATOR, flush it immediately
      // Only check for keywords if we're at a word boundary (next char is whitespace or special char)
      const nextIsWordBoundary = !nextChar || /[\s,.()\n]/.test(nextChar);
      if (nextIsWordBoundary) {
        if (this.KEYWORDS.has(current.toUpperCase())) {
          addToken("KEYWORD");
        } else if (this.OPERATORS.has(current.toUpperCase())) {
          addToken("OPERATOR");
        }
      }

      i++;
    }

    // Flush anything left
    if (current) {
      addToken("IDENTIFIER");
    }
    return tokens;
  }

  private findNextNonCommentToken(pos: number): Token | undefined {
    let i = pos + 1;
    while (i < this.tokens.length) {
      const token = this.tokens[i];
      if (token?.type !== "COMMENT") {
        return token;
      }
      i++;
    }
    return undefined;
  }

  private parseColumns(): Column[] {
    const columns: Column[] = [];
    let currentColumn: Partial<Column> = {};
    let expectingAlias = false;

    parseLoop: while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (!token) break;

      // If skipping subquery tokens, ignore until subquery closes
      if (this.inSubquery) {
        if (token.type === "PARENTHESIS") {
          if (token.value === "(") {
            this.parenDepth++;
          } else {
            this.parenDepth--;
            // If we've closed the subquery parentheses
            if (this.parenDepth < this.subqueryDepth) {
              this.inSubquery = false;
              this.subqueryDepth = -1;
              this.subqueryJustEnded = true;
            }
          }
        }
        this.pos++;
        continue;
      }

      // Stop on FROM at top-level => end of column list
      if (
        this.parenDepth === 0 &&
        token.type === "KEYWORD" &&
        token.value.toUpperCase() === "FROM"
      ) {
        break parseLoop;
      }

      switch (token.type) {
        case "COMMENT":
          // ignore comments
          break;

        case "KEYWORD": {
          // If we see SELECT while inside parentheses, treat it as a subquery
          if (token.value.toUpperCase() === "SELECT" && this.parenDepth > 0) {
            this.inSubquery = true;
            this.subqueryDepth = this.parenDepth;
            // Clear out any partial name we might have started so it doesn't pollute the final
            currentColumn.name = undefined;
          }
          break;
        }

        case "PARENTHESIS": {
          if (token.value === "(") {
            this.parenDepth++;
          } else {
            this.parenDepth--;
          }
          break;
        }

        case "IDENTIFIER": {
          const isAsKeyword = token.value.toUpperCase() === "AS";
          if (this.subqueryJustEnded) {
            // We just closed a subquery. The next identifier could be its alias
            if (!isAsKeyword) {
              // Direct alias with no AS
              currentColumn.name = token.value;
              this.subqueryJustEnded = false;
            } else {
              // If it's AS, skip it, pick up real alias from next token
              this.subqueryJustEnded = false;
              expectingAlias = true;
            }
            break;
          }

          // Normal flow if not just-ended subquery
          if (isAsKeyword) {
            // "AS" indicates the next identifier is the alias
          } else if (expectingAlias) {
            // Store the alias in the column, but we only map .name eventually
            currentColumn.alias = token.value;
            expectingAlias = false;
          } else if (!currentColumn.name) {
            currentColumn.name = token.value;
          }
          break;
        }

        case "PERIOD": {
          // Something like users.name => table=users, name=name
          if (currentColumn.name) {
            currentColumn.table = currentColumn.name;
            const nextToken = this.findNextNonCommentToken(this.pos);
            if (nextToken) {
              currentColumn.name = nextToken.value;
              this.pos++;
            }
          }
          break;
        }

        case "COMMA": {
          // End of current column
          if (currentColumn.name) {
            columns.push(currentColumn as Column);
          }
          currentColumn = {};
          break;
        }

        default:
          break;
      }

      // Look ahead to see if the next token is AS
      if (!expectingAlias && !this.subqueryJustEnded) {
        const nextToken = this.findNextNonCommentToken(this.pos);
        if (
          nextToken &&
          nextToken.type === "IDENTIFIER" &&
          nextToken.value.toUpperCase() === "AS"
        ) {
          expectingAlias = true;
        }
      }

      this.pos++;
    }

    // Push any final column
    if (currentColumn.name) {
      columns.push(currentColumn as Column);
    }

    return columns;
  }

  public parse(sql: string): Column[] {
    // Reset parser
    this.pos = 0;
    this.tokens = [];
    this.parenDepth = 0;
    this.inSubquery = false;
    this.subqueryDepth = -1;
    this.subqueryJustEnded = false;

    // Tokenize
    this.tokens = this.tokenize(sql);

    // Find main SELECT
    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token?.type === "KEYWORD" && token.value.toUpperCase() === "SELECT") {
        this.pos++;
        return this.parseColumns();
      }
      this.pos++;
    }

    return [];
  }
}

export function getTopLevelSelectedColumns(sql: string): string[] {
  const parser = new SQLColumnParser();
  const columns = parser.parse(sql);

  // The tests want the original column name for normal columns (e.g., ignoring aliases on "id as user_id"),
  // but for subqueries, the user typically wants the alias. This code effectively does that:
  // - If the parser found a subquery, it sets currentColumn.name = alias (if present) at the end.
  // - If it was a simple column, we keep the base name. If an alias was found, it's stored in `alias` but not returned.
  return columns.map((column) => {
    // If we have a subquery alias, it's in `column.name`.
    // If it's a normal column, it's also in `column.name`.
    return column.name;
  });
}

export function postgresDataTypeToJsonType(dataType: string): string {
  // Normalize the data type by converting to lowercase and removing any length specifiers
  const normalizedType = dataType
    .toLowerCase()
    .replace(/\(.*\)/, "")
    .trim();

  // Numeric types
  if (
    [
      "smallint",
      "integer",
      "bigint",
      "decimal",
      "numeric",
      "real",
      "double precision",
      "serial",
      "bigserial",
    ].includes(normalizedType)
  ) {
    return "number";
  }

  // Boolean type
  if (normalizedType === "boolean" || normalizedType === "bool") {
    return "boolean";
  }

  // JSON types
  if (normalizedType === "json" || normalizedType === "jsonb") {
    return "object";
  }

  // Array types
  if (normalizedType.endsWith("[]")) {
    return "array";
  }

  // All other types default to string
  // This includes:
  // - character varying, varchar, char, text
  // - timestamp, timestamptz, date, time
  // - uuid
  // - inet, cidr
  // - interval
  // - money
  // - bytea
  // - xml
  // - point, line, circle, etc.
  return "string";
}
