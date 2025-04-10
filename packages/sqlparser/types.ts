// Token types
export interface Token {
  Word?: {
    value: string;
    quote_style: string | null;
    keyword: string;
  };
  // Add other token types as needed
}

export interface AttachedToken {
  token: Token;
  span: Span;
}

export interface Span {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  column: number;
}

export interface Ident {
  value: string;
  quote_style: string | null;
  span: Span;
}

export interface ObjectName {
  value: Ident[];
}

export interface DollarQuotedString {
  value: string;
  tag: string | null;
}

export interface ValueWithSpan {
  value: Value;
  span: Span;
}

export type Value =
  | { Number: [string, boolean] }
  | { SingleQuotedString: string }
  | { DollarQuotedString: DollarQuotedString }
  | { TripleSingleQuotedString: string }
  | { TripleDoubleQuotedString: string }
  | { EscapedStringLiteral: string }
  | { UnicodeStringLiteral: string }
  | { SingleQuotedByteStringLiteral: string }
  | { DoubleQuotedByteStringLiteral: string }
  | { TripleSingleQuotedByteStringLiteral: string }
  | { TripleDoubleQuotedByteStringLiteral: string }
  | { SingleQuotedRawStringLiteral: string }
  | { DoubleQuotedRawStringLiteral: string }
  | { TripleSingleQuotedRawStringLiteral: string }
  | { TripleDoubleQuotedRawStringLiteral: string }
  | { NationalStringLiteral: string }
  | { HexStringLiteral: string }
  | { DoubleQuotedString: string }
  | { Boolean: boolean }
  | { Null: null }
  | { Placeholder: string };

export interface Expr {
  Identifier?: Ident;
  Value?: ValueWithSpan;
  BinaryOp?: {
    left: Expr;
    op: string;
    right: Expr;
  };
  Function?: {
    name: ObjectName;
    uses_odbc_syntax: boolean;
    parameters: string;
    args: {
      List: {
        duplicate_treatment: unknown;
        args: {
          Unnamed: {
            Expr: Expr;
          };
        }[];
        clauses: unknown[];
      };
    };
    filter: unknown;
    null_treatment: unknown;
    over: unknown;
    within_group: unknown[];
  };
  // Add other expression types as needed
}

export interface SelectItem {
  UnnamedExpr: Expr;
  // Add other select item types as needed
}

export interface TableFactor {
  Table: {
    name: ObjectName;
    alias: unknown;
    args: unknown;
    with_hints: unknown[];
    version: unknown;
    with_ordinality: boolean;
    partitions: unknown[];
    json_path: unknown;
    sample: unknown;
    index_hints: unknown[];
  };
  // Add other table factor types as needed
}

export interface TableWithJoins {
  relation: TableFactor;
  joins: unknown[];
}

export interface GroupByExpr {
  Expressions: [unknown[], unknown[]];
  // Add other group by types as needed
}

export interface OrderByExpr {
  expr: Expr;
  options: {
    asc: boolean | null;
    nulls_first: boolean | null;
  };
  with_fill: unknown;
}

export interface OrderBy {
  kind: {
    Expressions: OrderByExpr[];
  };
  interpolate: unknown;
}

export interface Select {
  select_token: AttachedToken;
  distinct: unknown;
  top: unknown;
  top_before_distinct: boolean;
  projection: SelectItem[];
  into: unknown;
  from: TableWithJoins[];
  lateral_views: unknown[];
  prewhere: unknown;
  selection: Expr;
  group_by: GroupByExpr;
  cluster_by: unknown[];
  distribute_by: unknown[];
  sort_by: unknown[];
  having: unknown;
  named_window: unknown[];
  qualify: unknown;
  window_before_qualify: boolean;
  value_table_mode: unknown;
  connect_by: unknown;
  flavor: string;
}

export interface SetExpr {
  Select: Select;
  // Add other set expression types as needed
}

export interface Query {
  Query: {
    with: unknown;
    body: SetExpr;
    order_by: OrderBy;
    limit: unknown;
    limit_by: unknown[];
    offset: unknown;
    fetch: unknown;
    locks: unknown[];
    for_clause: unknown;
    settings: unknown;
    format_clause: unknown;
  };
}
