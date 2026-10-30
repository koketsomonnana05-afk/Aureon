import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Lock,
  X,
  Volume2,
  VolumeX,
  Wind,
  ArrowRight,
  Crown,
  Award,
  Radio,
  Coffee,
  ListPlus,
  Flame,
} from "lucide-react";
import confetti from "canvas-confetti";
import { audio } from "../audio";

export interface ZoneTask {
  id: string;
  title: string;
  duration?: number;
  description?: string;
  completed?: boolean;
  timeLeft?: number;
  isActive?: boolean;
  priority?: "low" | "medium" | "high";
  xp?: number;
  dayOfWeek?: string;
  color?: string;
}

interface TheZoneProps {
  isOpen: boolean;
  tasks: ZoneTask[];
  todayTasks?: ZoneTask[];
  goal: string;
  userTier?: "free" | "pro" | "elite";
  onCompleteTask: (taskId: string) => void;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: (taskId: string) => void;
  onResetTimer: (taskId: string) => void;
  onExitZone: () => void;
  onRewardXP?: (amount: number) => void;
}

export const TheZone: React.FC<TheZoneProps> = ({
  isOpen,
  tasks,
  todayTasks,
  goal,
  userTier = "pro",
  onCompleteTask,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onExitZone,
  onRewardXP,
}) => {
  const isElite = userTier === "elite";

  // Real-time task filtering
  const todayStrLong = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const tasksForToday = tasks.filter((t) => t.dayOfWeek === todayStrLong);
  const tasksWithoutDay = tasks.filter((t) => !t.dayOfWeek);

  const [includeAllTasks, setIncludeAllTasks] = useState(false);

  // Synchronize directly with today's focus tasks from dashboard
  const effectiveTasks = includeAllTasks
    ? tasks
    : (todayTasks && todayTasks.length > 0)
    ? todayTasks
    : tasksForToday.length > 0
    ? tasksForToday
    : tasksWithoutDay.length > 0
    ? tasksWithoutDay
    : tasks;

  const pendingTasks = effectiveTasks.filter((t) => !t.completed);
  const isAllCompleted = effectiveTasks.length > 0 && pendingTasks.length === 0;
  const isEmptyQueue = effectiveTasks.length === 0;

  // Track active task by ID to stay locked in real time
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const activeTask = pendingTasks.find((t) => t.id === selectedTaskId) || pendingTasks[0] || null;

  // Real-time task timer from global state
  const currentSeconds = activeTask
    ? typeof activeTask.timeLeft === "number" && !isNaN(activeTask.timeLeft)
      ? activeTask.timeLeft
      : (activeTask.duration || 25) * 60
    : 25 * 60;
  const isTaskActive = Boolean(activeTask?.isActive);

  // Soundscape
  const [ambientSound, setAmbientSound] = useState<"none" | "brown" | "rain" | "gamma">("none");

  // Breathing mode override
  const [isBreathingMode, setIsBreathingMode] = useState(false);

  // Derived current mode
  const currentMode: "empty" | "victory" | "breathing" | "focus" = isBreathingMode
    ? "breathing"
    : isEmptyQueue
    ? "empty"
    : isAllCompleted
    ? "victory"
    : "focus";

  // Breathing state
  const [breathingSecondsLeft, setBreathingSecondsLeft] = useState(120); // 2 minutes
  const [breathingPhase, setBreathingPhase] = useState<"Inhale" | "Hold" | "Exhale" | "Pause">("Inhale");
  const [isBreathingActive, setIsBreathingActive] = useState(false);

  // Exit dialog during active focus
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Elite Coach state
  const [eliteCoachInsight, setEliteCoachInsight] = useState<string | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);

  // Automatically start timer for first active task on open if not started
  useEffect(() => {
    if (isOpen && activeTask && !activeTask.isActive && currentSeconds > 0) {
      onStartTimer(activeTask.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTask?.id]);

  // Guided 2-Minute Breathing Interval (Box Breathing: 4s Inhale, 4s Hold, 4s Exhale, 4s Hold)
  useEffect(() => {
    let timer: any = null;
    if (isBreathingActive && breathingSecondsLeft > 0 && currentMode === "breathing") {
      timer = setInterval(() => {
        setBreathingSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsBreathingActive(false);
            audio.playBreathingBell("out");
            return 0;
          }
          const elapsed = 120 - (prev - 1);
          const cyclePosition = elapsed % 16;
          if (cyclePosition < 4) {
            if (breathingPhase !== "Inhale") audio.playBreathingBell("in");
            setBreathingPhase("Inhale");
          } else if (cyclePosition < 8) {
            if (breathingPhase !== "Hold") audio.playBreathingBell("hold");
            setBreathingPhase("Hold");
          } else if (cyclePosition < 12) {
            if (breathingPhase !== "Exhale") audio.playBreathingBell("out");
            setBreathingPhase("Exhale");
          } else {
            setBreathingPhase("Pause");
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isBreathingActive, breathingSecondsLeft, currentMode, breathingPhase]);

  // Audio ambient controls
  const handleSelectAmbient = (type: "none" | "brown" | "rain" | "gamma") => {
    if (type === "gamma" && !isElite) {
      alert("40Hz Gamma Flow Frequency is exclusively unlocked in Elite Mode.");
      return;
    }
    setAmbientSound(type);
    audio.startAmbient(type);
  };

  // Stop ambient and safely exit
  const handleSafeExit = () => {
    audio.stopAmbient();
    setIsBreathingActive(false);
    setIsBreathingMode(false);
    setShowExitConfirm(false);
    if (activeTask && activeTask.isActive) {
      onPauseTimer(activeTask.id);
    }
    onExitZone();
  };

  const handleTaskDone = () => {
    if (!activeTask) return;
    audio.playTaskComplete();
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      colors: isElite ? ["#F59E0B", "#F97316", "#FFD700"] : ["#3B82F6", "#10B981", "#FFDE00"],
    });

    onCompleteTask(activeTask.id);
    if (onRewardXP) {
      onRewardXP(activeTask.xp || 50);
    }

    if (pendingTasks.length <= 1) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
      });
    } else {
      // Pick next task
      const nextPending = pendingTasks.find((t) => t.id !== activeTask.id);
      if (nextPending) {
        setSelectedTaskId(nextPending.id);
        onStartTimer(nextPending.id);
      }
    }
  };

  const handleStartBreathing = () => {
    if (activeTask && activeTask.isActive) {
      onPauseTimer(activeTask.id);
    }
    setBreathingSecondsLeft(120);
    setBreathingPhase("Inhale");
    setIsBreathingActive(true);
    setIsBreathingMode(true);
    audio.playBreathingBell("in");
  };

  const handleEndBreathing = () => {
    setIsBreathingActive(false);
    setIsBreathingMode(false);
    if (activeTask && !activeTask.completed) {
      onStartTimer(activeTask.id);
    }
  };

  // Fetch Elite AI Coach Micro-Insight
  const fetchEliteCoach = async () => {
    if (!activeTask || !isElite) return;
    setLoadingCoach(true);
    try {
      const res = await fetch("/api/ai/chatWithCoach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `I am currently locked in [The Zone] working on this task: "${activeTask.title}". Give me a razor-sharp, stoic, 1-sentence cognitive cue to maintain ruthless focus right now. No fluff.`,
          history: [],
          goal,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setEliteCoachInsight(json.reply || "Relentless execution. The only exit is completion.");
      }
    } catch {
      setEliteCoachInsight("Do what must be done. Eliminate every deviation.");
    } finally {
      setLoadingCoach(false);
    }
  };

  if (!isOpen) return null;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const totalDuration = (activeTask?.duration ? activeTask.duration * 60 : 25 * 60);
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - currentSeconds) / totalDuration) * 100));

  // Determine if user can freely exit without confirmation modal
  const canFreelyExit = isAllCompleted || isEmptyQueue || currentMode === "victory" || currentMode === "empty";

  return (
    <div className="fixed inset-0 z-[80] bg-[#070709] text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* Background radial glow */}
      <div
        className={`absolute inset-0 pointer-events-none transition-all duration-1000 ${
          isElite
            ? "bg-[radial-gradient(ellipse_at_top,#ea580c18,transparent_60%)]"
            : "bg-[radial-gradient(ellipse_at_top,#2563eb18,transparent_60%)]"
        }`}
      />

      {/* TOP BAR / ZONE STATUS */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-lg ${
              isElite
                ? "bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-orange-500/20"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/20"
            }`}
          >
            {isElite ? <Crown className="w-5 h-5 text-orange-400" /> : <Lock className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-sm tracking-widest uppercase text-white">
                The Zone
              </span>
              <span
                className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border ${
                  isElite
                    ? "bg-orange-500/20 border-orange-500/40 text-orange-300"
                    : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                }`}
              >
                {isElite ? "Elite Flow" : "Pro Mode"}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[11px] text-gray-400">
              {pendingTasks.length > 0
                ? `Task ${effectiveTasks.length - pendingTasks.length + 1} of ${effectiveTasks.length} • Real-time Sync Active`
                : isAllCompleted
                ? "All tasks completed • You are free to leave"
                : "No active tasks queued"}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center space-x-2">
          {/* 2-Min Breathing Trigger */}
          <button
            onClick={() => (currentMode === "breathing" ? handleEndBreathing() : handleStartBreathing())}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              currentMode === "breathing"
                ? "bg-cyan-500 text-black border-cyan-400 shadow-lg shadow-cyan-500/20"
                : "bg-white/5 hover:bg-white/10 text-cyan-300 border-cyan-500/30"
            }`}
            title="2-Minute Box Breathing Reset"
          >
            <Wind className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2m Cool Down</span>
          </button>

          {/* Soundscapes Selector */}
          <div className="flex items-center space-x-1 bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              onClick={() => handleSelectAmbient("none")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                ambientSound === "none" ? "bg-white/20 text-white font-bold" : "text-gray-400 hover:text-white"
              }`}
              title="Mute Soundscape"
            >
              <VolumeX className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSelectAmbient("brown")}
              className={`px-2 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-colors ${
                ambientSound === "brown" ? "bg-amber-500 text-black shadow-sm" : "text-gray-400 hover:text-white"
              }`}
              title="Brown Noise"
            >
              Brown
            </button>
            <button
              onClick={() => handleSelectAmbient("rain")}
              className={`px-2 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-colors ${
                ambientSound === "rain" ? "bg-blue-500 text-white shadow-sm" : "text-gray-400 hover:text-white"
              }`}
              title="Rain Soundscape"
            >
              Rain
            </button>
            <button
              onClick={() => handleSelectAmbient("gamma")}
              className={`px-2 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-colors flex items-center space-x-1 ${
                ambientSound === "gamma"
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-md shadow-orange-500/20"
                  : isElite
                  ? "text-orange-400 hover:bg-orange-500/10"
                  : "text-gray-600 cursor-not-allowed"
              }`}
              title={isElite ? "40Hz Gamma Flow Frequency" : "40Hz Gamma (Elite Exclusive)"}
            >
              <Radio className="w-3 h-3" />
              <span>40Hz</span>
            </button>
          </div>

          {/* Exit Button */}
          <button
            onClick={() => {
              if (canFreelyExit) {
                handleSafeExit();
              } else {
                setShowExitConfirm(true);
              }
            }}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center space-x-1.5"
            title="Exit The Zone"
          >
            <X className="w-4 h-4" />
            <span className="text-xs font-semibold hidden md:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 max-w-4xl mx-auto w-full">
        {/* MODE 1: REAL-TIME FOCUS COCKPIT */}
        {currentMode === "focus" && activeTask && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full flex flex-col items-center text-center space-y-6"
          >
            {/* Goal context badge */}
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Goal: {goal}</span>
              {activeTask.priority && (
                <span className="ml-1 uppercase text-[10px] text-amber-300 font-bold">
                  • {activeTask.priority} priority
                </span>
              )}
            </div>

            {/* Active Task Info */}
            <div className="max-w-xl space-y-2">
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {activeTask.title}
              </h1>
              {activeTask.description && (
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
                  {activeTask.description}
                </p>
              )}
            </div>

            {/* Circular Digital Timer */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center my-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="4"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke={isElite ? "#F97316" : "#F59E0B"}
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="276.46"
                  strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                  {formatTimer(currentSeconds)}
                </span>
                <span className="text-[11px] uppercase tracking-widest text-gray-400 mt-2 font-bold flex items-center space-x-1.5">
                  <span className={`w-2 h-2 rounded-full ${isTaskActive ? "bg-emerald-400 animate-ping" : "bg-gray-500"}`} />
                  <span>{isTaskActive ? "Live Focus Sprint" : "Paused"}</span>
                </span>
              </div>
            </div>

            {/* Real-time Timer Controls */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (isTaskActive) {
                    onPauseTimer(activeTask.id);
                  } else {
                    onStartTimer(activeTask.id);
                  }
                }}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl ${
                  isTaskActive
                    ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                    : isElite
                    ? "bg-orange-500 hover:bg-orange-400 text-black shadow-orange-500/30"
                    : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30"
                }`}
                title={isTaskActive ? "Pause Timer" : "Start Focus Timer"}
              >
                {isTaskActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>

              <button
                onClick={() => onResetTimer(activeTask.id)}
                className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 flex items-center justify-center transition-colors"
                title="Reset Timer to Duration"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Primary Completion Button */}
            <div className="pt-2 w-full max-w-sm">
              <button
                onClick={handleTaskDone}
                className={`w-full py-4 px-6 rounded-2xl font-bold uppercase tracking-wider text-sm flex items-center justify-center space-x-2 transition-all transform active:scale-95 shadow-2xl ${
                  isElite
                    ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-black shadow-orange-500/25 hover:brightness-110"
                    : "bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-amber-500/25 hover:brightness-110"
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Mark Task Completed</span>
              </button>
            </div>

            {/* Elite Coach AI Micro-Intervention */}
            {isElite && (
              <div className="w-full max-w-md mt-4 p-3.5 rounded-2xl bg-orange-950/20 border border-orange-500/20 flex flex-col space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-orange-400 text-xs font-bold uppercase tracking-wider">
                    <Crown className="w-3.5 h-3.5" />
                    <span>Elite Stoic Coach</span>
                  </div>
                  <button
                    onClick={fetchEliteCoach}
                    disabled={loadingCoach}
                    className="text-[10px] text-orange-400/80 hover:text-orange-300 font-semibold underline"
                  >
                    {loadingCoach ? "Channeling..." : "Calibrate Mind"}
                  </button>
                </div>
                <p className="text-xs text-gray-300 italic">
                  "{eliteCoachInsight || "The resistance you feel is the obstacle showing you the way through."}"
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* MODE 2: 2-MINUTE GUIDED BREATHING COOL DOWN */}
        {currentMode === "breathing" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center space-y-8"
          >
            <div>
              <div className="inline-flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full">
                <Wind className="w-4 h-4 animate-pulse" />
                <span>Cortisol & Nervous System Reset</span>
              </div>
              <h2 className="text-3xl font-black text-white">2-Minute Box Breathing</h2>
              <p className="text-gray-400 text-xs max-w-sm mx-auto mt-1">
                4s Inhale • 4s Hold • 4s Exhale • 4s Hold. Recalibrate neural baseline.
              </p>
            </div>

            {/* Animated Expanding/Contracting Breathing Ring */}
            <div className="relative w-64 h-64 flex items-center justify-center">
              <motion.div
                animate={{
                  scale: breathingPhase === "Inhale" ? 1.35 : breathingPhase === "Hold" ? 1.35 : 0.85,
                  opacity: breathingPhase === "Inhale" ? 0.9 : breathingPhase === "Hold" ? 0.8 : 0.4,
                }}
                transition={{ duration: 4, ease: "easeInOut" }}
                className="w-48 h-48 rounded-full bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-teal-500/20 border-2 border-cyan-400/40 shadow-[0_0_60px_rgba(6,182,212,0.25)] flex items-center justify-center"
              >
                <div className="text-center space-y-1">
                  <span className="text-2xl font-black text-cyan-300 tracking-wider">
                    {breathingPhase}
                  </span>
                  <p className="font-mono text-sm text-gray-400">
                    {formatTimer(breathingSecondsLeft)}
                  </p>
                </div>
              </motion.div>
            </div>

            <button
              onClick={handleEndBreathing}
              className="px-6 py-2.5 rounded-xl border border-white/20 text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Resume Focus Cockpit
            </button>
          </motion.div>
        )}

        {/* MODE 3: VICTORY / ALL TASKS CONQUERED */}
        {currentMode === "victory" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center space-y-6 max-w-md"
          >
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
              <Award className="w-10 h-10 text-emerald-400" />
            </div>

            <div className="space-y-1">
              <h2 className="text-3xl font-black tracking-tight text-white">
                The Zone Conquered!
              </h2>
              <p className="text-emerald-400 text-sm font-semibold">
                All tasks finished. You are completely free to leave.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full text-left">
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                  Tasks Executed
                </span>
                <span className="text-xl font-bold text-white">
                  {effectiveTasks.length} / {effectiveTasks.length}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                  Focus Status
                </span>
                <span className="text-xl font-bold text-emerald-400">100% Done</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-2">
              <button
                onClick={handleStartBreathing}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5"
              >
                <Wind className="w-4 h-4" />
                <span>2m Victory Cool Down</span>
              </button>
              <button
                onClick={handleSafeExit}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                <span>Exit The Zone</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* MODE 4: NO TASKS QUEUED (NOT TRAPPED) */}
        {currentMode === "empty" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center space-y-6 max-w-md p-6 rounded-3xl bg-white/[0.02] border border-white/10"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 shadow-xl">
              <Coffee className="w-8 h-8 text-amber-400" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                No Tasks Queued For Today
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                You have no pending tasks scheduled for today. You are free to return to your dashboard, or use The Zone for a 2-minute breathing reset.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 w-full pt-2">
              <button
                onClick={handleSafeExit}
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-110 text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20"
              >
                <span>Return to LifeOS</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleStartBreathing}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5"
              >
                <Wind className="w-4 h-4" />
                <span>2-Minute Box Breathing</span>
              </button>

              {tasks.some((t) => !t.completed) && !includeAllTasks && (
                <button
                  onClick={() => setIncludeAllTasks(true)}
                  className="w-full py-2 px-4 rounded-xl border border-white/10 text-gray-400 hover:text-white text-xs font-medium transition-colors flex items-center justify-center space-x-1.5"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>Load {tasks.filter((t) => !t.completed).length} Tasks from Roadmap</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </main>

      {/* BOTTOM REAL-TIME QUEUE DRAWER */}
      {currentMode === "focus" && pendingTasks.length > 0 && (
        <footer className="relative z-10 px-6 py-3 border-t border-white/5 backdrop-blur-md bg-black/40">
          <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Live Queue ({pendingTasks.length} left)
            </span>
            <div className="flex items-center space-x-2 overflow-x-auto max-w-md py-1">
              {pendingTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTaskId(t.id);
                    if (!t.isActive) {
                      onStartTimer(t.id);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap text-xs flex items-center space-x-1.5 ${
                    t.id === activeTask?.id
                      ? isElite
                        ? "bg-orange-500/20 border-orange-500/50 text-white font-bold"
                        : "bg-amber-500/20 border-amber-500/50 text-white font-bold"
                      : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${t.isActive ? "bg-emerald-400 animate-pulse" : "bg-current"}`} />
                  <span className="truncate max-w-[120px]">{t.title}</span>
                  <span className="text-[10px] opacity-70">
                    ({formatTimer(typeof t.timeLeft === "number" && !isNaN(t.timeLeft) ? t.timeLeft : (t.duration || 25) * 60)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </footer>
      )}

      {/* CLEAN CONFIRMATION MODAL DURING ACTIVE FOCUS */}
      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card w-full max-w-sm p-6 border-white/15 rounded-2xl bg-zinc-950 space-y-4 shadow-2xl"
            >
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">Exit The Zone?</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Your timer will pause and your progress will be saved. You can re-enter anytime from your dashboard.
                </p>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-white"
                >
                  Keep Focusing
                </button>
                <button
                  onClick={handleSafeExit}
                  className="flex-1 py-2.5 rounded-xl bg-white text-black hover:bg-gray-200 text-xs font-bold uppercase tracking-wider transition-colors active:scale-95"
                >
                  Exit to LifeOS
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
