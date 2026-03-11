import {
  Background,
  Controls,
  type Edge,
  type OnConnect,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Trash2, Settings2, Eye, EyeOff, FilePlus2 } from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";

import { apiRequest, apiRequestForm } from "../api/http";
import type { Question, QuestionOption, Service } from "../api/types";
import { Button, Card, CardBody, Input, Spinner } from "../components/ui";
import { DeletableEdge, type DeletableEdgeData } from "../flow/DeletableEdge";
import { QuestionNode, type QuestionFlowNode } from "../flow/QuestionNode";
import {
  EndNode,
  StartNode,
  type EndFlowNode,
  type StartFlowNode,
} from "../flow/StartEndNode";
import { useToast } from "../lib/toast";

type UiQuestion = Question;
type FlowNode = QuestionFlowNode | StartFlowNode | EndFlowNode;

const nodeTypes = { question: QuestionNode, start: StartNode, end: EndNode };
const edgeTypes = { deletable: DeletableEdge };

const qNodeId = (id: number) => `q:${id}`;
const startNodeId = "start";
const endNodeId = "end";
const parseQuestionId = (nodeId: string): number | null => {
  const m = /^q:(\d+)$/.exec(nodeId);
  return m ? Number(m[1]) : null;
};

// Функція побудови графа
function buildGraph(
  questions: UiQuestion[],
  startQuestionId: number | null | undefined,
): {
  nodes: FlowNode[];
  edges: Edge[];
} {
  const byId = new Map<number, UiQuestion>();
  for (const q of questions) byId.set(q.id, q);

  const questionNodes: QuestionFlowNode[] = questions
    .slice()
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .map((q, idx) => {
      const hasPos = q.pos_x !== 0 || q.pos_y !== 0;
      return {
        id: qNodeId(q.id),
        type: "question",
        position: hasPos
          ? { x: q.pos_x, y: q.pos_y }
          : { x: 100, y: 100 + idx * 250 },
        data: {
          question: q,
          onPatchQuestion: () => {},
          onDeleteQuestion: () => {},
          onAddOption: () => {},
          onPatchOption: () => {},
          onDeleteOption: () => {},
          onUploadPhoto: () => {},
          onDeletePhoto: () => {},
        },
      };
    });

  const posByQid = new Map<number, { x: number; y: number }>();
  for (const n of questionNodes) {
    const id = parseQuestionId(n.id);
    if (id) posByQid.set(id, n.position);
  }

  const sortedQuestions = questions
    .slice()
    .sort((a, b) => a.sort - b.sort || a.id - b.id);
  const fallbackStartId = sortedQuestions[0]?.id ?? null;
  const validStartId =
    typeof startQuestionId === "number" && byId.has(startQuestionId)
      ? startQuestionId
      : null;
  const anchorStartId = validStartId ?? fallbackStartId;

  const bbox = questionNodes.reduce(
    (acc, n) => {
      acc.minX = Math.min(acc.minX, n.position.x);
      acc.maxX = Math.max(acc.maxX, n.position.x);
      acc.minY = Math.min(acc.minY, n.position.y);
      acc.maxY = Math.max(acc.maxY, n.position.y);
      return acc;
    },
    {
      minX: questionNodes[0]?.position.x ?? 0,
      maxX: questionNodes[0]?.position.x ?? 0,
      minY: questionNodes[0]?.position.y ?? 0,
      maxY: questionNodes[0]?.position.y ?? 0,
    },
  );

  const startAnchor = anchorStartId ? posByQid.get(anchorStartId) : null;

  const startNode: StartFlowNode = {
    id: startNodeId,
    type: "start",
    position: startAnchor
      ? { x: startAnchor.x - 240, y: startAnchor.y }
      : { x: bbox.minX - 240, y: bbox.minY },
    data: {},
  };

  const endNode: EndFlowNode = {
    id: endNodeId,
    type: "end",
    position: startAnchor
      ? { x: bbox.maxX + 520, y: startAnchor.y }
      : { x: bbox.maxX + 520, y: bbox.maxY },
    data: {},
  };

  const nodes: FlowNode[] = [startNode, ...questionNodes, endNode];

  const edges: Edge[] = [];
  const markerBlue = { type: MarkerType.ArrowClosed, color: "#2563eb" } as any;
  const markerSlate = { type: MarkerType.ArrowClosed, color: "#94a3b8" } as any;

  if (validStartId) {
    edges.push({
      id: "e:start",
      type: "deletable",
      source: startNodeId,
      sourceHandle: "start",
      target: qNodeId(validStartId),
      animated: true,
      markerEnd: markerBlue,
    });
  }

  for (const q of questions) {
    if (q.next_question_id && byId.has(q.next_question_id)) {
      edges.push({
        id: `e:q:${q.id}`,
        type: "deletable",
        source: qNodeId(q.id),
        sourceHandle: "default",
        target: qNodeId(q.next_question_id),
        animated: true,
        markerEnd: markerBlue,
      });
    } else if (q.ends_flow) {
      edges.push({
        id: `e:end:q:${q.id}`,
        type: "deletable",
        source: qNodeId(q.id),
        sourceHandle: "default",
        target: endNodeId,
        style: { strokeDasharray: "6 4", stroke: "#94a3b8" },
        markerEnd: markerSlate,
      });
    }

    if (q.qtype === "single_choice") {
      const options = q.options ?? [];
      for (const o of options) {
        if (o.next_question_id && byId.has(o.next_question_id)) {
          edges.push({
            id: `e:opt:${o.id}`,
            type: "deletable",
            source: qNodeId(q.id),
            sourceHandle: `opt:${o.id}`,
            target: qNodeId(o.next_question_id),
            markerEnd: markerBlue,
          });
        } else if (o.ends_flow) {
          edges.push({
            id: `e:end:opt:${o.id}`,
            type: "deletable",
            source: qNodeId(q.id),
            sourceHandle: `opt:${o.id}`,
            target: endNodeId,
            style: { strokeDasharray: "6 4", stroke: "#94a3b8" },
            markerEnd: markerSlate,
          });
        }
      }
    }
  }

  return { nodes, edges };
}

