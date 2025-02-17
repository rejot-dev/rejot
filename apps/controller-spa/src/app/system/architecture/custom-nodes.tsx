import { Handle, Position } from "@xyflow/react";

type NodeData = {
  label: string;
  sourcePosition?: Position;
  targetPosition?: Position;
};

const AllHandles = ({
  type,
  active,
  nodeId,
}: {
  type: "source" | "target";
  active?: Position;
  nodeId: string;
}) => (
  <>
    <Handle
      type={type}
      position={Position.Top}
      id={`${nodeId}-${Position.Top}`}
      className={active === Position.Top ? "opacity-100" : "opacity-0 hover:opacity-50"}
    />
    <Handle
      type={type}
      position={Position.Right}
      id={`${nodeId}-${Position.Right}`}
      className={active === Position.Right ? "opacity-100" : "opacity-0 hover:opacity-50"}
    />
    <Handle
      type={type}
      position={Position.Bottom}
      id={`${nodeId}-${Position.Bottom}`}
      className={active === Position.Bottom ? "opacity-100" : "opacity-0 hover:opacity-50"}
    />
    <Handle
      type={type}
      position={Position.Left}
      id={`${nodeId}-${Position.Left}`}
      className={active === Position.Left ? "opacity-100" : "opacity-0 hover:opacity-50"}
    />
  </>
);

export const ControlPlaneNode = ({ id, data }: { id: string; data: NodeData }) => (
  <div className="w-72 rounded-md border border-red-600 bg-red-300 p-2 text-center dark:border-red-600 dark:bg-red-900">
    <AllHandles type="source" active={data.sourcePosition} nodeId={id} />
    <div>{data.label}</div>
  </div>
);

export const SyncEngineNode = ({ id, data }: { id: string; data: NodeData }) => (
  <div className="rounded-md border border-green-600 bg-green-300 p-2 text-center dark:border-green-600 dark:bg-green-900">
    <AllHandles type="target" active={data.targetPosition} nodeId={id} />
    <div>{data.label}</div>
    <AllHandles type="source" active={data.sourcePosition} nodeId={id} />
  </div>
);

export const DatabaseNode = ({ id, data }: { id: string; data: NodeData }) => (
  <div className="rounded-md border border-blue-600 bg-blue-300 p-2 text-center dark:border-blue-600 dark:bg-blue-900">
    <AllHandles type="target" active={data.targetPosition} nodeId={id} />
    <div>{data.label}</div>
    <AllHandles type="source" active={data.sourcePosition} nodeId={id} />
  </div>
);

export const TableNode = ({ id, data }: { id: string; data: NodeData }) => (
  <div className="w-40 rounded-md border border-purple-600 bg-purple-300 p-2 text-center dark:border-purple-600 dark:bg-purple-900">
    <AllHandles type="target" active={data.targetPosition} nodeId={id} />
    <div className="text-sm">{data.label}</div>
  </div>
);
