import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Flag, Play } from "lucide-react";

export type StartFlowNode = Node<Record<string, never>, "start">;
export type EndFlowNode = Node<Record<string, never>, "end">;

export function StartNode(props: NodeProps<StartFlowNode>) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 bg-white border-2 shadow-xl ${
        props.selected ? "border-emerald-500" : "border-emerald-200"
      }`}
    >
      <div className="flex items-center gap-2 text-emerald-700 font-black tracking-wide">
        <Play className="w-4 h-4" />
        START
      </div>
      <div className="text-[10px] text-slate-500 font-medium mt-1">
        Connect to first question
      </div>
      <Handle
        type="source"
        id="start"
        position={Position.Right}
        className="!w-3 !h-3 !bg-emerald-500 border-2 border-white"
        style={{ right: -6 }}
      />
    </div>
  );
}

export function EndNode(props: NodeProps<EndFlowNode>) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 bg-white border-2 shadow-xl ${
        props.selected ? "border-slate-700" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2 text-slate-700 font-black tracking-wide">
        <Flag className="w-4 h-4" />
        END
      </div>
      <div className="text-[10px] text-slate-500 font-medium mt-1">
        Terminal step
      </div>
      <Handle
        type="target"
        id="end"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-700 border-2 border-white"
        style={{ left: -6 }}
      />
    </div>
  );
}