// Внутрішній компонент з логікою
function ServicesFlowContent(props: {
  initialServiceId?: number | null;
  onServiceSelected?: (id: number) => void;
}) {
  const toast = useToast();
  const { screenToFlowPosition } = useReactFlow();
  const flowWrapRef = useRef<HTMLDivElement | null>(null);
  const lastFlowPointRef = useRef<{ x: number; y: number } | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    null,
  );
  const [questions, setQuestions] = useState<UiQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
    flowX: number;
    flowY: number;
  } | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId),
    [services, selectedServiceId],
  );

  const loadServices = async () => {
    try {
      const list = await apiRequest<Service[]>("GET", "/api/services");
      setServices(list.sort((a, b) => a.sort - b.sort || a.id - b.id));
    } catch (e: any) {
      toast.push({
        title: "Помилка завантаження послуг",
        message: e?.message,
        tone: "error",
      });
    }
  };

  const slugify = (title: string) => {
    const base = title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const safe = base || "service";
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${safe}-${suffix}`.slice(0, 64);
  };

  const createService = async () => {
    const title = (prompt("Назва послуги (title):") ?? "").trim();
    if (!title) return;
    const slug = slugify(title);

    try {
      const created = await apiRequest<Service>("POST", "/api/services", {
        slug,
        title,
        is_active: true,
        sort: 100,
      });
      setServices((prev) =>
        [...prev, created]
          .slice()
          .sort((a, b) => a.sort - b.sort || a.id - b.id),
      );
      setSelectedServiceId(created.id);
      await loadQuestions(created.id);
      toast.push({ title: "Послуга створена", tone: "success" });
    } catch (e: any) {
      toast.push({
        title: "Не вдалося створити послугу",
        message: e?.message,
        tone: "error",
      });
    }
  };

  const loadQuestions = async (serviceId: number) => {
    setLoadingQuestions(true);
    try {
      const res = await apiRequest<{ questions: UiQuestion[] }>(
        "GET",
        `/api/services/${serviceId}/questions`,
      );
      const list = res.questions.map((q) => ({
        ...q,
        photo_path: q.photo_path ?? null,
        options: (q.options ?? []).sort(
          (a, b) =>
            (a.keyboard_row ?? 0) - (b.keyboard_row ?? 0) ||
            (a.keyboard_col ?? 0) - (b.keyboard_col ?? 0) ||
            a.sort - b.sort ||
            a.id - b.id,
        ),
        is_archived: q.is_archived ?? false,
      }));
      setQuestions(list);
    } catch (e: any) {
      toast.push({
        title: "Помилка завантаження",
        message: e?.message,
        tone: "error",
      });
    } finally {
      setLoadingQuestions(false);
    }
  };

  const refreshGraph = (
    qs: UiQuestion[],
    archived: boolean,
    startQid: number | null | undefined,
  ) => {
    const visible = archived ? qs : qs.filter((q) => !q.is_archived);
    const byId = new Map<number, UiQuestion>(visible.map((q) => [q.id, q]));

    const g = buildGraph(visible, startQid);
    setNodes(
      g.nodes.map((n) => {
        if ((n as any).type !== "question") return n as any;
        const id = parseQuestionId(n.id);
        const q = (id ? byId.get(id) : null) ?? (n.data as any)?.question;
        return {
          ...n,
          data: {
            question: q,
            onPatchQuestion: (qid: number, p: any) =>
              void patchQuestion(qid, p),
            onDeleteQuestion: async (qid: number) => {
              if (!confirm("Видалити це питання?")) return;
              const res = await apiRequest<{ ok: boolean; archived: boolean }>(
                "DELETE",
                `/api/questions/${qid}`,
              );
              if (res.archived) {
                setQuestions((prev) =>
                  prev.map((qq) =>
                    qq.id === qid
                      ? { ...qq, is_archived: true, next_question_id: null }
                      : qq,
                  ),
                );
              } else {
                setQuestions((prev) => prev.filter((qq) => qq.id !== qid));
              }
            },
            onAddOption: async (qid: number) => {
              const opt = await apiRequest<QuestionOption>(
                "POST",
                `/api/questions/${qid}/options`,
                { text: "Новий варіант", sort: 100 },
              );
              setQuestions((prev) =>
                prev.map((qq) =>
                  qq.id === qid
                    ? {
                        ...qq,
                        options: [...qq.options, opt]
                          .slice()
                          .sort(
                            (a, b) =>
                              (a.keyboard_row ?? 0) - (b.keyboard_row ?? 0) ||
                              (a.keyboard_col ?? 0) - (b.keyboard_col ?? 0) ||
                              a.sort - b.sort ||
                              a.id - b.id,
                          ),
                      }
                    : qq,
                ),
              );
            },
            onPatchOption: async (oid: number, p: any) => {
              await apiRequest("PATCH", `/api/options/${oid}`, p);
              setQuestions((prev) =>
                prev.map((qq) => {
                  const nextOptions = qq.options
                    .map((o) => (o.id === oid ? { ...o, ...p } : o))
                    .slice()
                    .sort(
                      (a, b) =>
                        (a.keyboard_row ?? 0) - (b.keyboard_row ?? 0) ||
                        (a.keyboard_col ?? 0) - (b.keyboard_col ?? 0) ||
                        a.sort - b.sort ||
                        a.id - b.id,
                    );
                  return { ...qq, options: nextOptions };
                }),
              );
            },
            onDeleteOption: async (oid: number) => {
              await apiRequest("DELETE", `/api/options/${oid}`);
              setQuestions((prev) =>
                prev.map((qq) => ({
                  ...qq,
                  options: qq.options.filter((o) => o.id !== oid),
                })),
              );
            },
            onUploadPhoto: (qid: number, file: File) =>
              void uploadQuestionPhoto(qid, file),
            onDeletePhoto: (qid: number) => void deleteQuestionPhoto(qid),
          },
        };
      }),
    );
    setEdges(
      g.edges.map((e) =>
        e.type === "deletable"
          ? ({
              ...e,
              data: {
                onDelete: (id: string) => void deleteEdgeById(id),
              } as DeletableEdgeData,
            } as any)
          : e,
      ),
    );
  };

  useEffect(() => {
    void loadServices();
  }, []);

  useEffect(() => {
    refreshGraph(
      questions,
      showArchived,
      selectedService?.start_question_id ?? null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, showArchived, selectedService?.start_question_id]);

  useEffect(() => {
    if (services.length > 0 && !selectedServiceId) {
      const id = props.initialServiceId || services[0].id;
      setSelectedServiceId(id);
      void loadQuestions(id);
    }
  }, [services]);

  const patchQuestion = async (id: number, patch: any) => {
    const updated = await apiRequest<UiQuestion>(
      "PATCH",
      `/api/questions/${id}`,
      patch,
    );
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updated } : q)),
    );
  };

  const uploadQuestionPhoto = async (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const updated = await apiRequestForm<UiQuestion>(
      "POST",
      `/api/questions/${id}/photo`,
      form,
    );
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updated } : q)),
    );
  };

  const deleteQuestionPhoto = async (id: number) => {
    const updated = await apiRequest<UiQuestion>(
      "DELETE",
      `/api/questions/${id}/photo`,
    );
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updated } : q)),
    );
  };

  const createQuestion = async (x: number, y: number) => {
    if (!selectedServiceId) return;
    try {
      const q = await apiRequest<UiQuestion>(
        "POST",
        `/api/services/${selectedServiceId}/questions`,
        {
          text: "Нове питання",
          qtype: "text",
          pos_x: Math.round(x),
          pos_y: Math.round(y),
          is_required: true,
          sort: 100,
        },
      );
      setQuestions((prev) => [...prev, { ...q, options: [] }]);
      lastFlowPointRef.current = { x: q.pos_x, y: q.pos_y };
      toast.push({ title: "Питання створено", tone: "success" });
      setMenuPosition(null);
    } catch (e: any) {
      toast.push({ title: "Помилка", message: e.message, tone: "error" });
    }
  };

  const createQuestionNearView = async () => {
    // Prefer placing near the last interaction point (RMB/click/create/select),
    // otherwise near selected node, otherwise center of current viewport.
    const last = lastFlowPointRef.current;
    if (last) {
      await createQuestion(last.x + 520, last.y);
      return;
    }

    const selected = nodes.find(
      (n) => (n as any).type === "question" && Boolean((n as any).selected),
    );
    if (selected) {
      await createQuestion(selected.position.x + 520, selected.position.y);
      return;
    }

    const el = flowWrapRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const p = screenToFlowPosition({
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
      });
      await createQuestion(p.x, p.y);
      return;
    }

    await createQuestion(100, 100);
  };

  const deleteEdgeById = async (edgeId: string) => {
    try {
      if (edgeId === "e:start") {
        if (selectedServiceId) {
          const updated = await apiRequest<Service>(
            "PATCH",
            `/api/services/${selectedServiceId}`,
            { start_question_id: null },
          );
          setServices((prev) =>
            prev.map((s) =>
              s.id === selectedServiceId ? { ...s, ...updated } : s,
            ),
          );
        }
      } else if (edgeId.startsWith("e:end:q:")) {
        const qid = Number(edgeId.split(":")[3]);
        await patchQuestion(qid, { next_question_id: null, ends_flow: false });
      } else if (edgeId.startsWith("e:end:opt:")) {
        const optId = edgeId.split(":")[3];
        await apiRequest("PATCH", `/api/options/${optId}`, {
          next_question_id: null,
          ends_flow: false,
        });
        setQuestions((prev) =>
          prev.map((q) => ({
            ...q,
            options: q.options.map((o) =>
              o.id === Number(optId) ? { ...o, ends_flow: false } : o,
            ),
          })),
        );
      } else if (edgeId.startsWith("e:q:")) {
        await patchQuestion(Number(edgeId.split(":")[2]), {
          next_question_id: null,
          ends_flow: false,
        });
      } else if (edgeId.startsWith("e:opt:")) {
        const optId = edgeId.split(":")[2];
        await apiRequest("PATCH", `/api/options/${optId}`, {
          next_question_id: null,
          ends_flow: false,
        });
        setQuestions((prev) =>
          prev.map((q) => ({
            ...q,
            options: q.options.map((o) =>
              o.id === Number(optId)
                ? { ...o, next_question_id: null, ends_flow: false }
                : o,
            ),
          })),
        );
      }
      setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    } catch (e: any) {
      toast.push({
        title: "Помилка видалення зв'язку",
        message: e.message,
        tone: "error",
      });
    }
  };

  const onConnect: OnConnect = async (conn) => {
    if (!conn.source || !conn.target) return;
    const handle = conn.sourceHandle || "default";
    try {
      if (conn.source === startNodeId) {
        const dstId = parseQuestionId(conn.target);
        if (!selectedServiceId || dstId === null) return;
        const updated = await apiRequest<Service>(
          "PATCH",
          `/api/services/${selectedServiceId}`,
          { start_question_id: dstId },
        );
        setServices((prev) =>
          prev.map((s) =>
            s.id === selectedServiceId ? { ...s, ...updated } : s,
          ),
        );
        return;
      }

      if (conn.target === endNodeId) {
        const srcId = parseQuestionId(conn.source);
        if (srcId === null) return;
        if (handle === "default") {
          await patchQuestion(srcId, {
            next_question_id: null,
            ends_flow: true,
          });
        } else {
          const optId = Number(handle.split(":")[1]);
          await apiRequest("PATCH", `/api/options/${optId}`, {
            next_question_id: null,
            ends_flow: true,
          });
          setQuestions((prev) =>
            prev.map((q) => ({
              ...q,
              options: q.options.map((o) =>
                o.id === optId
                  ? { ...o, next_question_id: null, ends_flow: true }
                  : o,
              ),
            })),
          );
        }
        await loadQuestions(selectedServiceId!);
        return;
      }

      const srcId = parseQuestionId(conn.source);
      const dstId = parseQuestionId(conn.target);
      if (srcId === null || dstId === null) return;
      if (handle === "default") {
        await patchQuestion(srcId, {
          next_question_id: dstId,
          ends_flow: false,
        });
      } else {
        const optId = Number(handle.split(":")[1]);
        await apiRequest("PATCH", `/api/options/${optId}`, {
          next_question_id: dstId,
          ends_flow: false,
        });
        setQuestions((prev) =>
          prev.map((q) => ({
            ...q,
            options: q.options.map((o) =>
              o.id === optId
                ? { ...o, next_question_id: dstId, ends_flow: false }
                : o,
            ),
          })),
        );
      }
      await loadQuestions(selectedServiceId!);
    } catch (e: any) {
      toast.push({
        title: "Помилка з'єднання",
        message: e.message,
        tone: "error",
      });
    }
  };

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      // Закриваємо меню, якщо клікнули в іншому місці, або відкриваємо нове
      const p = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      lastFlowPointRef.current = { x: p.x, y: p.y };
      setMenuPosition(null);
    },
    [screenToFlowPosition],
  );

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
      event.preventDefault();
      event.stopPropagation();

      const p = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      lastFlowPointRef.current = { x: p.x, y: p.y };
      setMenuPosition({
        x: event.clientX + 8,
        y: event.clientY + 8,
        flowX: p.x,
        flowY: p.y,
      });
    },
    [screenToFlowPosition],
  );

  /* useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const q = questionIndex.get(parseQuestionId(n.id)!);
        if (!q) return n;
        return {
          ...n,
          data: {
            question: q,
            onPatchQuestion: (id, p) => void patchQuestion(id, p),
            onDeleteQuestion: async (id) => {
              if (!confirm("Видалити це питання?")) return;
              await apiRequest("DELETE", `/api/questions/${id}`);
              setQuestions((prev) => prev.filter((x) => x.id !== id));
            },
            onAddOption: async (qid) => {
              const opt = await apiRequest<QuestionOption>(
                "POST",
                `/api/questions/${qid}/options`,
                { text: "Новий варіант", sort: 100 },
              );
              setQuestions((prev) =>
                prev.map((q) =>
                  q.id === qid
                    ? {
                        ...q,
                        options: [...q.options, opt].slice().sort(
                          (a, b) =>
                            (a.keyboard_row ?? 0) - (b.keyboard_row ?? 0) ||
                            (a.keyboard_col ?? 0) - (b.keyboard_col ?? 0) ||
                            a.sort - b.sort ||
                            a.id - b.id,
                        ),
                      }
                    : q,
                ),
              );
            },
            onPatchOption: async (oid, p) => {
              await apiRequest("PATCH", `/api/options/${oid}`, p);
              setQuestions((prev) =>
                prev.map((q) => {
                  const nextOptions = q.options
                    .map((o) => (o.id === oid ? { ...o, ...p } : o))
                    .slice()
                    .sort(
                      (a, b) =>
                        (a.keyboard_row ?? 0) - (b.keyboard_row ?? 0) ||
                        (a.keyboard_col ?? 0) - (b.keyboard_col ?? 0) ||
                        a.sort - b.sort ||
                        a.id - b.id,
                    );
                  return { ...q, options: nextOptions };
                }),
              );
            },
            onDeleteOption: async (oid) => {
              await apiRequest("DELETE", `/api/options/${oid}`);
              setQuestions((prev) =>
                prev.map((q) => ({
                  ...q,
                  options: q.options.filter((o) => o.id !== oid),
                })),
              );
            },
            onUploadPhoto: (qid, file) => void uploadQuestionPhoto(qid, file),
            onDeletePhoto: (qid) => void deleteQuestionPhoto(qid),
          },
        };
      }),
    );
  }, [questions, showArchived]); */

  return (
    <div
      className="flex h-[calc(100vh-140px)] flex-col gap-4 overflow-hidden"
      onClick={() => menuPosition && setMenuPosition(null)}
    >
      <header className="flex shrink-0 items-center justify-between rounded-[24px] bg-white/80 p-2 shadow-sm ring-1 ring-black/5 backdrop-blur-md">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-2">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelectedServiceId(s.id);
                void loadQuestions(s.id);
              }}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                selectedServiceId === s.id
                  ? "bg-zinc-900 text-white shadow-lg"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {s.title}
              {!s.is_active && (
                <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void createService()}
            className="flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold text-zinc-500 hover:bg-zinc-100"
            title="Створити нову послугу"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Додати послугу</span>
          </button>
        </div>

        <div className="flex items-center gap-2 pr-2 border-l border-zinc-100 ml-4 pl-4">
          <Button
            variant="secondary"
            onClick={() => setShowArchived(!showArchived)}
            className="rounded-xl h-10"
          >
            {showArchived ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            <span className="hidden sm:inline ml-2 text-xs">Архів</span>
          </Button>
          <Button
            onClick={() => void createQuestionNearView()}
            className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-2 text-xs font-bold uppercase tracking-wider">
              Додати питання
            </span>
          </Button>
        </div>
      </header>

      <div
        ref={flowWrapRef}
        className="relative flex-1 rounded-[32px] bg-zinc-50 overflow-hidden shadow-inner border border-zinc-200/50"
      >
        {loadingQuestions && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
            <Spinner className="h-8 w-8 text-indigo-600" />
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChangeBase as any}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeClick={(_, node) => {
            setMenuPosition(null);
            lastFlowPointRef.current = { x: node.position.x, y: node.position.y };
          }}
          onNodeDragStop={(_, node) => {
            lastFlowPointRef.current = { x: node.position.x, y: node.position.y };
            void patchQuestion(parseQuestionId(node.id)!, {
              pos_x: Math.round(node.position.x),
              pos_y: Math.round(node.position.y),
            });
          }}
          fitView
          defaultEdgeOptions={{
            type: "deletable",
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 3 },
          }}
        >
          <Background color="#ccc" gap={24} size={1} variant={"dots" as any} />
          <Controls
            {...({ className: "rounded-xl shadow-xl border-none" } as any)}
          />
          <MiniMap
            {...({
              nodeColor: "#e2e8f0",
              className:
                "!right-4 !bottom-4 rounded-2xl border border-zinc-200 shadow-2xl",
            } as any)}
          />

          {/* Кнопка створення на місці кліку */}
          {menuPosition && (
            <div
              className="fixed z-[1000] animate-in fade-in zoom-in duration-150"
              style={{ top: menuPosition.y, left: menuPosition.x }}
            >
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  createQuestion(menuPosition.flowX, menuPosition.flowY);
                }}
                className="shadow-2xl bg-zinc-900 hover:bg-black text-white rounded-full px-6 py-6 h-auto border-4 border-white flex items-center gap-2"
              >
                <FilePlus2 className="h-5 w-5" />
                Створити блок тут
              </Button>
            </div>
          )}

          <Panel position="top-right">
            <Card className="shadow-2xl border-none min-w-[220px] bg-white/90 backdrop-blur">
              <CardBody className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-zinc-900 font-bold text-sm">
                  <Settings2 className="h-4 w-4" /> Налаштування послуги
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-400">
                      Назва
                    </label>
                    <Input
                      className="h-8 text-sm"
                      defaultValue={selectedService?.title}
                      onBlur={(e) =>
                        void apiRequest(
                          "PATCH",
                          `/api/services/${selectedServiceId}`,
                          { title: e.target.value },
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-500">
                      Активна
                    </span>
                    <input
                      type="checkbox"
                      className="accent-indigo-600 h-4 w-4"
                      checked={selectedService?.is_active}
                      onChange={(e) =>
                        void apiRequest(
                          "PATCH",
                          `/api/services/${selectedServiceId}`,
                          { is_active: e.target.checked },
                        )
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full text-red-500 hover:bg-red-50 h-8 text-xs"
                    onClick={() => {
                      if (confirm("Видалити/вимкнути цю послугу?"))
                        apiRequest(
                          "DELETE",
                          `/api/services/${selectedServiceId}`,
                        );
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-2" /> Видалити
                  </Button>
                </div>
              </CardBody>
            </Card>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

// Головний компонент з Провайдером
export function ServicesPage(props: {
  initialServiceId?: number | null;
  onServiceSelected?: (id: number) => void;
}) {
  return (
    <ReactFlowProvider>
      <ServicesFlowContent {...props} />
    </ReactFlowProvider>
  );
}
