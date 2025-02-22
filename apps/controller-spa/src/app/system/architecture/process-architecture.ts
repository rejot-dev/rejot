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
  type: "controlPlane" | "syncEngine" | "database" | "publication";
  label: string;
  detail?: ListDetail[];
  children?: ArchitectureNode[];
  parentSlug?: string; // Used to track which database a table belongs to
};

// Convert SystemOverview to ArchitectureNode structure
export const systemOverviewToArchitectureNode = (system: SystemOverview): ArchitectureNode => {
  // Create sync engine nodes with their database children
  const syncEngineNodes: ArchitectureNode[] = system.syncServices.map((syncService) => ({
    id: syncService.code,
    type: "syncEngine",
    label: syncService.slug,
    detail: [{ value: syncService.status, type: "status" }],
    children: system.dataStores.map((store) => {
      const tableDetails =
        store.tables.map((table) => ({
          value: table,
          type: "source table",
          link: `/connections/${store.slug}/tables/public.${table}`,
        })) ?? [];

      if (tableDetails.length === 0) {
        tableDetails.push({
          value: "all tables",
          type: "source table",
          link: `/connections/${store.slug}`,
        });
      }

      const databaseNode: ArchitectureNode = {
        id: store.slug,
        type: "database",
        label: store.slug,
        detail: [
          { value: store.type, type: "driver", link: `/connections/${store.slug}` },
          ...tableDetails,
        ],
      };

      // If the store has publications, add them as children
      if (store.publicSchemas.length) {
        databaseNode.children = store.publicSchemas.map((ps) => ({
          id: `${store.slug}-${ps.name}`,
          type: "publication",
          label: ps.name,
          detail: ps.schema.map((column) => ({
            value: column.columnName,
            type: column.dataType,
          })),
        }));
      }

      return databaseNode;
    }),
  }));

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

export const generateNodesAndEdges = (
  node: ArchitectureNode,
  _parentId: string | null = null,
  x = 0,
  y = 0,
  _level = 0,
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Place the control plane node at the top
  if (node.type === "controlPlane") {
    const children = node.children ?? [];

    const controlPlaneHeight = calculateNodeHeight(node.detail);
    nodes.push({
      id: node.id,
      type: node.type,
      data: {
        label: node.label,
        sourcePosition: Position.Bottom,
      },
      position: { x, y },
    });

    // Calculate total width for sync engines and center them
    const totalSyncWidth = (children.length - 1) * ARCHITECTURE_CONFIG.horizontalSpacing;
    const syncStartX = x - totalSyncWidth / 2;

    // Position sync engines below the control plane
    let currentY = y + controlPlaneHeight;
    children.forEach((syncEngine, index) => {
      const syncX = syncStartX + index * ARCHITECTURE_CONFIG.horizontalSpacing;
      const syncEngineHeight = calculateNodeHeight(syncEngine.detail);
      nodes.push({
        id: syncEngine.id,
        type: syncEngine.type,
        data: {
          label: syncEngine.label,
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          detail: syncEngine.detail,
        },
        position: { x: syncX, y: currentY },
      });

      edges.push({
        id: `${node.id}-${syncEngine.id}`,
        source: node.id,
        target: syncEngine.id,
        type: ConnectionLineType.SimpleBezier,
        sourceHandle: `${node.id}-bottom`,
        targetHandle: `${syncEngine.id}-top`,
      });

      // Calculate total width for databases and center them
      const dbChildren = syncEngine.children ?? [];
      const dbWidths = dbChildren.map((database) => {
        const publicationCount = database.children?.length || 0;
        return Math.max(1, publicationCount) * ARCHITECTURE_CONFIG.horizontalSpacing;
      });
      const totalDbWidth = dbWidths.reduce((acc, width) => acc + width, 0);
      const dbStartX = syncX - totalDbWidth / 2;

      // Position databases below each sync engine
      const dbY = currentY + syncEngineHeight;
      let dbX = dbStartX;
      dbChildren.forEach((database, dbIndex) => {
        const databaseWidth = dbWidths[dbIndex] ?? 0;
        dbX += databaseWidth / 2; // Center the database
        const databaseHeight = calculateNodeHeight(database.detail);
        nodes.push({
          id: database.id,
          type: database.type,
          data: {
            label: database.label,
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top,
            detail: database.detail,
          },
          position: { x: dbX, y: dbY },
        });

        edges.push({
          id: `${syncEngine.id}-${database.id}`,
          source: syncEngine.id,
          target: database.id,
          type: ConnectionLineType.SimpleBezier,
          sourceHandle: `${syncEngine.id}-bottom`,
          targetHandle: `${database.id}-top`,
        });

        // Calculate total width for publications and center them
        const publicationChildren = database.children ?? [];
        const totalPubWidth =
          (publicationChildren.length - 1) * ARCHITECTURE_CONFIG.horizontalSpacing;
        const pubStartX = dbX - totalPubWidth / 2;

        // Position publications below each database
        const pubY = dbY + databaseHeight;
        publicationChildren.forEach((publication, pubIndex) => {
          const pubX = pubStartX + pubIndex * ARCHITECTURE_CONFIG.horizontalSpacing;
          nodes.push({
            id: publication.id,
            type: publication.type,
            data: {
              label: publication.label,
              detail: publication.detail,
              targetPosition: Position.Top,
            },
            position: { x: pubX, y: pubY },
          });

          edges.push({
            id: `${database.id}-${publication.id}`,
            source: database.id,
            target: publication.id,
            type: ConnectionLineType.SimpleBezier,
            sourceHandle: `${database.id}-bottom`,
            targetHandle: `${publication.id}-top`,
          });
        });

        dbX += databaseWidth / 2; // Move to the next database position
      });

      currentY += syncEngineHeight;
    });
  }

  return { nodes, edges };
};
