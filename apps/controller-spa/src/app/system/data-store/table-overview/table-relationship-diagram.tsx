import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  useReactFlow,
  useNodesInitialized,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { type HTMLAttributes, useCallback, useEffect, useState } from "react";
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
};

function generateNodesAndEdges(data: TableOverview): {
  nodes: FlowTableNode[];
  edges: Edge[];
} {
  // Transform the table data into nodes and edges for the diagram
  const nodes = data.map((table, index) => ({
    id: table.tableName,
    type: "table" as const,
    position: { x: (index % 3) * 350, y: Math.floor(index / 3) * 300 },
    data: {
      name: table.tableName,
      schema: table.schema,
      columns: table.columns,
    },
  }));

  // Create edges for foreign key relationships
  const edges = data.flatMap((table) =>
    table.columns
      .filter((column) => column.foreignKey)
      .map((column) => ({
        id: `${table.tableName}.${column.columnName}->${column.foreignKey?.referencedTableName}.${column.foreignKey?.referencedColumnName}`,
        source: table.tableName,
        sourceHandle: `${table.tableName}.${column.columnName}`,
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

function LayoutFlow({ tableOverview: dataStoreOverview }: TableRelationshipDiagramProps) {
  const { fitView } = useReactFlow();
  const { nodes: initialNodes, edges: initialEdges } = generateNodesAndEdges(dataStoreOverview);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodesInitialized = useNodesInitialized();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

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

  const resetLayout = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges);
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);
  }, [nodes, edges, setNodes, setEdges]);

  // Style edges based on hovered node
  const styledEdges = edges.map((edge) => ({
    ...edge,
    style: {
      stroke:
        hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode)
          ? "#EE1E3C" // Highlight color
          : "#b1b1b7", // Default color
      strokeWidth:
        hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode)
          ? 2 // Thicker for highlighted
          : 1, // Default width
    },
    animated: !!(hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode)),
  }));

  return (
    <ReactFlow
      nodes={nodes}
      edges={styledEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onNodeMouseEnter={(_, node) => setHoveredNode(node.id)}
      onNodeMouseLeave={() => setHoveredNode(null)}
      fitView
    >
      <Panel position="top-right">
        <div className="flex gap-2">
          <button
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
            onClick={() => fitView({ duration: 200 })}
          >
            Fit to view
          </button>
          <button
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
            onClick={resetLayout}
          >
            Reset layout
          </button>
        </div>
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
