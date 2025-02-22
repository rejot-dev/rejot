import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { useSystemTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

interface SqlCodeMirrorProps {
  className?: string;
  value: string;
  onChange?: (value: string) => void;
  baseTable: string;
  tableColumns: Array<{ columnName: string }>;
  editable?: boolean;
  height?: string;
}

export function SqlCodeMirror({
  className,
  value,
  onChange,
  baseTable,
  tableColumns,
  editable = true,
  height = "100%",
}: SqlCodeMirrorProps) {
  const theme = useSystemTheme();

  return (
    <div className={cn("relative rounded-md border", className)}>
      <CodeMirror
        value={value}
        height={height}
        editable={editable}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: editable,
          foldGutter: false,
        }}
        className="absolute inset-0"
        extensions={[
          sql({
            dialect: PostgreSQL,
            upperCaseKeywords: true,
            defaultTable: baseTable,
            schema: {
              [baseTable]: {
                self: {
                  type: "table",
                  label: baseTable,
                },
                children: tableColumns.map((column) => ({
                  type: "column",
                  label: column.columnName,
                })),
              },
            },
          }),
        ]}
        onChange={onChange}
        theme={theme === "dark" ? vscodeDark : vscodeLight}
      />
    </div>
  );
}
