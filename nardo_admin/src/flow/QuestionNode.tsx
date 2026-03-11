import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ListChecks,
  Mail,
  Plus,
  Phone,
  Type,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { apiRequestBlob } from "../api/http";
import type { Question, QuestionOption, QuestionType } from "../api/types";
import { Button, Input, Select, Textarea } from "../components/ui";

export type QuestionNodeData = {
  question: Question;
  onPatchQuestion: (questionId: number, patch: Partial<Question>) => void;
  onDeleteQuestion: (questionId: number) => void;
  onAddOption: (questionId: number) => void;
  onPatchOption: (optionId: number, patch: Partial<QuestionOption>) => void;
  onDeleteOption: (optionId: number) => void;
  onUploadPhoto: (questionId: number, file: File) => void;
  onDeletePhoto: (questionId: number) => void;
};

export type QuestionFlowNode = Node<QuestionNodeData, "question">;

const TYPE_CONFIG = {
  single_choice: {
    label: "Вибір",
    icon: ListChecks,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-100",
  },
  phone: {
    label: "Телефон",
    icon: Phone,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
  email: {
    label: "Email",
    icon: Mail,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  text: {
    label: "Текст",
    icon: Type,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
};

export function QuestionNode(props: NodeProps<QuestionFlowNode>) {
  const q = props.data.question;
  const config =
    TYPE_CONFIG[q.qtype as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.text;
  const [text, setText] = useState(q.text ?? "");
  const [code, setCode] = useState(q.code ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => setText(q.text ?? ""), [q.text]);
  useEffect(() => setCode(q.code ?? ""), [q.code]);

  useEffect(() => {
    let url: string | null = null;
    if (!q.photo_path) {
      setPhotoUrl(null);
      return;
    }
    apiRequestBlob(`/api/questions/${q.id}/photo`)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setPhotoUrl(url);
      })
      .catch(() => setPhotoUrl(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [q.id, q.photo_path]);

  const matrix = useMemo(() => {
    const rows: Record<number, QuestionOption[]> = {};
    (q.options ?? []).forEach((o) => {
      const r = o.keyboard_row ?? 0;
      if (!rows[r]) rows[r] = [];
      rows[r].push(o);
    });
    return Object.keys(rows)
      .map(Number)
      .sort((a, b) => a - b)
      .map((r) =>
        rows[r].sort((a, b) => (a.keyboard_col ?? 0) - (b.keyboard_col ?? 0)),
      );
  }, [q.options]);

  const applyLayout = (cols: number | null) => {
    const opts = [...(q.options ?? [])];
    opts.forEach((o, i) => {
      const row = cols === null ? i : Math.floor(i / cols);
      const col = cols === null ? 0 : i % cols;
      props.data.onPatchOption(o.id, {
        keyboard_row: row,
        keyboard_col: col,
      } as any);
    });
  };

  const moveOption = (id: number, dr: number, dc: number) => {
    const opt = q.options.find((o) => o.id === id);
    if (!opt) return;
    props.data.onPatchOption(id, {
      keyboard_row: Math.max(0, (opt.keyboard_row ?? 0) + dr),
      keyboard_col: Math.max(0, (opt.keyboard_col ?? 0) + dc),
    } as any);
  };

  return (
    <div
      className={`w-[480px] rounded-[2rem] bg-white border transition-all duration-300 shadow-xl ${
        props.selected
          ? "ring-8 ring-blue-500/5 border-blue-500"
          : "border-slate-100"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-blue-500 !border-[3px] !border-white shadow-lg"
      />

      {/* Header */}
      <div className="p-6 flex items-start justify-between bg-slate-50/40 rounded-t-[2rem] border-b border-slate-100">
        <div className="flex gap-4">
          <div
            className={`p-3.5 rounded-2xl ${config.bg} ${config.border} border shadow-sm`}
          >
            <config.icon className={`w-6 h-6 ${config.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Вузол #{q.id}
              </span>
              {q.is_required && (
                <div className="flex items-center text-[9px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-black border border-red-100 uppercase">
                  Обов'язково
                </div>
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">
              {config.label}
            </h3>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => props.data.onDeleteQuestion(q.id)}
          className="rounded-xl hover:bg-red-50 hover:text-red-500 text-slate-300 h-10 w-10 p-0 transition-all"
        >
          <Trash2 className="w-5 h-5" />
        </Button>
      </div>

      <div className="p-7 space-y-7">
        {/* Question Text */}
        <div className="space-y-3">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
            Текст запитання
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => props.data.onPatchQuestion(q.id, { text } as any)}
            className="nodrag min-h-[110px] bg-slate-50/50 border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all text-[15px] leading-relaxed resize-none"
            placeholder="Про що ви хочете запитати користувача?"
          />
        </div>

        {/* Media Block */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition-all hover:border-slate-300">
          <div className="flex items-center p-3.5 gap-4">
            <div className="relative h-16 w-16 flex-shrink-0">
              {photoUrl ? (
                <>
                  <img
                    src={photoUrl}
                    className="h-full w-full object-cover rounded-xl shadow-inner border border-white"
                  />
                  <button
                    onClick={() => props.data.onDeletePhoto(q.id)}
                    className="absolute -top-2 -right-2 bg-white shadow-lg text-red-500 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <div className="h-full w-full bg-slate-200/50 rounded-xl flex items-center justify-center text-slate-400 border border-dashed border-slate-300">
                  <ImageIcon className="w-7 h-7" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wide">
                Медіа (Фото)
              </p>
              <Input
                type="file"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) props.data.onUploadPhoto(q.id, file);
                }}
                className="nodrag h-8 text-[11px] p-0 border-none bg-transparent file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-slate-800 file:text-white cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
              Тип відповіді
            </label>
            <Select
              value={q.qtype}
              onChange={(e) =>
                props.data.onPatchQuestion(q.id, {
                  qtype: e.target.value as QuestionType,
                } as any)
              }
              className="nodrag h-11 bg-white border-slate-200 rounded-xl text-sm font-semibold shadow-sm"
            >
              <option value="single_choice">Кнопки вибору</option>
              <option value="text">Вільний текст</option>
              <option value="phone">Номер телефону</option>
              <option value="email">Електронна пошта</option>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
              ID змінної
            </label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onBlur={() => props.data.onPatchQuestion(q.id, { code } as any)}
              className="nodrag h-11 bg-white border-slate-200 rounded-xl text-sm font-mono font-bold text-blue-600 shadow-sm"
              placeholder="user_answer"
            />
          </div>
        </div>

        {/* Keyboard/Options Section */}
        {q.qtype === "single_choice" && (
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Конструктор кнопок
              </label>
              <div className="flex gap-2 nodrag">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-[10px] font-bold rounded-lg px-3"
                  onClick={() => applyLayout(1)}
                >
                  1 ст.
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-[10px] font-bold rounded-lg px-3"
                  onClick={() => applyLayout(2)}
                >
                  2 ст.
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-[10px] font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100"
                  onClick={() => props.data.onAddOption(q.id)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Додати
                </Button>
              </div>
            </div>

            <div className="space-y-3 nodrag p-4 bg-slate-50 rounded-[1.5rem] border border-slate-200/60">
              {matrix.map((row, rIdx) => (
                <div key={rIdx} className="flex gap-3">
                  {row.map((opt) => (
                    <div
                      key={opt.id}
                      className="group relative flex-1 min-w-0 bg-white border border-slate-200 rounded-[1rem] p-2 shadow-sm transition-all hover:border-blue-400 hover:ring-4 hover:ring-blue-500/5"
                    >
                      <Input
                        defaultValue={opt.text}
                        onBlur={(e) =>
                          props.data.onPatchOption(opt.id, {
                            text: e.target.value,
                          } as any)
                        }
                        className="h-9 text-[13px] border-none bg-transparent focus-visible:ring-0 px-2 font-bold text-slate-700"
                        placeholder="Текст..."
                      />

                      {/* Control Tooltip */}
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900 text-white rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-90 z-20 shadow-2xl shadow-black/20">
                        <button
                          onClick={() => moveOption(opt.id, 0, -1)}
                          className="p-1.5 hover:text-blue-400 transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveOption(opt.id, -1, 0)}
                          className="p-1.5 hover:text-blue-400 transition-colors"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveOption(opt.id, 1, 0)}
                          className="p-1.5 hover:text-blue-400 transition-colors"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveOption(opt.id, 0, 1)}
                          className="p-1.5 hover:text-blue-400 transition-colors"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-[1px] h-4 bg-slate-700 mx-1" />
                        <button
                          onClick={() => props.data.onDeleteOption(opt.id)}
                          className="p-1.5 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <Handle
                        type="source"
                        id={`opt:${opt.id}`}
                        position={Position.Right}
                        className="!w-3 !h-3 !bg-blue-500 !border-[2.5px] !border-white shadow-md transition-transform hover:scale-125"
                        style={{ right: -6 }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Connector Space */}
        <div className="pt-2 flex justify-end">
          <div className="p-1 rounded-full bg-slate-100 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-300 animate-pulse" />
          </div>
        </div>
      </div>

      <Handle
        type="source"
        id="default"
        position={Position.Right}
        className="!w-5 !h-5 !bg-slate-400 !border-[4px] !border-white shadow-lg hover:!bg-blue-500 transition-all"
      />
    </div>
  );
}
