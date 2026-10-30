import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Zap,
  Clock,
  CheckCircle2,
  ListPlus,
  Play,
  X,
  Loader2,
  Lightbulb,
  Check,
  BookOpen,
  ExternalLink,
  FileText,
  GraduationCap,
  Wrench,
  Newspaper,
} from "lucide-react";
import { TaskSource } from "../lib/gemini";

export interface MicroStep {
  title: string;
  durationMinutes: number;
  tip: string;
}

export interface DecompositionResult {
  rationale: string;
  steps: MicroStep[];
  recommendedSources?: TaskSource[];
}

interface TaskDecompositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  taskDescription?: string;
  duration?: number;
  goal?: string;
  onAddSubtasks: (newTasks: { title: string; duration: number; description?: string; sources?: TaskSource[] }[]) => void;
  onStartFocusStep?: (step: MicroStep) => void;
}

export const TaskDecompositionModal: React.FC<TaskDecompositionModalProps> = ({
  isOpen,
  onClose,
  taskTitle,
  taskDescription,
  duration,
  goal,
  onAddSubtasks,
  onStartFocusStep,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DecompositionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedIndices, setCompletedIndices] = useState<number[]>([]);
  const [hasAddedToTasks, setHasAddedToTasks] = useState(false);

  // Trigger decomposition
  const fetchDecomposition = async () => {
    setLoading(true);
    setError(null);
    setHasAddedToTasks(false);
    setCompletedIndices([]);
    try {
      const res = await fetch("/api/ai/decomposeTask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle,
          taskDescription,
          duration: duration || 30,
          goal: goal || "High Performance",
        }),
      });

      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const result: DecompositionResult = await res.json();
        if (result && result.steps && result.steps.length > 0) {
          setData(result);
          return;
        }
      }

      // Safe procedural fallback if server returned non-JSON or during initialization
      const totalDur = duration || 30;
      const stepDur = Math.max(5, Math.floor(totalDur / 3));
      setData({
        rationale: "Bypassing activation friction into three low-resistance execution checkpoints.",
        steps: [
          {
            title: `Set up workspace & define 1-sentence outcome for "${taskTitle}"`,
            durationMinutes: Math.min(10, stepDur),
            tip: "Close unrelated tabs and open only the direct tools needed.",
          },
          {
            title: `Execute the core implementation sprint`,
            durationMinutes: Math.max(15, totalDur - stepDur * 2),
            tip: "Focus purely on forward velocity. Avoid editing or perfectionism during drafting.",
          },
          {
            title: `Review final details, polish output, and close out`,
            durationMinutes: Math.min(10, stepDur),
            tip: "Validate against requirements and mark complete.",
          },
        ],
        recommendedSources: [
          {
            title: `${taskTitle} Reference & Documentation`,
            url: `https://www.google.com/search?q=${encodeURIComponent(taskTitle + " documentation tutorial reference")}`,
            type: "documentation",
            description: "Direct reference manual and official documentation for this task."
          },
          {
            title: "Atomic Habits (James Clear)",
            url: "https://jamesclear.com/atomic-habits",
            type: "book",
            description: "Overcoming activation energy and building frictionless work sessions."
          }
        ]
      });
    } catch (err: any) {
      console.warn("Using procedural decomposition baseline:", err);
      const totalDur = duration || 30;
      const stepDur = Math.max(5, Math.floor(totalDur / 3));
      setData({
        rationale: "Bypassing activation friction into three low-resistance execution checkpoints.",
        steps: [
          {
            title: `Clarify initial requirements and gather assets for "${taskTitle}"`,
            durationMinutes: Math.min(10, stepDur),
            tip: "Focus purely on starting.",
          },
          {
            title: `Deep focus sprint on core task components`,
            durationMinutes: Math.max(15, totalDur - stepDur * 2),
            tip: "Maintain momentum through to completion.",
          },
          {
            title: `Final review and verification`,
            durationMinutes: Math.min(10, stepDur),
            tip: "Double check your output and claim your XP.",
          },
        ],
        recommendedSources: [
          {
            title: `${taskTitle} Study Materials`,
            url: `https://www.google.com/search?q=${encodeURIComponent(taskTitle + " guide tutorial")}`,
            type: "documentation",
            description: "Comprehensive step-by-step guidance."
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  // Run on first open if no data
  React.useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      setError(null);
      fetchDecomposition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, taskTitle]);

  if (!isOpen) return null;

  const toggleStepCompletion = (idx: number) => {
    setCompletedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleAddAllToPlan = () => {
    if (!data?.steps) return;
    const formatted = data.steps.map((s) => ({
      title: s.title,
      duration: s.durationMinutes,
      description: `Micro-step: ${s.tip}`,
      sources: data.recommendedSources || [],
    }));
    onAddSubtasks(formatted);
    setHasAddedToTasks(true);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="glass-card w-full max-w-lg p-6 relative z-10 border border-amber-500/30 bg-gradient-to-b from-[#18181b]/95 to-[#09090b]/95 shadow-[0_0_50px_rgba(245,158,11,0.15)] rounded-2xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4 shrink-0 pb-3 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Zap className="w-5 h-5 fill-amber-400/20 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Smart Task Breakdown
                  </h2>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full">
                    Pro
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate max-w-sm">
                  {taskTitle}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto pr-1 flex-1 space-y-4">
            {loading && (
              <div className="py-16 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                <p className="text-sm text-gray-300 font-medium">
                  Deconstructing psychological friction...
                </p>
                <p className="text-xs text-gray-500">
                  Engineering 5–15 minute low-resistance entry points
                </p>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex flex-col space-y-2">
                <p>{error}</p>
                <button
                  onClick={fetchDecomposition}
                  className="self-start text-[11px] font-bold text-red-400 underline hover:text-red-300"
                >
                  Retry Analysis
                </button>
              </div>
            )}

            {data && !loading && (
              <>
                {/* Rationale Banner */}
                <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-200/90 flex items-start space-x-2.5">
                  <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong className="text-amber-300">Action Plan: </strong>
                    {data.rationale}
                  </p>
                </div>

                {/* Steps List */}
                <div className="space-y-2.5">
                  <p className="text-[11px] uppercase font-bold tracking-widest text-gray-400">
                    Execution Micro-Steps ({completedIndices.length}/{data.steps.length} done)
                  </p>

                  {data.steps.map((step, idx) => {
                    const isDone = completedIndices.includes(idx);
                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isDone
                            ? "bg-white/[0.02] border-white/5 opacity-60 line-through"
                            : "bg-white/5 border-white/10 hover:border-amber-500/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            onClick={() => toggleStepCompletion(idx)}
                            className="flex items-start space-x-3 text-left flex-1 group"
                          >
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                isDone
                                  ? "bg-amber-500 border-amber-500 text-black"
                                  : "border-white/20 group-hover:border-amber-400"
                              }`}
                            >
                              {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white leading-snug">
                                {idx + 1}. {step.title}
                              </p>
                              <p className="text-[11px] text-gray-400 mt-0.5 not-italic">
                                {step.tip}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="flex items-center space-x-1 text-[11px] font-medium text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                              <Clock className="w-3 h-3" />
                              <span>{step.durationMinutes}m</span>
                            </span>

                            {onStartFocusStep && !isDone && (
                              <button
                                onClick={() => {
                                  onStartFocusStep(step);
                                  onClose();
                                }}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-400 hover:text-black text-gray-300 transition-colors"
                                title="Start Focus Sprint on this step"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recommended Sources & Reference Materials */}
                {data.recommendedSources && data.recommendedSources.length > 0 && (
                  <div className="pt-2 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-[11px] uppercase font-bold tracking-widest text-amber-400">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Materials & Reference Sources</span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium">
                        Where to get materials
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {data.recommendedSources.map((source, sIdx) => {
                        const targetUrl = source.url || `https://www.google.com/search?q=${encodeURIComponent(source.title + ' ' + (goal || ''))}`;
                        return (
                          <div
                            key={sIdx}
                            className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 hover:border-amber-500/30 transition-all flex items-start justify-between gap-3 text-left group"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/20 shrink-0">
                                  {source.type || "material"}
                                </span>
                                <h4 className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                                  {source.title}
                                </h4>
                              </div>
                              {source.description && (
                                <p className="text-[11px] text-gray-400 leading-relaxed">
                                  {source.description}
                                </p>
                              )}
                            </div>

                            <a
                              href={targetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-amber-300 hover:bg-amber-400/10 rounded-lg transition-colors shrink-0"
                              title="Open material in new tab"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Actions */}
          {data && !loading && (
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
              <button
                onClick={handleAddAllToPlan}
                disabled={hasAddedToTasks}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 disabled:opacity-60"
              >
                {hasAddedToTasks ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Added to Task List!</span>
                  </>
                ) : (
                  <>
                    <ListPlus className="w-4 h-4" />
                    <span>Add {data.steps.length} Steps to Tasks</span>
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-white/10 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
