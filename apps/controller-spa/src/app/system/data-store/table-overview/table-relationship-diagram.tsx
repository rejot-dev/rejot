import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  Panel,
  useReactFlow,
  useNodesInitialized,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { type HTMLAttributes, useEffect } from "react";
import { TableNode } from "./table-node";
import type { TableColumn, TableOverview } from "./overview";
import Dagre from "@dagrejs/dagre";

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
        animated: false,
      })),
  );

  return { nodes, edges };
}

const getLayoutedElements = (nodes: FlowTableNode[], edges: Edge[]) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "RL", align: "UL" });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  nodes.forEach((node) =>
    g.setNode(node.id, {
      ...node,
      width: node.measured?.width ?? 0,
      height: node.measured?.height ?? 0,
    }),
  );

  Dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const position = g.node(node.id);
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      const x = position.x - (node.measured?.width ?? 0) / 2;
      const y = position.y - (node.measured?.height ?? 0) / 2;

      return { ...node, position: { x, y } };
    }),
    edges,
  };
};

function LayoutFlow({
  tableOverview: dataStoreOverview,
  resourceName,
}: TableRelationshipDiagramProps) {
  const { fitView } = useReactFlow();
  const { nodes: initialNodes, edges: initialEdges } = generateNodesAndEdges(dataStoreOverview);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodesInitialized = useNodesInitialized();

  // Nodes need will be measured on initial render, then nodesInitialized will be true
  // so we can layout the nodes and edges using dagre
  useEffect(() => {
    if (nodesInitialized) {
      const layouted = getLayoutedElements(nodes, edges);
      setNodes([...layouted.nodes]);
      setEdges([...layouted.edges]);
      window.requestAnimationFrame(() => {
        fitView();
      });
    }
  }, [nodesInitialized]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
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
