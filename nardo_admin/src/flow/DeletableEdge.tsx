import type { EdgeProps } from "@xyflow/react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import { X } from "lucide-react";

export type DeletableEdgeData = {
  onDelete?: (edgeId: string) => void;
};

export function DeletableEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath(props);
  const data = (props.data ?? {}) as DeletableEdgeData;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        markerStart={props.markerStart}
        style={{
          stroke: "#2563eb",
          strokeWidth: 2,
          ...(props.style ?? {}),
        }}
      />
      <circle
        cx={props.sourceX}
        cy={props.sourceY}
        r={4}
        fill="white"
        stroke="#2563eb"
        strokeWidth={2}
      />
      {props.selected ? (
        <EdgeLabelRenderer>
          <button
            className="nodrag nopan pointer-events-auto rounded-md border border-zinc-200 bg-white p-1 text-zinc-600 shadow-sm hover:bg-zinc-50"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            onClick={() => data.onDelete?.(props.id)}
            aria-label="Видалити звʼязок"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
