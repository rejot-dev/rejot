import { Handle, Position } from "@xyflow/react";
import { Database, Album, RefreshCw } from "lucide-react";
import { Link } from "react-router";
import type { ListDetail } from "./process-architecture";

type NodeData = {
  label: string;
  sourcePosition?: Position;
  targetPosition?: Position;
  detail?: ListDetail[];
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

const DetailView = ({ detail }: { detail: ListDetail[] }) => (
  <div className="flex flex-col">
    {detail.map((item, index) => (
      <div
        key={index}
        className="flex flex-row items-center justify-between p-2 font-mono text-sm odd:bg-white even:bg-gray-100 dark:even:bg-gray-700"
      >
        {item.link ? <Link to={item.link}>{item.value}</Link> : item.value}
        <div className="ml-2 text-xs text-gray-500">{item.type}</div>
      </div>
    ))}
  </div>
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
    <div className="flex items-center gap-2">
      <RefreshCw />
      {data.label}
    </div>
    <AllHandles type="source" active={data.sourcePosition} nodeId={id} />
  </div>
);

export const DatabaseNode = ({ id, data }: { id: string; data: NodeData }) => (
  <div className="overflow-hidden rounded-md border border-blue-600 text-center dark:border-blue-600 dark:bg-blue-900">
    <AllHandles type="target" active={data.targetPosition} nodeId={id} />
    <div className="flex items-center gap-2 rounded-t-md bg-blue-200 p-2 font-semibold dark:bg-blue-900">
      <Database />
      {data.label}
    </div>
    {data.detail && data.detail.length > 0 && <DetailView detail={data.detail} />}
    <AllHandles type="source" active={data.sourcePosition} nodeId={id} />
  </div>
);

export const PublicationNode = ({ id, data }: { id: string; data: NodeData }) => (
  <div className="overflow-hidden rounded-lg border border-purple-600 dark:bg-purple-950">
    <div className="flex items-center gap-2 rounded-t-md bg-purple-200 p-2 font-semibold dark:bg-purple-900">
      <Album />
      {data.label}
    </div>
    <div>
      <AllHandles type="target" active={data.targetPosition} nodeId={id} />
      {data.detail && data.detail.length > 0 && <DetailView detail={data.detail} />}
      <AllHandles type="source" active={data.sourcePosition} nodeId={id} />
    </div>
  </div>
);
