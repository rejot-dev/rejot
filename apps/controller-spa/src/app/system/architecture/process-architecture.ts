import type { SystemOverview } from "@/data/system/system.data";
import { ConnectionLineType, type Edge, type Node, Position } from "@xyflow/react";

// Architecture layout configuration
export const ARCHITECTURE_CONFIG = {
  syncEngine: {
    baseRadius: 300,
    radiusPerChild: 75,
  },
  database: {
    baseRadius: 200,
    radiusPerChild: 60,
  },
  publication: {
    baseRadius: 150,
    radiusPerChild: 50,
    width: 160,
    minSpacing: 20,
  },
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
        store.publication.tables?.map((table) => ({
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
      if (store.publications.length) {
        databaseNode.children = store.publications.map((publication) => ({
          id: `${store.slug}-${publication.name}`,
          type: "publication",
          label: publication.name,
          detail: publication.schema?.map((schema) => ({
            value: schema.columnName,
            type: schema.dataType,
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

export const generateNodesAndEdges = (
  node: ArchitectureNode,
  _parentId: string | null = null,
  x = 0,
  y = 0,
  _level = 0,
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Helper function to calculate position on orbit with consistent angles
  const getOrbitPosition = (
    index: number,
    total: number,
    radius: number,
    centerX: number,
    centerY: number,
    parentAngle?: number,
    isTable = false,
  ) => {
    let angle;
    if (parentAngle !== undefined) {
      if (isTable) {
        // For tables, calculate spacing based on actual pixel dimensions
        const tableWidth = ARCHITECTURE_CONFIG.publication.width;
        const minSpacing = ARCHITECTURE_CONFIG.publication.minSpacing;

        // Calculate circumference at this radius
        const adjustedRadius = Math.max(
          radius,
          // Ensure radius is large enough to fit all tables with spacing
          (total * (tableWidth + minSpacing)) / (2 * Math.PI),
        );

        // Calculate the minimum angle needed for one table at this radius
        const tableAngle = Math.asin(tableWidth / (2 * adjustedRadius)) * 2;
        const spacingAngle = Math.asin(minSpacing / (2 * adjustedRadius)) * 2;

        // Total spread angle needed for all tables with spacing
        const neededSpread = total * (tableAngle + spacingAngle);

        // Use at least 90 degrees, but expand if needed
        const spreadAngle = Math.max(Math.PI / 2, neededSpread);

        // Position the table
        const startAngle = parentAngle - spreadAngle / 2;
        angle = startAngle + (index * spreadAngle) / (total - 1 || 1);

        return {
          x: centerX + adjustedRadius * Math.cos(angle),
          y: centerY + adjustedRadius * Math.sin(angle),
          angle,
        };
      } else {
        // For databases, use wider spread to accommodate their tables
        const spreadAngle = Math.PI * 0.75; // 135 degrees
        const startAngle = parentAngle - spreadAngle / 2;
        angle = startAngle + (index * spreadAngle) / (total - 1 || 1);
      }
    } else {
      // For top level elements, spread around the full circle
      angle = (index * 2 * Math.PI) / total;
    }

    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      angle,
    };
  };

  // Helper to determine handle positions based on relative positions
  const getHandlePositions = (
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
  ) => {
    // Calculate angle from source to target
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const angle = Math.atan2(dy, dx);

    // Convert angle to degrees and normalize to 0-360
    const degrees = ((angle * 180) / Math.PI + 360) % 360;

    // Use 8 sectors instead of 4 for more precise handle positioning
    const sector = Math.floor((degrees + 22.5) / 45) % 8;

    // Map sectors to positions
    const positions: Record<number, Position> = {
      0: Position.Right, // 0°
      1: Position.Bottom, // 45°
      2: Position.Bottom, // 90°
      3: Position.Left, // 135°
      4: Position.Left, // 180°
      5: Position.Top, // 225°
      6: Position.Top, // 270°
      7: Position.Right, // 315°
    };

    return {
      sourcePosition: positions[sector] || Position.Right,
      targetPosition: positions[(sector + 4) % 8] || Position.Left,
    };
  };

  // Place the control plane (sun) at the center
  if (node.type === "controlPlane") {
    const children = node.children ?? [];
    const syncEngineRadius = Math.max(
      ARCHITECTURE_CONFIG.syncEngine.baseRadius,
      children.length * ARCHITECTURE_CONFIG.syncEngine.radiusPerChild,
    );

    // First calculate all sync engine positions
    const syncEnginePositions = children.map((_, index) =>
      getOrbitPosition(index, children.length, syncEngineRadius, x, y),
    );

    // Calculate control plane handle position based on average child position
    let controlPlaneHandles = { sourcePosition: Position.Right, targetPosition: Position.Left };
    if (syncEnginePositions.length > 0) {
      const avgX =
        syncEnginePositions.reduce((sum, pos) => sum + pos.x, 0) / syncEnginePositions.length;
      const avgY =
        syncEnginePositions.reduce((sum, pos) => sum + pos.y, 0) / syncEnginePositions.length;
      controlPlaneHandles = getHandlePositions(x, y, avgX, avgY);
    }

    nodes.push({
      id: node.id,
      type: node.type,
      data: {
        label: node.label,
        sourcePosition: controlPlaneHandles.sourcePosition,
      },
      position: { x, y },
    });

    // Now place sync engines and create edges
    syncEnginePositions.forEach((pos, index) => {
      const syncEngine = children[index];
      if (!syncEngine) return;

      const handles = getHandlePositions(x, y, pos.x, pos.y);

      nodes.push({
        id: syncEngine.id,
        type: syncEngine.type,
        data: {
          label: syncEngine.label,
          sourcePosition: handles.sourcePosition,
          targetPosition: handles.targetPosition,
          detail: syncEngine.detail,
        },
        position: pos,
      });

      edges.push({
        id: `${node.id}-${syncEngine.id}`,
        source: node.id,
        target: syncEngine.id,
        type: ConnectionLineType.SimpleBezier,
        sourceHandle: `${node.id}-${handles.sourcePosition}`,
        targetHandle: `${syncEngine.id}-${handles.targetPosition}`,
      });

      // Handle databases in the second orbit
      const dbChildren = syncEngine.children ?? [];
      const databaseRadius = Math.max(
        ARCHITECTURE_CONFIG.database.baseRadius,
        dbChildren.length * ARCHITECTURE_CONFIG.database.radiusPerChild,
      );

      dbChildren.forEach((database, dbIndex) => {
        const dbPos = getOrbitPosition(
          dbIndex,
          dbChildren.length,
          databaseRadius,
          pos.x,
          pos.y,
          pos.angle,
        );

        const handles = getHandlePositions(pos.x, pos.y, dbPos.x, dbPos.y);

        nodes.push({
          id: database.id,
          type: database.type,
          data: {
            label: database.label,
            sourcePosition: handles.sourcePosition,
            targetPosition: handles.targetPosition,
            detail: database.detail,
          },
          position: dbPos,
        });

        edges.push({
          id: `${syncEngine.id}-${database.id}`,
          source: syncEngine.id,
          target: database.id,
          type: ConnectionLineType.SimpleBezier,
          sourceHandle: `${syncEngine.id}-${handles.sourcePosition}`,
          targetHandle: `${database.id}-${handles.targetPosition}`,
        });

        // Handle tables as moons of databases
        const publicationChildren = database.children ?? [];
        const publicationRadius = Math.max(
          ARCHITECTURE_CONFIG.publication.baseRadius,
          publicationChildren.length * ARCHITECTURE_CONFIG.publication.radiusPerChild,
        );

        publicationChildren.forEach((publication, tableIndex) => {
          const tablePos = getOrbitPosition(
            tableIndex,
            publicationChildren.length,
            publicationRadius,
            dbPos.x,
            dbPos.y,
            dbPos.angle,
            true,
          );

          const handles = getHandlePositions(dbPos.x, dbPos.y, tablePos.x, tablePos.y);

          nodes.push({
            id: publication.id,
            type: publication.type,
            data: {
              label: publication.label,
              detail: publication.detail,
              targetPosition: handles.targetPosition,
            },
            position: tablePos,
          });

          edges.push({
            id: `${database.id}-${publication.id}`,
            source: database.id,
            target: publication.id,
            type: ConnectionLineType.SimpleBezier,
            sourceHandle: `${database.id}-${handles.sourcePosition}`,
            targetHandle: `${publication.id}-${handles.targetPosition}`,
          });
        });
      });
    });
  }

  return { nodes, edges };
};
