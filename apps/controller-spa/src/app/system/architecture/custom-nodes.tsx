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
  <div className="bg-red-300 rounded-md p-2 border border-red-600 text-center w-72 dark:bg-red-900 dark:border-red-600">
    <AllHandles type="source" active={data.sourcePosition} nodeId={id} />
    <div>{data.label}</div>
  </div>
);

export const SyncEngineNode = ({ id, data }: { id: string; data: NodeData }) => (
  <div className="bg-green-300 rounded-md p-2 border border-green-600 text-center dark:bg-green-900 dark:border-green-600">
    <AllHandles type="target" active={data.targetPosition} nodeId={id} />
    <div>{data.label}</div>
    <AllHandles type="source" active={data.sourcePosition} nodeId={id} />
  </div>
);

export const DatabaseNode = ({ id, data }: { id: string; data: NodeData }) => (
  <div className="bg-blue-300 rounded-md p-2 border border-blue-600 text-center dark:bg-blue-900 dark:border-blue-600">
    <AllHandles type="target" active={data.targetPosition} nodeId={id} />
    <div>{data.label}</div>
    <AllHandles type="source" active={data.sourcePosition} nodeId={id} />
  </div>
);

export const TableNode = ({ id, data }: { id: string; data: NodeData }) => (
  <div className="bg-purple-300 rounded-md p-2 border border-purple-600 text-center w-40 dark:bg-purple-900 dark:border-purple-600">
    <AllHandles type="target" active={data.targetPosition} nodeId={id} />
    <div className="text-sm">{data.label}</div>
  </div>
);
