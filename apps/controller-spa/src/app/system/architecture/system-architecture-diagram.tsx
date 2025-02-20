/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import { type HTMLAttributes, useMemo, useRef } from "react";

import {
  ControlPlaneNode,
  DatabaseNode,
  SyncEngineNode,
  PublicationNode,
} from "./custom-nodes.tsx";
import type { SystemOverview } from "@/data/system/system.data.ts";
import { collide } from "./collide.ts";
import { systemOverviewToArchitectureNode } from "./process-architecture.ts";

// Configuration
import { generateNodesAndEdges } from "./process-architecture.ts";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { NavLink } from "react-router";
const SIMULATION_TICKS = 30;

// Define a custom type that extends SimulationNodeDatum with our required properties
interface SimNode extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
  fx?: number;
  fy?: number;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  type?: string;
}

const simulation = forceSimulation()
  .force("charge", forceManyBody().strength(-1000))
  .force("x", forceX().x(0).strength(0.05))
  .force("y", forceY().y(0).strength(0.05))
  .force("collide", collide())
  .alphaTarget(0.05)
  .stop();

const useLayoutedElements = (): [
  boolean,
  {
    start: (_event: any, node: any) => any;
    drag: (_event: any, node: any) => any;
    stop: () => null;
  },
] => {
  const { getNodes, setNodes, getEdges, fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  const draggingNodeRef = useRef<{ id: string; position: { x: number; y: number } } | null>(null);
  const tickCountRef = useRef(0);

  const dragEvents = useMemo(
    () => ({
      start: (_event: any, node: any) => (draggingNodeRef.current = node),
      drag: (_event: any, node: any) => (draggingNodeRef.current = node),
      stop: () => (draggingNodeRef.current = null),
    }),
    [],
  );

  return useMemo(() => {
    const nodes = getNodes().map((node) => ({
      ...node,
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      data: node.data,
      type: node.type,
    })) as SimNode[];
    const edges = getEdges();

    if (!initialized || nodes.length === 0) {
      return [false, dragEvents] as const;
    }

    simulation.nodes(nodes).force(
      "link",
      forceLink(edges)
        .id((d: SimulationNodeDatum) => (d as SimNode).id)
        .strength(0.05)
        .distance(100),
    );

    const tick = () => {
      if (tickCountRef.current >= SIMULATION_TICKS) {
        return;
      }

      getNodes().forEach((node, i) => {
        const simNode = nodes[i];
        if (!simNode) return;

        const dragging = draggingNodeRef.current?.id === node.id;

        if (dragging && draggingNodeRef.current) {
          simNode.fx = draggingNodeRef.current.position.x;
          simNode.fy = draggingNodeRef.current.position.y;
        } else {
          simNode.fx = undefined;
          simNode.fy = undefined;
        }
      });

      simulation.tick();
      setNodes(
        nodes.map((node) => ({
          ...node,
          position: { x: node.fx ?? node.x, y: node.fy ?? node.y },
          data: node.data,
          type: node.type,
        })),
      );

      tickCountRef.current += 1;

      window.requestAnimationFrame(() => {
        fitView();
        if (tickCountRef.current < SIMULATION_TICKS) {
          tick();
        }
      });
    };

    // Start the simulation immediately
    tick();

    return [true, dragEvents] as const;
  }, [initialized, dragEvents, getNodes, getEdges, setNodes, fitView]);
};

export type ArchitectureDiagramProps = HTMLAttributes<HTMLDivElement> & {
  systemOverview: SystemOverview;
  disableSimulation?: boolean;
};

export function LayoutFlow({
  systemOverview,
  disableSimulation = false,
}: ArchitectureDiagramProps) {
  const architectureData = systemOverviewToArchitectureNode(systemOverview);
  const { nodes: initialNodes, edges: initialEdges } = generateNodesAndEdges(architectureData);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [_initialized, dragEvents] = useLayoutedElements();

  // If simulation is disabled, use the initial layout directly
  const effectiveNodes = disableSimulation ? initialNodes : nodes;

  const nodeTypes = {
    controlPlane: ControlPlaneNode,
    syncEngine: SyncEngineNode,
    database: DatabaseNode,
    publication: PublicationNode,
  };

  return (
    <ReactFlow
      nodes={effectiveNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeDragStart={!disableSimulation ? dragEvents.start : undefined}
      onNodeDrag={!disableSimulation ? dragEvents.drag : undefined}
      onNodeDragStop={!disableSimulation ? dragEvents.stop : undefined}
      onNodesChange={!disableSimulation ? onNodesChange : undefined}
      onEdgesChange={onEdgesChange}
      fitView
    >
      <Panel position="top-left">
        <h2 className="text-2xl font-bold">{systemOverview.name}</h2>
      </Panel>
      <Panel position="top-right">
        <Button>
          <Plus />
          <NavLink to={`/systems/${systemOverview.slug}/data-stores/new`}>Add Data Store</NavLink>
        </Button>
      </Panel>
    </ReactFlow>
  );
}

export function ArchitectureDiagram(props: ArchitectureDiagramProps) {
  return (
    <ReactFlowProvider>
      <LayoutFlow {...props} />
    </ReactFlowProvider>
  );
}
