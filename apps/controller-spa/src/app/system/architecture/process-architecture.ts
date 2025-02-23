import type { SystemOverview } from "@/data/system/system.data";
import { ConnectionLineType, type Edge, type Node, Position } from "@xyflow/react";

// Architecture layout configuration
export const ARCHITECTURE_CONFIG = {
  horizontalSpacing: 300,
  nodeUnitHeight: 60,
} as const;

export type ListDetail = {
  value: string;
  type: string;
  link?: string;
};

export type ArchitectureNode = {
  id: string;
  type: "controlPlane" | "syncEngine" | "database" | "publication" | "consumerSchema";
  label: string;
  detail?: ListDetail[];
  children?: ArchitectureNode[];
  parentSlug?: string; // Used to track which database a table belongs to
  publicSchemaId?: string;
};

// Convert SystemOverview to ArchitectureNode structure
export const systemOverviewToArchitectureNode = (system: SystemOverview): ArchitectureNode => {
  // Create sync engine nodes with their database children
  const syncEngineNodes: ArchitectureNode[] = system.syncServices.map((syncService) => {
    const syncEngineNode: ArchitectureNode = {
      id: syncService.code,
      type: "syncEngine",
      label: syncService.slug,
      detail: [{ value: syncService.status, type: "status" }],
      children: [
        ...system.dataStores.map((store) => {
          const databaseNode: ArchitectureNode = {
            id: store.slug,
            type: "database",
            label: store.slug,
            detail: [
              { value: store.type, type: "driver", link: `/connections/${store.slug}` },
              {
                value: "public",
                type: "schema",
                link: `./data-stores/${store.slug}/schema/public`,
              },
              {
                value: store.publicationName,
                type: "publication",
                link: `./data-stores/${store.slug}/publication/${store.publicationName}`,
              },
            ],
          };
          databaseNode.children = [];

          // If the store has publications, add them as children
          if (store.publicSchemas.length) {
            databaseNode.children = store.publicSchemas.map((ps) => ({
              id: `${ps.id}`,
              type: "publication",
              label: ps.name,
              detail: ps.schema.map((column) => ({
                value: column.columnName,
                type: column.dataType,
              })),
            }));
          }

          system.consumerSchemas.forEach((cs) => {
            if (cs.dataStore.slug !== store.slug) {
              return;
            }

            databaseNode.children!.push({
              id: cs.id,
              type: "consumerSchema",
              label: cs.name,
              parentSlug: cs.dataStore.slug,
              publicSchemaId: cs.publicSchema.code,
              detail: [
                { value: cs.status, type: "status" },
                {
                  value: cs.dataStore.slug,
                  type: "data store",
                  link: `/connections/${cs.dataStore.slug}`,
                },
              ],
            });
          });

          return databaseNode;
        }),
      ],
    };
    return syncEngineNode;
  });

  // Create the root control plane node
  return {
    id: "control-plane",
    type: "controlPlane",
    label: system.name,
    children: syncEngineNodes,
  };
};

// Function to calculate node height based on detail length
const calculateNodeHeight = (detail?: ListDetail[]) => {
  return (
    ARCHITECTURE_CONFIG.nodeUnitHeight + (detail?.length || 0) * ARCHITECTURE_CONFIG.nodeUnitHeight
  );
};

/**
 * Measures the total horizontal width for a node's subtree.
 * If a node has children, sum the widths of each child subtree
 * and add spacing. If no children, treat it as a single "slot."
 */
function measureSubtreeWidth(node: ArchitectureNode): number {
  const children = node.children ?? [];
  if (children.length === 0) {
    // Base width for a leaf node
    return ARCHITECTURE_CONFIG.horizontalSpacing;
  }

  // Sum widths of each child's subtree
  return children.reduce((total, child) => total + measureSubtreeWidth(child), 0);
}

/**
 * Recursively lays out the node and its children, centering children horizontally.
 * Returns { nodes, edges } arrays for the entire subtree.
 */
function layoutTree(
  node: ArchitectureNode,
  x: number,
  y: number,
  parentId: string | null = null,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Create the current node
  const thisNodeHeight = calculateNodeHeight(node.detail);
  nodes.push({
    id: node.id,
    type: node.type,
    data: {
      label: node.label,
      detail: node.detail,
      sourcePosition: node.children?.length ? Position.Bottom : undefined,
      targetPosition: parentId ? Position.Top : undefined,
    },
    position: { x, y },
  });

  // Draw edge from the parent to this node (if parent exists)
  if (parentId) {
    // Only create parent-child edge if this is not a consumer schema node
    if (node.type !== "consumerSchema") {
      edges.push({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: ConnectionLineType.SimpleBezier,
        sourceHandle: `${parentId}-bottom`,
        targetHandle: `${node.id}-top`,
      });
    }

    // If this is a consumer schema node, add an edge to its data store
    if (node.type === "consumerSchema") {
      if (node.parentSlug) {
        edges.push({
          id: `${node.id}-${node.parentSlug}`,
          source: node.id,
          target: node.parentSlug,
          type: ConnectionLineType.SimpleBezier,
          sourceHandle: `${node.id}-left`,
          targetHandle: `${node.parentSlug}-right`,
        });
      }

      // Add edge to public schema if it exists
      if (node.publicSchemaId) {
        edges.push({
          id: `${node.id}-${node.publicSchemaId}`,
          source: node.id,
          target: node.publicSchemaId,
          type: ConnectionLineType.SimpleBezier,
          sourceHandle: `${node.id}-right`,
          targetHandle: `${node.publicSchemaId}-left`,
        });
      }
    }
  }

  // Lay out children if any
  const children = node.children ?? [];
  if (children.length > 0) {
    // Measure total width of this node's children
    const totalChildrenWidth = measureSubtreeWidth(node);
    // Center them around this node's x coordinate
    let currentX = x - totalChildrenWidth / 2;

    // Position each child subtree
    children.forEach((child) => {
      const childWidth = measureSubtreeWidth(child);
      // Move halfway into its width to center
      currentX += childWidth / 2;

      // Layout the child at the next vertical level
      const childY = y + thisNodeHeight;
      const childLayout = layoutTree(child, currentX, childY, node.id);

      // Combine node/edge results
      nodes.push(...childLayout.nodes);
      edges.push(...childLayout.edges);

      // Move over the other half
      currentX += childWidth / 2;
    });
  }

  return { nodes, edges };
}

/**
 * Main function. Pass in the root node and it will
 * generate all the nodes and edges for the entire tree.
 */
export function generateNodesAndEdges(root: ArchitectureNode) {
  // Position the root at (0,0) or wherever you like
  return layoutTree(root, 0, 0);
}
