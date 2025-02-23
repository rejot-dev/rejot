class SqlLiteral {
  private _parts: readonly string[];
  private _values: readonly unknown[];
  private _resolved?: { text: string; values: unknown[] };

  constructor(parts: readonly string[], values: readonly unknown[] = []) {
    this._parts = parts;
    this._values = values;
  }

  private _resolve(): { text: string; values: unknown[] } {
    if (this._resolved === undefined) {
      const context: { fragments: Map<SqlLiteral, string>; values: unknown[] } = {
        fragments: new Map(),
        values: [],
      };
      const text = this._resolveFor(context);
      this._resolved = { text, values: context.values };
    }
    return this._resolved;
  }

  private _resolveFor(context: { fragments: Map<SqlLiteral, string>; values: unknown[] }): string {
    let fragment = context.fragments.get(this);
    if (fragment === undefined) {
      fragment = this._parts.reduce((prev: string, curr: string, i: number) => {
        const child = this._values[i - 1];
        let mid: string;
        if (child instanceof SqlLiteral) {
          mid = child._resolveFor(context);
        } else {
          context.values.push(child);
          mid = "$" + context.values.length;
        }
        return prev + mid + curr;
      });
      context.fragments.set(this, fragment);
    }
    return fragment;
  }

  get text(): string {
    return this._resolve().text;
  }

  get values(): unknown[] {
    return this._resolve().values;
  }
}

export function sql(parts: TemplateStringsArray, ...values: unknown[]): SqlLiteral {
  return new SqlLiteral(parts, values);
}

export function sqlLiteral(value: string): SqlLiteral {
  return new SqlLiteral([value], []);
}

export function join(array: SqlLiteral[], separator?: string): SqlLiteral {
  separator = separator || ",";
  const parts: string[] = [""];
  for (let i = 0; i < array.length - 1; i++) {
    parts.push(separator);
  }
  parts.push("");
  return new SqlLiteral(parts, array);
}
