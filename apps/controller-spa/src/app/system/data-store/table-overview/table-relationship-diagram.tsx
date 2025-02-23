import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type NodeChange,
  applyNodeChanges,
  type Edge,
  type Node,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { type HTMLAttributes } from "react";
import { TableNode } from "./table-node";
import type { TableColumn, TableOverview } from "./overview";

type FlowTableNode = Node<{
  name: string;
  schema: string;
  columns: TableColumn[];
}>;

const nodeTypes = {
  table: TableNode,
};

export type TableRelationshipDiagramProps = HTMLAttributes<HTMLDivElement> & {
  tableOverview: TableOverview;
  resourceName: string;
};

function generateNodesAndEdges(data: TableOverview): {
  nodes: FlowTableNode[];
  edges: Edge[];
} {
  // Transform the table data into nodes and edges for the diagram
  const nodes = data.tables.map((table, index) => ({
    id: `${table.schema}.${table.tableName}`,
    type: "table" as const,
    position: { x: (index % 3) * 350, y: Math.floor(index / 3) * 300 },
    data: {
      name: table.tableName,
      schema: table.schema,
      columns: table.columns,
    },
  }));

  // Create edges for foreign key relationships
  const edges = data.tables.flatMap((table) =>
    table.columns
      .filter((column) => column.foreignKey)
      .map((column) => ({
        id: `${table.tableName}.${column.columnName}->${column.foreignKey?.referencedTableName}.${column.foreignKey?.referencedColumnName}`,
        source: `${table.schema}.${table.tableName}`,
        sourceHandle: `${table.schema}.${table.tableName}.${column.columnName}`,
        target: `${column.foreignKey?.referencedTableSchema}.${column.foreignKey?.referencedTableName}`,
        targetHandle: `${column.foreignKey?.referencedTableSchema}.${column.foreignKey?.referencedTableName}.${column.foreignKey?.referencedColumnName}`,
        type: "smoothstep",
        animated: true,
      })),
  );

  return { nodes, edges };
}

function LayoutFlow({
  tableOverview: dataStoreOverview,
  resourceName,
}: TableRelationshipDiagramProps) {
  const { nodes: initialNodes, edges: initialEdges } = generateNodesAndEdges(dataStoreOverview);

  const initialPositionedNodes = initialNodes.map((node, index) => ({
    ...node,
    position: {
      x: (index % 3) * 350, // 3 columns, 350px spacing
      y: Math.floor(index / 3) * 300, // 300px vertical spacing
    },
    draggable: true as const,
  }));

  const [nodes, setNodes] = useNodesState<FlowTableNode>(initialPositionedNodes);
  const [edges] = useEdgesState(initialEdges);

  const onNodesChange = (changes: NodeChange<FlowTableNode>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      fitView
    >
      <Panel position="top-left">
        <h2 className="text-2xl font-bold">{resourceName}</h2>
      </Panel>
    </ReactFlow>
  );
}

export function TableRelationshipDiagram(props: TableRelationshipDiagramProps) {
  return (
    <ReactFlowProvider>
      <LayoutFlow {...props} />
    </ReactFlowProvider>
  );
}
