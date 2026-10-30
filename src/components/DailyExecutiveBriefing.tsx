import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Sun,
  Compass,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Zap,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Flame,
} from "lucide-react";

export interface BriefingData {
  greeting: string;
  priorityDirective: string;
  mentalModel: {
    name: string;
    explanation: string;
  };
  scheduleStrategy: string;
  powerAffirmation: string;
}

interface DailyExecutiveBriefingProps {
  goal: string;
  tasks: any[];
  streak: number;
  xp: number;
  level: number;
  userName?: string;
  calendarEvents?: any[];
  onEnterTheZone: () => void;
}

export const DailyExecutiveBriefing: React.FC<DailyExecutiveBriefingProps> = ({
  goal,
  tasks,
  streak,
  xp,
  level,
  userName,
  calendarEvents = [],
  onEnterTheZone,
}) => {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const fetchBriefing = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/getDailyBriefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          tasks,
          streak,
          xp,
          level,
          userName: userName || "Operator",
          calendarEvents,
        }),
      });

      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const json = await res.json();
        if (json && json.greeting && json.priorityDirective) {
          setData(json);
          return;
        }
      }

      // Safe fallback if server responded with non-JSON or during initialization
      const firstIncomplete = tasks.find((t: any) => !t.completed);
      const fallbackBriefing: BriefingData = {
        greeting: `Good morning, ${userName || "Operator"}.`,
        priorityDirective: firstIncomplete
          ? `Lock in on "${firstIncomplete.title}". Complete this high-impact objective first.`
          : `Execute today's primary focus block toward "${goal || "High Performance"}". Momentum begins now.`,
        mentalModel: {
          name: "Pareto Principle (80/20 Rule)",
          explanation: "80% of your progress will stem from 20% of your highest-leverage actions. Prioritize ruthlessly.",
        },
        scheduleStrategy: "Dedicate your first focus block to deep uninterrupted execution before handling messages.",
        powerAffirmation: "Discipline is choosing between what you want now and what you want most.",
      };
      setData(fallbackBriefing);
    } catch (err) {
      console.warn("Using offline executive briefing baseline:", err);
      const firstIncomplete = tasks.find((t: any) => !t.completed);
      setData({
        greeting: `Good morning, ${userName || "Operator"}.`,
        priorityDirective: firstIncomplete
          ? `Execute "${firstIncomplete.title}" with deep focus.`
          : `Commit to your primary objective for "${goal || "High Performance"}".`,
        mentalModel: {
          name: "Activation Energy",
          explanation: "The hardest part of any task is starting. Commit to the first 5 minutes in The Zone.",
        },
        scheduleStrategy: "Enter The Zone early. Early wins create unbreakable momentum.",
        powerAffirmation: "Standard over mood. Execution over emotion.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBriefing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal]);

  // Audio Speech Synthesis
  const handleToggleAudio = () => {
    if (!data) return;
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const textToSpeak = `${data.greeting}. Your #1 directive today: ${data.priorityDirective}. Mental model for execution: ${data.mentalModel.name}. ${data.mentalModel.explanation}. Schedule strategy: ${data.scheduleStrategy}. Conviction for today: ${data.powerAffirmation}.`;
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!data && !loading) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[#121215]/80 to-transparent p-5 backdrop-blur-md relative overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.08)]">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Sun className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Daily Executive Briefing
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full">
                Pro
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} • Strategic Alignment
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {data && (
            <button
              onClick={handleToggleAudio}
              className={`p-2 rounded-xl border transition-all text-xs flex items-center space-x-1.5 ${
                isPlayingAudio
                  ? "bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/30 font-bold"
                  : "bg-white/5 hover:bg-white/10 text-gray-300 border-white/10"
              }`}
              title={isPlayingAudio ? "Stop reading" : "Read aloud (Executive Voice)"}
            >
              {isPlayingAudio ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Brief Me</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={fetchBriefing}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Briefing"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="py-8 flex items-center justify-center space-x-3 text-sm text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Synthesizing your executive briefing...</span>
        </div>
      )}

      {/* Collapsible Content */}
      <AnimatePresence>
        {!isCollapsed && data && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-4 space-y-4"
          >
            {/* Top Greeting & Power Affirmation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white/5 border border-white/5">
              <div>
                <p className="font-bold text-amber-300 text-sm">
                  {data.greeting}
                </p>
                <p className="text-xs text-gray-300 italic mt-0.5">
                  "{data.powerAffirmation}"
                </p>
              </div>

              <button
                onClick={onEnterTheZone}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 shadow-lg shadow-amber-500/25 shrink-0 self-start sm:self-center active:scale-95 group"
              >
                <Zap className="w-4 h-4 fill-black text-black group-hover:scale-110 transition-transform" />
                <span>Lock In & Enter The Zone</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>

            {/* Strategic Pillars Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Pillar 1: Directive */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-amber-400 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                    <Flame className="w-3.5 h-3.5" />
                    <span>#1 Priority Directive</span>
                  </div>
                  <p className="text-gray-200 leading-relaxed font-medium">
                    {data.priorityDirective}
                  </p>
                </div>
              </div>

              {/* Pillar 2: Mental Model */}
              <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-blue-400 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                    <Compass className="w-3.5 h-3.5" />
                    <span>Mental Model: {data.mentalModel.name}</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">
                    {data.mentalModel.explanation}
                  </p>
                </div>
              </div>

              {/* Pillar 3: Flow & Pacing */}
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-purple-400 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Cadence Strategy</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">
                    {data.scheduleStrategy}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
