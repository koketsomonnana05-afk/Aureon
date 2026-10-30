/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import debounce from "lodash.debounce";
import { useAuthState } from "react-firebase-hooks/auth";
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, deleteUser, sendEmailVerification } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  collection,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  Bell,
  Flame,
  Plus,
  Timer,
  Wind,
  Home,
  Map as MapIcon,
  BarChart3,
  User,
  CheckCircle2,
  Circle,
  Lock,
  Calendar,
  ChevronRight,
  X,
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Zap,
  Target,
  Settings as SettingsIcon,
  LogOut,
  Loader2,
  Sparkles,
  ArrowRight,
  CreditCard,
  SmartphoneNfc,
  Wallet,
  Gift,
  Coins,
  Coffee,
  Trash2,
  Book,
  Moon,
  Sun,
  Share2,
  Star,
  Bot,
  MessageSquare,
  Send,
  Crown,
  Check,
  InfinityIcon,
  Shield,
  Activity,
  Award,
  MapPin,
  Clock,
  CalendarCheck,
  CalendarPlus,
  ExternalLink,
  RefreshCw,
  Radio,
  BookOpen,
  GraduationCap,
  Wrench,
} from "lucide-react";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getCalendarAccessToken,
  fetchCalendarEvents,
  insertCalendarEvent,
  deleteCalendarEvent,
  GoogleCalendarEvent,
} from "./googleCalendar";
import {
  GoogleCalendarBanner,
  GoogleEventCard,
  ScheduleTaskConfirmationModal,
  DeleteEventConfirmationModal,
  BatchSyncConfirmationModal,
  DayInfo,
} from "./components/GoogleCalendarSync";
import { TaskDecompositionModal } from "./components/TaskDecompositionModal";
import { DailyExecutiveBriefing } from "./components/DailyExecutiveBriefing";
import { TheZone } from "./components/TheZone";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import {
  generateRoadmap,
  refineRoadmap,
  Roadmap,
  TaskSource,
  getDailyInsight,
  getSmartTaskSuggestion,
  getCoachRecommendation,
  analyzeJournal,
  chatWithCoach,
  getGoalSuggestions,
} from "./lib/gemini";
import { Logo } from "./components/Logo";
import { getFromLocalStorage, saveToLocalStorage, clearLocalStorage } from "./lib/storage";
import { audio } from "./audio";
import Markdown from "react-markdown";

// --- Types ---
interface JournalEntry {
  id: string;
  userId: string;
  content: string;
  insight: string;
  createdAt: number;
}
interface Task {
  id: string;
  title: string;
  description: string;
  duration: number;
  xp: number;
  completed: boolean;
  color: "blue" | "purple" | "orange";
  dayOfWeek?: string;
  priority?: "low" | "medium" | "high";
  isActive?: boolean;
  timeLeft?: number;
  isImportant?: boolean;
  weekIndex?: number;
  sources?: TaskSource[];
}

interface UserProfile {
  name: string;
  username?: string;
  age?: string;
  bio: string;
  city?: string;
  country?: string;
  timezone?: string;
  startDate?: string;
  memberSince: string;
  avatarUrl?: string;
  tier?: "free" | "pro" | "elite";
}

const TIERS = {
  free: { level: 0, name: "Explorer" },
  pro: { level: 1, name: "Builder" },
  elite: { level: 2, name: "Mastery" },
};

function getLevelTitle(level: number): string {
  if (level < 5) return "Novice";
  if (level < 10) return "Builder";
  if (level < 20) return "Architect";
  return "Grandmaster";
}

type View =
  | "auth"
  | "loading"
  | "onboarding"
  | "home"
  | "path"
  | "calendar"
  | "leaderboard"
  | "profile"
  | "settings"
  | "journal";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };

  let userMessage = "An unexpected database error occurred.";
  if (path) {
    if (path.includes("/journals")) {
      if (operationType === OperationType.CREATE || operationType === OperationType.WRITE) {
         userMessage = "Could not save journal entry.";
      } else if (operationType === OperationType.LIST || operationType === OperationType.GET) {
         userMessage = "Failed to load journal entries.";
      } else if (operationType === OperationType.DELETE) {
         userMessage = "Could not delete journal entry.";
      }
    } else if (path.startsWith("users/")) {
      if (operationType === OperationType.GET || operationType === OperationType.LIST) {
        userMessage = "Failed to load user data.";
      } else {
        userMessage = "Failed to save user data.";
      }
    } else if (path.startsWith("publicProfiles/")) {
      userMessage = "Failed to update public profile.";
    }
  }

  // Display the user-friendly error message
  alert(userMessage + "\n\nPlease try again or contact support if the issue persists.");

  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const GlassCard = ({
  children,
  className = "",
  onClick,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  id?: string;
}) => (
  <div id={id} onClick={onClick} className={`glass-card p-5 ${className}`}>
    {children}
  </div>
);

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="glass-card w-full max-w-md p-6 relative z-10 border-white/10"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          {children}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Sub-views ---

const AuthView = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        // Automatically logged in after sign up
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email to reset password.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      setError(err.message || "Failed to send password reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError("");
    try {
      await connectGoogleCalendar();
    } catch (err: any) {
      setError(err.message || "Google sign in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-8"
      >
        <div className="w-24 h-24 mx-auto rounded-3xl gradient-bg flex items-center justify-center shadow-2xl shadow-md shadow-black/40 mb-6 overflow-hidden relative">
          <Logo className="w-full h-full object-cover z-10" />
          <Sparkles className="w-10 h-10 text-white absolute mix-blend-overlay" />
        </div>
        <h1 className="text-4xl font-black mb-3">Welcome to Aureon</h1>
        <p className="text-gray-400 max-w-sm mx-auto">
          Sign {isLogin ? "in" : "up"} to start building your AI-powered system for daily growth.
        </p>
      </motion.div>

      <div className="w-full max-w-md space-y-6 text-left">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block pl-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-lg outline-none focus:border-white/30 transition-all placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block pl-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-lg outline-none focus:border-white/30 transition-all placeholder:text-gray-600"
            />
            {isLogin && (
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 gradient-bg rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center space-x-2 disabled:opacity-50 transition-all active:scale-95 shadow-xl shadow-md shadow-black/40 text-[#050505] mt-2 border border-transparent hover:brightness-110"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>{isLogin ? "Sign In" : "Sign Up"} <ArrowRight className="w-5 h-5 ml-1 inline" /></span>}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase text-gray-500">
            <span className="bg-[#080808] px-2 font-bold tracking-widest">or</span>
          </div>
        </div>

        <button
          onClick={handleGoogleAuth}
          disabled={isLoading}
          className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center text-white hover:bg-white/10 transition-colors disabled:opacity-50 hover:border-white/20 shadow-md shadow-black/20"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isLogin ? "Sign in with Google" : "Sign up with Google"}
        </button>

        <div className="text-center pt-2 text-sm text-gray-500">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          {" "}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            className="text-white hover:underline font-bold transition-colors"
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
};

const OnboardingView = ({
  onComplete,
  user,
}: {
  onComplete: (roadmap: Roadmap, name: string, age: string) => void;
  user: any;
}) => {
  const [goal, setGoal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([
    "Launch a SaaS product",
    "Run a Marathon",
    "Learn TypeScript",
    "Master Chess",
  ]);

  let emailName = "User";
  if (user?.email) {
    const localPart = user.email.split("@")[0];
    emailName = localPart
      .replace(/[._-]/g, " ")
      .replace(/\d+/g, "")
      .trim();
    emailName = emailName
      .split(" ")
      .filter(w => w.length > 0)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ") || "User";
  }
  const userName = user?.displayName || emailName;

  useEffect(() => {
    getGoalSuggestions().then((goals) => {
      if (goals && goals.length > 0) {
        setSuggestions(goals.slice(0, 4));
      }
    });
  }, []);

  const handleGenerate = async () => {
    if (!goal) return;
    setIsLoading(true);

    const userAge = "Unknown";

    try {
      const roadmap = await generateRoadmap(goal, userName, userAge);
      onComplete(roadmap, userName, userAge);
    } catch (error: any) {
      alert(error.message || "Failed to generate roadmap. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-8"
      >
        <div className="w-24 h-24 mx-auto rounded-3xl gradient-bg flex items-center justify-center shadow-2xl shadow-md shadow-black/40 mb-6 overflow-hidden relative">
          <Logo className="w-full h-full object-cover z-10" />
          <Sparkles className="w-10 h-10 text-white absolute mix-blend-overlay" />
        </div>
        <h1 className="text-4xl font-black mb-3">Welcome, {userName}</h1>
        <p className="text-gray-400 max-w-sm mx-auto">
          Turn your vague ambitions into a structured, AI-powered system for
          daily growth.
        </p>
      </motion.div>

      <div className="w-full max-w-md space-y-6 text-left">
        <div className="space-y-4">
          <div className="relative">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block pl-2">
              Main Goal
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Launch a SaaS product"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-lg outline-none focus:border-white/30 transition-all placeholder:text-gray-600"
            />
            {isLoading && (
              <div className="absolute right-4 top-[44px] -translate-y-1/2">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setGoal(s)}
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs text-gray-400 hover:border-white/30/50 hover:text-white transition-all"
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={!goal || isLoading}
          className="w-full py-4 gradient-bg rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center space-x-2 disabled:opacity-50 disabled:grayscale transition-all active:scale-95 shadow-xl shadow-md shadow-black/40"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Generating System...</span>
            </>
          ) : (
            <>
              <span>Generate My Path</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const PathView = ({
  roadmap,
  tasks,
  setRoadmap,
  setTasks,
  userTier = "free",
  onShowUpgrade,
}: {
  roadmap: Roadmap;
  tasks: Task[];
  setRoadmap: React.Dispatch<React.SetStateAction<Roadmap | null>>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  userTier?: "free" | "pro" | "elite";
  onShowUpgrade: (req: "pro" | "elite", feature: string) => void;
}) => {
  const [refineInput, setRefineInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refineInput.trim() || isRefining) return;

    setIsRefining(true);
    try {
      const updatedRoadmap = await refineRoadmap(roadmap, refineInput);
      setRoadmap(updatedRoadmap);

      // Add new tasks from all weeks if not present
      const allNewTasks = updatedRoadmap.weeks.flatMap((w, weekIdx) => w.tasks.map((t, i) => ({
        id: Math.random().toString(),
        title: t.title,
        description: t.description,
        duration: t.duration,
        timeLeft: t.duration * 60,
        xp: t.xp,
        completed: false,
        color: ["blue", "purple", "orange"][i % 3] as any,
        dayOfWeek: t.dayOfWeek,
        priority: t.priority as "low" | "medium" | "high",
        isImportant: t.isImportant,
        weekIndex: weekIdx,
      })));
      
      setTasks(prev => {
        const existingTitles = prev.map(k => k.title);
        const newOnes = allNewTasks.filter(w => !existingTitles.includes(w.title));
        return [...prev, ...newOnes];
      });
      setRefineInput("");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to refine roadmap. Please try again.");
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 pb-24"
    >
      <div className="flex flex-col px-1">
        <h2 className="text-2xl font-bold">{roadmap.goal}</h2>
        <p className="text-gray-400 text-sm">Your structured 4-week roadmap.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {roadmap.weeks.map((week, i) => (
          <div key={i} className="flex flex-col space-y-3 h-full">
            <div className="flex items-center space-x-2 px-1">
              <span className="text-[10px] uppercase font-black tracking-widest text-gray-300">
                Week {i + 1}
              </span>
              <div className="h-[1px] flex-1 bg-white/5" />
            </div>
            <GlassCard className="border-l-4 border-white/10 flex-1 flex flex-col">
              <h3 className="font-bold text-lg mb-1">{week.title}</h3>
              <p className="text-sm text-gray-500 mb-4 flex-1">
                {week.description}
              </p>
              <div className="space-y-2 mt-auto">
                {week.tasks.map((task, ti) => {
                  const isDone = tasks.find(
                    (t) => t.title === task.title && t.completed,
                  );
                  return (
                    <div
                      key={ti}
                      className="flex items-start sm:items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 w-full gap-3"
                    >
                      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                        <div className="w-4 h-4 mt-0.5 sm:mt-0 relative flex items-center justify-center flex-shrink-0">
                          {isDone ? (
                            <motion.div
                              initial={{ scale: 0, rotate: -45 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 25,
                              }}
                            >
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            </motion.div>
                          ) : (
                            <Circle className="w-4 h-4 text-gray-700" />
                          )}
                        </div>
                        <span
                          className={`text-sm flex-1 break-words leading-snug ${isDone ? "text-gray-500 line-through" : "text-gray-300 font-medium"}`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <span className="text-[10px] whitespace-nowrap font-bold text-gray-400 flex-shrink-0 mt-0.5 sm:mt-0">
                        +{task.xp} XP
                      </span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <GlassCard>
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Refine with AI</h3>
              <p className="text-xs text-gray-400 mt-1">
                Want to shift focus? Tell the AI how to adjust your 4-week roadmap. For example, "Focus more on practical projects" or "Make week 2 about writing tests".
              </p>
            </div>
          </div>
          <FeatureGuard
            userTier={userTier}
            requiredTier="pro"
            featureName="AI Roadmap Refinement"
            onShowUpgrade={onShowUpgrade}
          >
            <form onSubmit={handleRefine} className="flex space-x-2">
              <input
                type="text"
                value={refineInput}
                onChange={(e) => setRefineInput(e.target.value)}
                placeholder="How should I adjust this roadmap?"
                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-white placeholder-gray-500"
                disabled={isRefining}
              />
              <button
                type="submit"
                disabled={isRefining || !refineInput.trim()}
                className="px-6 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[100px]"
              >
                {isRefining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Refine"
                )}
              </button>
            </form>
          </FeatureGuard>
        </GlassCard>
      </div>
    </motion.div>
  );
};

const CalendarView = ({
  tasks,
  onToggleTask,
  onDeleteTask,
  onShareTask,
  onToggleImportant,
  onOpenAddTask,
  startDate,
}: {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onDeleteTask: (e: React.MouseEvent, id: string) => void;
  onShareTask: (e: React.MouseEvent, task: Task) => void;
  onToggleImportant: (e: React.MouseEvent, id: string) => void;
  onOpenAddTask?: (day: string) => void;
  startDate?: string;
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCalendarConnected, setIsCalendarConnected] = useState(() => !!getCalendarAccessToken());
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Modals for user confirmation
  const [taskToSchedule, setTaskToSchedule] = useState<{ task: Task; date: Date } | null>(null);
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const [eventToDelete, setEventToDelete] = useState<GoogleCalendarEvent | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isBatchSyncModalOpen, setIsBatchSyncModalOpen] = useState(false);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);

  useEffect(() => {
    // Real-time synchronization
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getDaysOfWeek = useCallback((): DayInfo[] => {
    const calendarDays: DayInfo[] = [];
    const goalStartDate = new Date(startDate || new Date());
    const startDayOfWeek = goalStartDate.getDay();
    const currentDayOfWeek = currentDate.getDay();
    
    let diffToStartDay = currentDayOfWeek - startDayOfWeek;
    if (diffToStartDay < 0) {
      diffToStartDay += 7;
    }
    
    const startOfCurrentWeekDate = currentDate.getDate() - diffToStartDay;
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentDate);
      d.setDate(startOfCurrentWeekDate + i);
      calendarDays.push({
        name: d.toLocaleDateString("en-US", { weekday: "long" }),
        dateStr: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        isToday: d.toDateString() === currentDate.toDateString(),
        date: d,
      });
    }
    return calendarDays;
  }, [currentDate, startDate]);

  const weekDays = getDaysOfWeek();

  const loadCalendarEvents = useCallback(async () => {
    if (!getCalendarAccessToken()) {
      setIsCalendarConnected(false);
      return;
    }
    setIsLoadingCalendar(true);
    setCalendarError(null);
    try {
      const days = getDaysOfWeek();
      const timeMin = new Date(days[0].date);
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date(days[6].date);
      timeMax.setHours(23, 59, 59, 999);
      const items = await fetchCalendarEvents(timeMin, timeMax);
      setCalendarEvents(items);
      setIsCalendarConnected(true);
    } catch (err: any) {
      if (err.message === "TOKEN_EXPIRED" || err.message === "NOT_AUTHENTICATED") {
        setIsCalendarConnected(false);
      } else {
        setCalendarError(err.message || "Could not fetch Google Calendar events");
      }
    } finally {
      setIsLoadingCalendar(false);
    }
  }, [getDaysOfWeek]);

  useEffect(() => {
    if (getCalendarAccessToken()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadCalendarEvents();
    }
  }, [loadCalendarEvents]);

  const handleConnectCalendar = async () => {
    setIsLoadingCalendar(true);
    setCalendarError(null);
    try {
      await connectGoogleCalendar();
      setIsCalendarConnected(true);
      await loadCalendarEvents();
    } catch (err: any) {
      setCalendarError(err.message || "Failed to connect to Google Calendar");
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleDisconnectCalendar = () => {
    disconnectGoogleCalendar();
    setIsCalendarConnected(false);
    setCalendarEvents([]);
  };

  const handleOpenSingleSchedule = (task: Task, date: Date) => {
    if (!isCalendarConnected) {
      handleConnectCalendar();
      return;
    }
    setTaskToSchedule({ task, date });
    setIsSchedulingModalOpen(true);
  };

  const handleConfirmSingleSchedule = async (startTime: string) => {
    if (!taskToSchedule) return;
    setIsScheduling(true);
    try {
      const [h, m] = startTime.split(":").map(Number);
      const start = new Date(taskToSchedule.date);
      start.setHours(h, m, 0, 0);
      const durationMin = Number(taskToSchedule.task.duration) || 30;
      const end = new Date(start.getTime() + durationMin * 60000);

      await insertCalendarEvent({
        summary: taskToSchedule.task.title,
        description: taskToSchedule.task.description || `Scheduled from Aureon LifeOS`,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
      });
      setIsSchedulingModalOpen(false);
      setTaskToSchedule(null);
      await loadCalendarEvents();
    } catch (err: any) {
      alert("Failed to schedule event on Google Calendar: " + err.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const tasksToBatchSync = weekDays.flatMap((dayObj) => {
    return tasks
      .filter((t) => t.dayOfWeek === dayObj.name && !t.completed)
      .map((task) => ({ task, date: dayObj.date }));
  });

  const handleConfirmBatchSync = async () => {
    setIsBatchSyncing(true);
    try {
      for (const item of tasksToBatchSync) {
        const start = new Date(item.date);
        start.setHours(9, 0, 0, 0);
        const durationMin = Number(item.task.duration) || 30;
        const end = new Date(start.getTime() + durationMin * 60000);

        await insertCalendarEvent({
          summary: item.task.title,
          description: item.task.description || `Aureon Focus Task for ${item.task.dayOfWeek}`,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
        });
      }
      setIsBatchSyncModalOpen(false);
      await loadCalendarEvents();
    } catch (err: any) {
      alert("Failed to sync some tasks: " + err.message);
    } finally {
      setIsBatchSyncing(false);
    }
  };

  const handleOpenDeleteEvent = (event: GoogleCalendarEvent) => {
    setEventToDelete(event);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCalendarEvent(eventToDelete.id);
      setIsDeleteModalOpen(false);
      setEventToDelete(null);
      await loadCalendarEvents();
    } catch (err: any) {
      alert("Failed to delete event: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col px-1">
        <h2 className="text-2xl font-bold">Your Week</h2>
        <p className="text-gray-400 text-sm">
          Tasks scheduled for specific days, synced with your Google Calendar in real-time.
        </p>
      </div>

      <GoogleCalendarBanner
        isConnected={isCalendarConnected}
        isLoading={isLoadingCalendar}
        onConnect={handleConnectCalendar}
        onDisconnect={handleDisconnectCalendar}
        onRefresh={loadCalendarEvents}
        onOpenBatchSync={() => setIsBatchSyncModalOpen(true)}
      />

      {calendarError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center justify-between">
          <span>{calendarError}</span>
          <button onClick={() => setCalendarError(null)} className="text-red-400 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {weekDays.map((dayObj) => {
          const day = dayObj.name;
          const dayTasks = tasks.filter((t) => t.dayOfWeek === day);

          // Find Google Calendar events belonging to this specific day
          const dayEvents = calendarEvents.filter((ev) => {
            const evDateStr = ev.start.dateTime || ev.start.date;
            if (!evDateStr) return false;
            const d = new Date(evDateStr);
            return (
              d.getFullYear() === dayObj.date.getFullYear() &&
              d.getMonth() === dayObj.date.getMonth() &&
              d.getDate() === dayObj.date.getDate()
            );
          });

          return (
            <GlassCard key={day} className={`flex flex-col space-y-3 h-full transition-colors ${dayObj.isToday ? 'border-[#FFDE00]/30 shadow-[0_0_20px_rgba(255,222,0,0.1)] bg-[#FFDE00]/5' : ''}`}>
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-1">
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    <h3 className={`font-bold text-lg ${dayObj.isToday ? 'text-[#FFDE00]' : ''}`}>{day}</h3>
                    {dayObj.isToday && (
                      <span className="text-[10px] uppercase tracking-widest bg-[#FFDE00] text-black px-1.5 py-0.5 rounded-sm font-bold mt-0.5 shadow-sm">
                        Today
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-medium ${dayObj.isToday ? 'text-[#FFDE00]/80' : 'text-gray-500'}`}>{dayObj.dateStr}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-gray-300">
                    {dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"}
                  </span>
                  <button
                    onClick={() => onOpenAddTask?.(day)}
                    className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors flex items-center justify-center bg-white/5"
                    title={`Add task for ${day}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Google Calendar Events for the Day */}
              {dayEvents.length > 0 && (
                <div className="space-y-1.5 pb-2 border-b border-white/5">
                  <div className="flex items-center space-x-1.5 px-0.5">
                    <Calendar className="w-3 h-3 text-blue-400" />
                    <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">
                      Calendar ({dayEvents.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {dayEvents.map((ev) => (
                      <GoogleEventCard
                        key={ev.id}
                        event={ev}
                        onDeleteRequest={handleOpenDeleteEvent}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Aureon Tasks for the Day */}
              {dayTasks.length > 0 ? (
                <div className="space-y-2">
                  {dayTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        onToggleTask(task.id);
                      }}
                      className="flex items-start sm:items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors group gap-3"
                    >
                      <div className="flex items-start sm:items-center gap-3 flex-1 overflow-hidden">
                        <div className="w-5 h-5 mt-0.5 sm:mt-0 relative flex-shrink-0 flex items-center justify-center">
                          {task.completed ? (
                            <motion.div
                              initial={{ scale: 0, rotate: -45 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 25,
                              }}
                            >
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            </motion.div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pr-0 sm:pr-2 py-0.5">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 w-full">
                            <span
                              className={`text-sm flex-1 break-words leading-snug ${task.completed ? "text-gray-500 line-through" : "text-gray-200 font-medium"}`}
                            >
                              {task.title}
                            </span>
                            {task.priority && (
                              <span
                                className={`text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-sm flex-shrink-0 mt-0.5 sm:mt-0 w-fit ${
                                  task.priority === "high"
                                    ? "bg-white/10 text-red-400"
                                    : task.priority === "medium"
                                      ? "bg-white/10 text-gray-300"
                                      : "bg-white/10 text-gray-300"
                                }`}
                              >
                                {task.priority}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0 ml-0 sm:ml-2 mt-1 sm:mt-0">
                        <span className="text-[10px] font-bold text-gray-400 hidden sm:inline-block">
                          +{task.xp} XP
                        </span>
                        <div className="flex items-center sm:space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSingleSchedule(task, dayObj.date);
                            }}
                            className="p-1 rounded-md text-gray-500 hover:text-blue-400 hover:bg-white/5"
                            title="Add to Google Calendar"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => onToggleImportant(e, task.id)}
                            className={`p-1 rounded-md ${task.isImportant ? "text-yellow-400 opacity-100" : "text-gray-500 hover:text-yellow-400 hover:bg-white/5"}`}
                            title="Mark as Important"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${task.isImportant ? "fill-current" : ""}`}
                            />
                          </button>
                          <button
                            onClick={(e) => onShareTask(e, task)}
                            className="p-1 text-gray-500 hover:text-gray-400 hover:bg-white/5 rounded-md hidden sm:block"
                            title="Share Activity"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => onDeleteTask(e, task.id)}
                            className="p-1 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-md hidden sm:block"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic px-1">
                  No tasks scheduled.
                </p>
              )}
            </GlassCard>
          );
        })}
      </div>

      {/* Confirmation Modals for Google Workspace Actions */}
      <ScheduleTaskConfirmationModal
        isOpen={isSchedulingModalOpen}
        task={taskToSchedule?.task || null}
        targetDate={taskToSchedule?.date || null}
        onClose={() => {
          setIsSchedulingModalOpen(false);
          setTaskToSchedule(null);
        }}
        onConfirm={handleConfirmSingleSchedule}
        isScheduling={isScheduling}
      />

      <DeleteEventConfirmationModal
        isOpen={isDeleteModalOpen}
        event={eventToDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setEventToDelete(null);
        }}
        onConfirm={handleConfirmDeleteEvent}
        isDeleting={isDeleting}
      />

      <BatchSyncConfirmationModal
        isOpen={isBatchSyncModalOpen}
        tasksToSync={tasksToBatchSync}
        weekDays={weekDays}
        onClose={() => setIsBatchSyncModalOpen(false)}
        onConfirm={handleConfirmBatchSync}
        isSyncing={isBatchSyncing}
      />
    </motion.div>
  );
};

const LeaderboardView = ({
  xp,
  userName,
  userId,
  userAvatarUrl,
  user,
}: {
  xp: number;
  userName: string;
  userId: string | undefined;
  userAvatarUrl?: string;
  user: any;
}) => {
  const [players, setPlayers] = useState<any[]>(
    [
      {
        id: "1",
        name: "Sarah",
        level: 12,
        xp: 14200,
        avatarInitials: "S",
        active: false,
      },
      {
        id: userId || "2",
        name: `${userName} (You)`,
        level: Math.floor(xp / 1000) + 1,
        xp: xp,
        avatarInitials: userName.charAt(0).toUpperCase(),
        active: true,
        avatarUrl: userAvatarUrl,
      },
      {
        id: "3",
        name: "Jordan",
        level: 9,
        xp: 9800,
        avatarInitials: "J",
        active: false,
      },
      {
        id: "4",
        name: "Elena",
        level: 7,
        xp: 1200,
        avatarInitials: "E",
        active: false,
      },
      {
        id: "5",
        name: "Marcus",
        level: 11,
        xp: 11200,
        avatarInitials: "M",
        active: false,
      },
      {
        id: "6",
        name: "Kai",
        level: 14,
        xp: 18500,
        avatarInitials: "K",
        active: false,
      },
      {
        id: "7",
        name: "Sofia",
        level: 6,
        xp: 450,
        avatarInitials: "S",
        active: false,
      },
    ].sort((a, b) => b.xp - a.xp),
  );

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "publicProfiles"),
      where("xp", ">=", 0),
      orderBy("xp", "desc"),
      limit(10),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const topPlayers: any[] = [];
        snapshot.forEach((document) => {
          const data = document.data();
          if (data && data.name) {
            const isMe = document.id === userId;
            topPlayers.push({
              id: document.id,
              name: isMe ? `${data.name} (You)` : data.name,
              level: Math.floor((data.xp || 0) / 1000) + 1,
              xp: data.xp || 0,
              avatarInitials: data.name.charAt(0).toUpperCase(),
              active: isMe,
              avatarUrl: data.avatarUrl,
            });
          }
        });

        if (topPlayers.length > 0) {
          if (userId && !topPlayers.find((p) => p.id === userId)) {
            topPlayers.push({
              id: userId,
              name: `${userName} (You)`,
              level: Math.floor(xp / 1000) + 1,
              xp: xp,
              avatarInitials: userName.charAt(0).toUpperCase(),
              active: true,
              avatarUrl: userAvatarUrl,
            });
            topPlayers.sort((a, b) => b.xp - a.xp);
          }
          setPlayers(topPlayers);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "publicProfiles");
        // keep local mock
      }
    );

    return () => unsubscribe();
  }, [xp, userName, userId, userAvatarUrl, user]);

  const userRank =
    players.findIndex((p) => p.active) > -1
      ? players.findIndex((p) => p.active) + 1
      : "-";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 max-w-3xl mx-auto w-full"
    >
      <div className="flex flex-col px-1">
        <h2 className="text-2xl font-bold">Leaderboard</h2>
        <p className="text-gray-400 text-sm">
          Compete with the community to stay motivated.
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-white font-bold text-sm">
            #{userRank}
          </div>
          <div>
            <p className="text-sm font-bold">
              You are ranked #{userRank} globally
            </p>
            <p className="text-xs text-gray-500">
              Top 5% of all users this week.
            </p>
          </div>
        </div>
        <Trophy className="w-6 h-6 text-yellow-500" />
      </div>

      <div className="space-y-3">
        {players.map((player, i) => (
          <GlassCard
            key={player.id}
            className={`flex items-center space-x-4 ${player.active ? "border-white/30 ring-1 ring-white/5" : ""}`}
          >
            <div className="w-8 font-mono text-gray-500 font-bold">
              #{i + 1}
            </div>
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold relative overflow-hidden ${player.active ? "bg-white text-black" : "bg-gray-800 text-gray-400"}`}
            >
              {player.avatarUrl ? (
                <img
                  src={player.avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                player.avatarInitials
              )}
              {i === 0 && (
                <Trophy className="w-4 h-4 text-yellow-500 absolute -top-2 -right-2" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-bold">{player.name}</h3>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                Level {player.level}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-gray-200">
                {player.xp.toLocaleString()} XP
              </div>
              <div className="text-[10px] text-gray-300 font-bold uppercase">
                ⚡ Pro
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </motion.div>
  );
};

const ProfileView = ({
  userId,
  xp,
  streak,
  tasksCount,
  userProfile,
  setUserProfile,
}: {
  userId?: string;
  xp: number;
  streak: number;
  tasksCount: number;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(userProfile.name);
  const [editUsername, setEditUsername] = useState(userProfile.username || "");
  const [editBio, setEditBio] = useState(userProfile.bio);
  const [editCity, setEditCity] = useState(userProfile.city || "");
  const [editCountry, setEditCountry] = useState(userProfile.country || "");
  const [editTimezone, setEditTimezone] = useState(userProfile.timezone || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const currentLevel = Math.floor(xp / 1000) + 1;
  const levelTitle = getLevelTitle(currentLevel);

  const stats = [
    {
      label: "Tasks Done",
      value: tasksCount,
      icon: CheckCircle2,
      color: "text-green-500",
    },
    {
      label: "Current Streak",
      value: `${streak} Days`,
      icon: Flame,
      color: "text-gray-300",
    },
    {
      label: "Total XP",
      value: xp.toLocaleString(),
      icon: Zap,
      color: "text-gray-300",
    },
    {
      label: "Efficiency",
      value: "92%",
      icon: BarChart3,
      color: "text-gray-300",
    },
  ];

  const handleSave = async () => {
    const updatedProfile = { ...userProfile, name: editName, username: editUsername, bio: editBio, city: editCity, country: editCountry, timezone: editTimezone };
    setUserProfile(updatedProfile);
    setIsEditing(false);
    
    if (userId) {
      try {
        await setDoc(doc(db, "users", userId), { userProfile: updatedProfile }, { merge: true });
        await setDoc(doc(db, "publicProfiles", userId), {
            userId: userId,
            name: updatedProfile.name,
            ...(updatedProfile.avatarUrl ? { avatarUrl: updatedProfile.avatarUrl } : {}),
            xp: xp,
         }, { merge: true });
      } catch (err) {
         console.error("Failed to sync profile update", err);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image.");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 256;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          
          const url = canvas.toDataURL("image/webp", 0.6);
          const updatedProfile = { ...userProfile, avatarUrl: url };
          setUserProfile(updatedProfile);
          setIsUploading(false);
          
          if (userId) {
            setDoc(doc(db, "users", userId), { userProfile: updatedProfile }, { merge: true }).catch(console.error);
            setDoc(doc(db, "publicProfiles", userId), {
              userId: userId,
              name: updatedProfile.name,
              avatarUrl: url,
              xp: xp,
            }, { merge: true }).catch(console.error);
          }
          
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        alert("Failed to read image.");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      alert("Failed to upload image.");
      setIsUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 max-w-4xl mx-auto w-full"
    >
      <div className="flex items-start space-x-6 px-1">
        <div className="flex flex-col items-center space-y-2 shrink-0">
          <div
            className="relative w-24 h-24 rounded-full gradient-bg p-1 cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden relative">
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-gray-600" />
              )}

              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                ) : (
                  <span className="text-[10px] font-bold uppercase text-white tracking-wider">
                    Change
                  </span>
                )}
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>
          {userProfile.avatarUrl && isEditing && (
            <button 
              onClick={async () => {
                const updatedProfile = { ...userProfile, avatarUrl: "" };
                setUserProfile(updatedProfile);
                if (userId) {
                  try {
                    await setDoc(doc(db, "users", userId), { userProfile: updatedProfile }, { merge: true });
                    await setDoc(doc(db, "publicProfiles", userId), {
                      userId: userId,
                      name: updatedProfile.name,
                      avatarUrl: "",
                      xp: xp,
                    }, { merge: true });
                  } catch(e) { console.error(e); }
                }
              }}
              className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors"
            >
              Remove Photo
            </button>
          )}
        </div>
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-white/30 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
                  Username
                </label>
                <div className="flex bg-gray-900/50 border border-white/10 rounded-xl overflow-hidden focus-within:border-white/30 transition-colors">
                  <span className="flex items-center pl-4 text-gray-500 font-bold">@</span>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-transparent px-2 py-2 text-sm outline-none"
                    placeholder="username"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
                  Bio / Status
                </label>
                <input
                  type="text"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-white/30 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
                    City
                  </label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-white/30 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
                    Country
                  </label>
                  <input
                    type="text"
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-white/30 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
                  Timezone
                </label>
                <input
                  type="text"
                  value={editTimezone}
                  onChange={(e) => setEditTimezone(e.target.value)}
                  className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-white/30 transition-colors"
                  placeholder="e.g. UTC-5, EST, GMT+1"
                />
              </div>
              <div className="flex space-x-2 pt-2">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-white text-black rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-200 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-white/5 text-gray-300 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-2xl font-bold">{userProfile.name}</h2>
                    <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${userProfile.tier === 'elite' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : userProfile.tier === 'pro' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                      {TIERS[userProfile.tier || 'free'].name}
                    </div>
                  </div>
                  {userProfile.username && (
                    <p className="text-sm font-mono text-gray-400 mt-0.5">
                      @{userProfile.username}
                    </p>
                  )}
                  <p className="text-sm text-gray-300 mt-2">
                    {userProfile.bio}
                  </p>
                  {(userProfile.city || userProfile.country || userProfile.timezone) && (
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      {(userProfile.city || userProfile.country) && (
                        <div className="flex items-center text-xs text-gray-400">
                          <MapPin className="w-3 h-3 mr-1" />
                          {[userProfile.city, userProfile.country].filter(Boolean).join(", ")}
                        </div>
                      )}
                      {userProfile.timezone && (
                        <div className="flex items-center text-xs text-gray-400">
                          <Clock className="w-3 h-3 mr-1" />
                          {userProfile.timezone}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-gray-500 text-xs mt-3">
                    Member since {userProfile.memberSince}
                  </p>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white"
                >
                  Edit
                </button>
              </div>
              <div className="flex space-x-2 mt-4">
                <span className="bg-white/10 text-gray-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                  {levelTitle}
                </span>
                <span className="bg-[#DFAD00]/20 text-[#FFDE00] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-[#DFAD00]/30 outline outline-1 outline-[#FFDE00]/10">
                  Level {currentLevel}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, i) => (
          <GlassCard
            key={i}
            className="flex flex-col items-center justify-center p-6 text-center"
          >
            <stat.icon className={`w-8 h-8 mb-2 ${stat.color}`} />
            <span className="text-2xl font-bold">{stat.value}</span>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">
              {stat.label}
            </span>
          </GlassCard>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 px-1">
          Recent Achievements
        </h3>
        <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-hide px-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-20 h-20 rounded-2xl bg-gray-800/50 flex-shrink-0 flex items-center justify-center border border-white/5"
            >
              <Target className="w-8 h-8 text-gray-300/40" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

interface SettingsProps {
  onReset: () => void;
  goal: string;
  onUpdateGoal: (newGoal: string) => void;
  onRegenerate: () => void;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  onTestNotification: () => void;
  themeColor: "auto" | "blue" | "purple" | "orange";
  setThemeColor: (color: "auto" | "blue" | "purple" | "orange") => void;
  workDuration: number;
  setWorkDuration: (duration: number) => void;
  compactMode: boolean;
  setCompactMode: (compact: boolean) => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
}

const SettingsView = ({
  onReset,
  goal,
  onUpdateGoal,
  onRegenerate,
  notificationsEnabled,
  onToggleNotifications,
  onTestNotification,
  themeColor,
  setThemeColor,
  workDuration,
  setWorkDuration,
  compactMode,
  setCompactMode,
  onLogout,
  onDeleteAccount,
}: SettingsProps) => {
  const [newGoal, setNewGoal] = useState(goal);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRegenerate = async () => {
    setIsRefreshing(true);
    await onRegenerate();
    setIsRefreshing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 max-w-4xl mx-auto w-full"
    >
      <div className="flex flex-col px-1">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-gray-400 text-sm">Manage your experience.</p>
      </div>

      <div className="space-y-4">
        <GlassCard>
          <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">
            Core Goal
          </h3>
          <div className="flex space-x-2 mb-4">
            <input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              className="flex-1 bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-white/30 transition-colors"
            />
            <button
              onClick={() => onUpdateGoal(newGoal)}
              className="px-4 py-2 bg-white text-black rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-200"
            >
              Save
            </button>
          </div>
          <button
            disabled={isRefreshing}
            onClick={handleRegenerate}
            className="w-full py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center space-x-2"
          >
            {isRefreshing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 text-gray-400" />
            )}
            <span>Regenerate System from Goal</span>
          </button>
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">
            Preferences
          </h3>
          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <label className="font-bold text-sm">Pomodoro Duration</label>
              <select
                value={workDuration.toString()}
                onChange={(e) => setWorkDuration(parseInt(e.target.value))}
                className="bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-white/30 transition-colors appearance-none"
              >
                <option value="15">15 Minutes</option>
                <option value="25">25 Minutes</option>
                <option value="50">50 Minutes</option>
              </select>
            </div>

            <div className="flex justify-between items-center border-t border-white/5 pt-4">
              <div>
                <p className="font-bold">Compact Mode</p>
                <p className="text-xs text-gray-500">Condense task views.</p>
              </div>
              <button
                onClick={() => setCompactMode(!compactMode)}
                className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${compactMode ? "bg-white" : "bg-gray-800"}`}
              >
                <div
                  className={`w-4 h-4 rounded-full transition-transform ${compactMode ? "bg-white translate-x-6" : "bg-gray-600"}`}
                />
              </button>
            </div>

            <div className="flex justify-between items-center border-t border-white/5 pt-4">
              <div>
                <p className="font-bold">Push Notifications</p>
                <p className="text-xs text-gray-500">
                  Get reminders for incomplete tasks.
                </p>
              </div>
              <button
                onClick={onToggleNotifications}
                className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${notificationsEnabled ? "bg-white" : "bg-gray-800"}`}
              >
                <div
                  className={`w-4 h-4 rounded-full transition-transform ${notificationsEnabled ? "bg-white translate-x-6" : "bg-gray-600"}`}
                />
              </button>
            </div>
            {notificationsEnabled && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={onTestNotification}
                  className="text-xs text-gray-400 font-bold uppercase hover:underline"
                >
                  Test Reminder
                </button>
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase text-gray-500">
              Integrations
            </h3>
            {getCalendarAccessToken() && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Connected
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">Google Calendar</p>
                <p className="text-xs text-gray-500">
                  Sync your Aureon weekly tasks and view events.
                </p>
              </div>
            </div>
            {getCalendarAccessToken() ? (
              <button
                onClick={() => {
                  disconnectGoogleCalendar();
                  alert("Google Calendar disconnected.");
                }}
                className="px-3 py-1.5 rounded-xl border border-white/10 text-xs text-gray-400 hover:text-red-400 hover:border-red-500/20 transition-colors self-start sm:self-auto"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await connectGoogleCalendar();
                    alert("Google Calendar connected successfully!");
                  } catch (e: any) {
                    alert("Failed to connect: " + e.message);
                  }
                }}
                className="px-4 py-1.5 rounded-xl bg-white text-black hover:bg-gray-200 text-xs font-bold uppercase tracking-wider transition-colors self-start sm:self-auto"
              >
                Connect
              </button>
            )}
          </div>
        </GlassCard>

        <GlassCard className="border-red-500/20 bg-gray-900/50">
          <h3 className="text-sm font-bold uppercase text-gray-400/50 mb-4">
            Danger Zone
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Resetting will delete your current goal and progress. This cannot be
            undone.
          </p>
          <div className="space-y-2">
            <button
              onClick={onReset}
              className="w-full py-3 border border-white/10 text-gray-400 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-white/10 transition-colors"
            >
              Reset All Data
            </button>
            <button
              onClick={onDeleteAccount}
              className="w-full py-3 border border-red-500/20 text-red-500 bg-red-500/5 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-red-500/20 transition-colors"
            >
              Delete Account
            </button>
          </div>
        </GlassCard>

        <button
          onClick={onLogout}
          className="w-full py-4 glass-card flex items-center justify-center space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-bold uppercase text-xs tracking-widest">
            Logout
          </span>
        </button>
      </div>
    </motion.div>
  );
};

// --- Modal Form Components (Extracted) ---

const AddTaskForm = ({
  roadmap,
  onAdd,
  defaultDay,
}: {
  roadmap: Roadmap | null;
  onAdd: (t: Task) => void;
  defaultDay?: string;
}) => {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(
    defaultDay || new Date().toLocaleDateString("en-US", { weekday: "long" }),
  );
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [taskColor, setTaskColor] = useState<"blue" | "purple" | "orange">(
    "blue",
  );
  const [duration, setDuration] = useState("15");
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleSuggest = async () => {
    if (!title || !roadmap) return;
    setIsSuggesting(true);
    const suggestion = await getSmartTaskSuggestion(title, roadmap.goal);
    setDesc(suggestion.description);
    setIsSuggesting(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    const newTask: Task = {
      id: Math.random().toString(),
      title,
      description: desc,
      duration: parseInt(duration, 10) || 15,
      timeLeft: (parseInt(duration, 10) || 15) * 60,
      xp: priority === "high" ? 30 : priority === "medium" ? 20 : 10,
      completed: false,
      color: taskColor,
      dayOfWeek,
      priority,
    };
    onAdd(newTask);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
          Title
        </label>
        <div className="flex space-x-2">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 transition-colors"
            placeholder="What focus today?"
          />
          <button
            type="button"
            onClick={handleSuggest}
            disabled={!title || isSuggesting}
            className="px-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 disabled:opacity-50"
          >
            <Sparkles
              className={`w-5 h-5 ${isSuggesting ? "animate-spin text-gray-400" : "text-gray-400"}`}
            />
          </button>
        </div>
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
          Description
        </label>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 transition-colors"
          placeholder="Short detail..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
            Duration
          </label>
          <div className="flex items-center bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 focus-within:border-white/30 transition-colors">
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full bg-transparent outline-none text-sm appearance-none"
              min="1"
            />
            <span className="text-xs text-gray-400 ml-1">min</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
            Day
          </label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value)}
            className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 transition-colors text-sm appearance-none"
          >
            {[
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ].map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) =>
              setPriority(e.target.value as "low" | "medium" | "high")
            }
            className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 transition-colors text-sm appearance-none"
          >
            <option value="low">Low (10 XP)</option>
            <option value="medium">Medium (20 XP)</option>
            <option value="high">High (30 XP)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
            Category
          </label>
          <select
            value={taskColor}
            onChange={(e) =>
              setTaskColor(e.target.value as "blue" | "purple" | "orange")
            }
            className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 transition-colors text-sm appearance-none flex items-center gap-2"
          >
            <option value="blue">Work (Blue)</option>
            <option value="purple">Personal (Purple)</option>
            <option value="orange">Health (Orange)</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        className="w-full py-3 gradient-bg rounded-xl font-bold uppercase tracking-widest mt-4 active:scale-95 transition-transform shadow-lg shadow-md shadow-black/40"
      >
        Add Task
      </button>
    </form>
  );
};

const WeeklyReviewCard = ({ goal, tasks, streak, level, xp }: { goal: string; tasks: Task[]; streak: number; level: number; xp: number }) => {
  const [review, setReview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReview = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/generateWeeklyReview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, tasks, streak, level, xp })
      });
      if (res.ok) {
        const data = await res.json();
        setReview(data.review);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  if (review) {
    return (
      <GlassCard className="mt-8 border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-transparent relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-yellow-500/20 blur-3xl rounded-full"></div>
        <div className="flex items-center space-x-3 mb-4">
          <Sparkles className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl font-bold text-yellow-400 tracking-tight">AI Weekly Review</h2>
        </div>
        <div className="prose prose-invert prose-yellow max-w-none text-sm">
          <Markdown>{review}</Markdown>
        </div>
        <button onClick={() => setReview(null)} className="mt-6 text-xs text-yellow-500/70 hover:text-yellow-400 font-semibold uppercase tracking-widest transition-colors">
          Dismiss Review
        </button>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="mt-8 flex flex-col md:flex-row items-center justify-between border-dashed border-2 border-white/10 hover:border-white/20 transition-colors p-6 group cursor-pointer" onClick={generateReview}>
      <div className="flex items-center space-x-4 mb-4 md:mb-0">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
          <Activity className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
        </div>
        <div>
          <h3 className="font-bold text-lg">Generate Weekly Review</h3>
          <p className="text-sm text-gray-500">Analyze your progress and get AI insights for next week.</p>
        </div>
      </div>
      <button 
        disabled={isGenerating}
        className="px-6 py-2 rounded-full bg-white text-black font-bold uppercase tracking-wider text-xs hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center space-x-2 shrink-0"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analyzing...</span>
          </>
        ) : (
          <span>Run Review</span>
        )}
      </button>
    </GlassCard>
  );
};

const PomodoroTimer = ({
  workDuration,
  onComplete,
}: {
  workDuration: number;
  onComplete: () => void;
}) => {
  const [time, setTime] = useState(workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [ambientType, setAmbientType] = useState<"none" | "brown" | "rain">("none");
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isActive && time > 0) {
      timerRef.current = setInterval(() => setTime((prev) => prev - 1), 1000);
      audio.startAmbient(ambientType);
    } else {
      clearInterval(timerRef.current);
      audio.stopAmbient();
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, time, ambientType]);

  useEffect(() => {
    if (time === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsActive(false);
      audio.stopAmbient();
      onComplete();
    }
  }, [time, onComplete]);

  // Clean up ambient sound if component unmounts
  useEffect(() => {
    return () => {
      audio.stopAmbient();
    };
  }, []);

  const format = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="text-6xl font-mono font-bold mb-8 text-white tracking-widest">{format(time)}</div>
      
      <div className="flex space-x-6 mb-8">
        <button
          onClick={() => {
            if (!isActive) audio.playTimerStart();
            setIsActive(!isActive);
          }}
          className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shadow-xl"
        >
          {isActive ? (
            <Pause className="w-8 h-8 text-white" />
          ) : (
            <Play className="w-8 h-8 ml-1 text-white" />
          )}
        </button>
        <button
          onClick={() => {
            setIsActive(false);
            setTime(workDuration * 60);
          }}
          className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shadow-xl"
        >
          <RotateCcw className="w-8 h-8 text-white" />
        </button>
      </div>
      
      {/* Soundscape Selector */}
      <div className="flex space-x-2 bg-black/20 p-1.5 rounded-full mb-6">
        {(["none", "brown", "rain"] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              setAmbientType(type);
              if (isActive) {
                audio.startAmbient(type);
              }
            }}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${ambientType === type ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}
          >
            {type === "none" ? "Silent" : type === "brown" ? "Deep Focus" : "Rain"}
          </button>
        ))}
      </div>

      <p className="mt-4 text-gray-500 text-sm italic text-center">
        "Focus on the process, not the outcome."
      </p>
    </div>
  );
};

const ResetExercise = ({ onComplete }: { onComplete: () => void }) => {
  const [phase, setPhase] = useState<"In" | "Out">("In");
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const interval = setInterval(
      () => setPhase((p) => (p === "In" ? "Out" : "In")),
      4000,
    );
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setFinished(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="text-xl font-mono mb-8 text-gray-500">
        {Math.floor(timeLeft / 60)}:
        {(timeLeft % 60).toString().padStart(2, "0")}
      </div>
      <motion.div
        animate={{
          scale: phase === "In" ? 1.4 : 0.8,
          opacity: phase === "In" ? 1 : 0.6,
        }}
        transition={{ duration: 4, ease: "easeInOut" }}
        className="w-32 h-32 rounded-full gradient-bg flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.5)]"
      >
        <span className="text-2xl font-black uppercase tracking-widest">
          {phase}
        </span>
      </motion.div>
      <p className="mt-16 text-gray-400 font-medium h-6">
        {finished
          ? "Exercise Complete"
          : `Breathe ${phase === "In" ? "deeply" : "slowly"}`}
      </p>

      {finished && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onComplete}
          className="mt-8 px-8 py-3 gradient-bg rounded-xl font-bold uppercase tracking-widest shadow-xl shadow-md shadow-black/40"
        >
          Claim 100 XP
        </motion.button>
      )}
    </div>
  );
};

const JournalView = ({
  userId,
  userTier = "free",
  onShowUpgrade,
}: {
  userId: string | undefined;
  userTier?: "free" | "pro" | "elite";
  onShowUpgrade: (req: "pro" | "elite", feature: string) => void;
}) => {
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
    if (!userId) {
      return getFromLocalStorage()?.journals || [];
    }
    return [];
  });
  const [content, setContent] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!userId) {
      // Local storage is used, save entries when they update
      saveToLocalStorage({ journals: entries });
      return;
    }
    const q = query(
      collection(db, `users/${userId}/journals`),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as JournalEntry,
        );
        setEntries(docs);
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `users/${userId}/journals`,
        );
      },
    );
    return () => unsubscribe();
  }, [userId, entries]); // Include entries in dependency for localstorage effect

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsAnalyzing(true);
    try {
      const insight = await analyzeJournal(content);
      
      if (!userId) {
        // Local storage insert
        const newEntry: JournalEntry = {
          id: Math.random().toString(),
          userId: "local",
          content,
          insight,
          createdAt: Date.now(),
        };
        setEntries((prev) => [newEntry, ...prev]);
        setContent("");
        return;
      }

      const newEntryRef = doc(collection(db, `users/${userId}/journals`));
      await setDoc(newEntryRef, {
        id: newEntryRef.id,
        userId,
        content,
        insight,
        createdAt: Date.now(),
      });
      setContent("");
    } catch (error) {
      if (userId) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `users/${userId}/journals`,
        );
      } else {
        console.error(error);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!userId) {
      setEntries((prev) => prev.filter(e => e.id !== id));
      return;
    }
    try {
      await deleteDoc(doc(db, `users/${userId}/journals/${id}`));
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `users/${userId}/journals/${id}`,
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 max-w-4xl mx-auto w-full"
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black tracking-tight flex items-center justify-center space-x-3">
          <Book className="w-8 h-8 text-gray-400" />
          <span>Daily Journal</span>
        </h1>
        <p className="text-gray-400 mt-2 text-sm uppercase tracking-widest font-bold">
          Write your thoughts. AI extracts the lesson.
        </p>
      </div>

      <GlassCard className="border-white/10 bg-white/5">
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <textarea
            className="w-full bg-gray-900/50 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-white/30 transition-colors resize-none text-sm leading-relaxed"
            rows={4}
            placeholder="What's on your mind today? Dump your thoughts..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isAnalyzing}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!content.trim() || isAnalyzing}
              className="px-6 py-3 gradient-bg rounded-xl font-bold uppercase tracking-widest text-xs active:scale-95 transition-transform flex items-center space-x-2 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Save & Analyze</span>
                </>
              )}
            </button>
          </div>
        </form>
      </GlassCard>

      <div className="space-y-4 mt-8">
        {entries.length === 0 ? (
          <div className="text-center py-10 text-gray-500 italic text-sm">
            Your journal is empty. Start writing to see insights.
          </div>
        ) : (
          entries.map((entry) => (
            <GlassCard key={entry.id} className="relative group">
              <button
                onClick={() => handleDelete(entry.id)}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-white/10 rounded-full"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
              <div className="flex flex-col space-y-3">
                <div className="text-xs font-mono text-gray-500 uppercase">
                  {new Date(entry.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap pr-8">
                  {entry.content}
                </p>
                <div className="mt-4">
                  <FeatureGuard
                    userTier={userTier}
                    requiredTier="pro"
                    featureName="AI Journal Analysis"
                    onShowUpgrade={onShowUpgrade}
                    fallback={
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-center">
                        <span className="text-sm font-medium blur-sm select-none">Unlock advanced AI pattern recognition to see your insights.</span>
                      </div>
                    }
                  >
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start space-x-3">
                      <Sparkles className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                          AI Insight
                        </div>
                        <p className="text-sm font-medium">{entry.insight}</p>
                      </div>
                    </div>
                  </FeatureGuard>
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </motion.div>
  );
};

// --- Subscription & Features ---
const UpgradeModal = ({
  isOpen,
  onClose,
  requiredTier,
  featureName,
  onUpgrade,
}: {
  isOpen: boolean;
  onClose: () => void;
  requiredTier: "pro" | "elite";
  featureName: string;
  onUpgrade: (tier: "pro" | "elite") => void;
}) => {
  const [step, setStep] = useState<"presentation" | "payment">("presentation");
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank_transfer" | "eft">("card");

  const isElite = requiredTier === "elite";

  const cfg = {
    pro: {
      name: "Pro",
      tagline: "Unlock Your",
      taglineHighlight: "Full Potential",
      bgSubtle: "bg-yellow-500/10",
      hexGradientText: "from-yellow-600 via-yellow-400 to-yellow-200",
      bgGradientTop: "from-yellow-900/20 to-black",
      borderPulse: "border-yellow-500/30",
      textColor: "text-yellow-500",
      textLight: "text-yellow-400",
      buttonBg: "bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 hover:shadow-yellow-500/20",
      buttonSolid: "bg-yellow-500 hover:bg-yellow-400 shadow-yellow-500/20",
      buttonText: "text-black",
      ringFocus: "focus:ring-yellow-500/50",
      shadowGlow: "shadow-yellow-500/5",
      checkIcon: "text-yellow-500",
      monthlyPrice: "$10",
      yearlyPrice: "$90",
      yearlySave: "$30",
      yearlySelectedBorder: "border-yellow-500 shadow-yellow-500/10 text-yellow-500",
      yearlySelectedBg: "bg-yellow-500/5",
      yearlyBadgeBg: "bg-yellow-500 text-black",
      comparisonShadow: "shadow-2xl shadow-yellow-500/5",
      features: [
        { icon: Lock, title: "The Zone Focus Lock-In", desc: "Sequential task timer lock-in with 2-min box breathing reset & soundscapes." },
        { icon: Zap, title: "Smart Task Breakdown", desc: "Decompose overwhelming tasks into 5–15 min friction-free micro-actions." },
        { icon: Sun, title: "Daily Executive Briefing", desc: "Morning kickoff with priority directive, mental model, and voice briefing." },
        { icon: Bot, title: "AI Performance Coaching", desc: "Aureon analyzes your patterns and helps optimize your consistency." },
        { icon: Activity, title: "Weekly Reviews & Analytics", desc: "AI synthesizes your weekly wins, trajectory, and upcoming horizon." }
      ],
      beforeDesc: ["Inconsistent routines", "Overwhelmed by goals", "Reactive mindset"],
      afterDesc: ["Structured discipline", "Intentional progress", "Data-driven clarity"],
      compPrev: { name: "Explorer (Free)", items: ["1 active goal", "Custom smart roadmap", "Basic task tracking"] },
      compNew: { name: "Builder (Pro)", items: ["The Zone Focus Lock-In", "2m Breathing Cool Down", "Smart Task Breakdown", "Daily Executive Briefing", "AI Weekly Review", "Google Calendar sync"] },
      iconHeaderBg: "bg-gradient-to-tr from-yellow-600 to-yellow-300",
      cardHover: "hover:border-yellow-500/20"
    },
    elite: {
      name: "Elite",
      tagline: "Achieve Ultimate",
      taglineHighlight: "Mastery",
      bgSubtle: "bg-orange-500/10",
      hexGradientText: "from-orange-600 via-orange-400 to-orange-200",
      bgGradientTop: "from-orange-900/20 to-black",
      borderPulse: "border-orange-500/30",
      textColor: "text-orange-500",
      textLight: "text-orange-400",
      buttonBg: "bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600 hover:shadow-orange-500/20",
      buttonSolid: "bg-orange-500 hover:bg-orange-400 shadow-orange-500/20",
      buttonText: "text-black",
      ringFocus: "focus:ring-orange-500/50",
      shadowGlow: "shadow-orange-500/5",
      checkIcon: "text-orange-500",
      monthlyPrice: "$30",
      yearlyPrice: "$270",
      yearlySave: "$90",
      yearlySelectedBorder: "border-orange-500 shadow-orange-500/10 text-orange-500",
      yearlySelectedBg: "bg-orange-500/5",
      yearlyBadgeBg: "bg-orange-500 text-black",
      comparisonShadow: "shadow-2xl shadow-orange-500/5",
      features: [
        { icon: Radio, title: "40Hz Gamma Flow & Stoic AI", desc: "Neuro-acoustic gamma flow state entrainment & live stoic interventions in The Zone." },
        { icon: MessageSquare, title: "24/7 AI Coach Chat", desc: "Unlimited on-demand access to your AI performance coach." },
        { icon: Activity, title: "Daily AI Coach Insights", desc: "Hyper-personalized daily insights based on your progress and patterns." },
        { icon: Award, title: "Elite Leaderboard", desc: "Compete globally with top performers in the exclusive Elite bracket." },
        { icon: Crown, title: "Elite Profile Prestige", desc: "Exclusive profile badges, UI themes, and prestige indicators." }
      ],
      beforeDesc: ["Good but not great", "Siloed progress", "Standard AI insights"],
      afterDesc: ["Absolute mastery", "Global competition", "Hyper-personalized coaching"],
      compPrev: { name: "Builder (Pro)", items: ["The Zone (Standard)", "AI journal analysis", "Focus system", "Weekly review"] },
      compNew: { name: "Mastery (Elite)", items: ["The Zone: 40Hz Gamma Flow", "Live Stoic Interventions", "24/7 AI Coach Chat", "Elite Leaderboard", "Unlimited Everything"] },
      iconHeaderBg: "bg-gradient-to-tr from-orange-600 to-orange-300",
      cardHover: "hover:border-orange-500/20"
    }
  };

  const activeCfg = cfg[requiredTier];

  const [isProcessing, setIsProcessing] = useState(false);

  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [successTierData, setSuccessTierData] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep("presentation");
      setIsProcessing(false);
      setShowPaymentConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: requiredTier,
          plan: selectedPlan,
          paymentMethod,
          email: auth.currentUser?.email || "guest@example.com"
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        if (data.isShopLink) {
          // Open in a new tab because it's a static generic shop link
          window.open(data.url, "_blank");
          setIsProcessing(false);
          setSuccessTierData(data.tier || requiredTier);
          setShowPaymentConfirm(true);
        } else {
          // Dynamic Checkout Session handles redirecting back correctly
          window.location.href = data.url;
        }
      } else if (data.error === "PAYSTACK_SECRET_KEY not configured") {
        setIsProcessing(false);
        alert("Payment cannot be processed. Please configure your PAYSTACK_SECRET_KEY in the Environment Variables Settings.");
      } else {
        // A real error occurred from Paystack
        setIsProcessing(false);
        alert(`Payment Error: ${data.error || "Failed to create checkout session"}`);
      }
    } catch (err) {
      setIsProcessing(false);
      console.error(err);
      alert("Failed to connect to the payment server. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0A0A0A] overflow-y-auto text-white">
      {/* Sticky Header */}
      <div className="sticky top-0 z-[110] bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-8 h-8 rounded ${activeCfg.iconHeaderBg} flex items-center justify-center`}>
            <Crown className="w-4 h-4 text-black" />
          </div>
          <span className="font-bold tracking-widest uppercase text-sm">Aureon {activeCfg.name}</span>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {step === "presentation" ? (
        <div className="max-w-4xl mx-auto px-4 pb-32">
          {featureName && (
            <div className="mt-8 mb-4 max-w-fit mx-auto bg-white/5 border border-white/10 px-4 py-1.5 rounded-full flex items-center space-x-2 shadow-lg">
              <Lock className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-medium text-gray-300">
                You need {TIERS[requiredTier].name} to access {featureName}
              </span>
            </div>
          )}

          {/* 1. HERO SECTION */}
          <section className="py-20 text-center relative">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 ${activeCfg.bgSubtle} blur-[100px] rounded-full pointer-events-none`} />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10"
            >
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                {activeCfg.tagline} <br/>
                <span className={`bg-gradient-to-tr ${activeCfg.hexGradientText} bg-clip-text text-transparent`}>
                  {activeCfg.taglineHighlight}
                </span>
              </h1>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">
                Aureon {activeCfg.name} transforms daily discipline into measurable personal evolution.
              </p>
            </motion.div>
          </section>

          {/* 2. CURRENT VS PRO COMPARISON */}
          <section className="py-12 mb-12">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                <h3 className="text-lg font-bold text-gray-400 mb-6 uppercase tracking-widest">{activeCfg.compPrev.name}</h3>
                <ul className="space-y-4">
                  {activeCfg.compPrev.items.slice(0, 2).map((item, i) => (
                    <li key={`prev_0_${i}`} className="flex items-center space-x-3 text-gray-300">
                      <Check className="w-5 h-5 text-gray-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                  {activeCfg.compPrev.items.slice(2).map((item, i) => (
                    <li key={`prev_1_${i}`} className="flex items-center space-x-3 text-gray-500">
                      <Lock className="w-4 h-4" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`bg-gradient-to-b ${activeCfg.bgGradientTop} border ${activeCfg.borderPulse} rounded-3xl p-8 relative overflow-hidden ${activeCfg.comparisonShadow}`}>
                <div className={`absolute top-0 right-0 w-32 h-32 ${activeCfg.bgSubtle} blur-3xl`} />
                <h3 className={`text-lg font-bold ${activeCfg.textLight} mb-6 uppercase tracking-widest flex items-center space-x-2`}>
                  <span>{activeCfg.compNew.name}</span>
                  <Crown className="w-4 h-4" />
                </h3>
                <ul className="space-y-4">
                  {activeCfg.compNew.items.map((item, i) => (
                    <li key={`new_${i}`} className="flex items-center space-x-3 text-white">
                      <Check className={`w-5 h-5 ${activeCfg.textLight}`} />
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* 3. FEATURE SHOWCASE */}
          <section className="py-12">
            <h2 className="text-3xl font-bold mb-10 text-center tracking-tight">The {activeCfg.name} Advantage</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {activeCfg.features.map((f, i) => (
                <div key={i} className={`glass-card p-6 flex flex-col space-y-3 border-white/5 ${activeCfg.cardHover} transition-colors`}>
                  <div className={`w-10 h-10 rounded-xl ${activeCfg.bgSubtle} flex items-center justify-center`}>
                    <f.icon className={`w-5 h-5 ${activeCfg.textLight}`} />
                  </div>
                  <h4 className="font-bold text-lg">{f.title}</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4. TRANSFORMATION SECTION */}
          <section className="py-20 border-y border-white/5 my-12">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight">Your Evolution</h2>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-center space-y-8 md:space-y-0 md:space-x-12">
              <div className="text-center">
                <span className="text-gray-500 text-sm tracking-widest uppercase font-bold mb-4 block">Before {activeCfg.name}</span>
                <ul className="space-y-2 text-gray-400 font-medium">
                  {activeCfg.beforeDesc.map((item, i) => <li key={`b_${i}`}>{item}</li>)}
                </ul>
              </div>
              <ArrowRight className={`w-8 h-8 ${activeCfg.textColor} opacity-50 hidden md:block`} />
              <div className="text-center">
                <span className={`${activeCfg.textColor} text-sm tracking-widest uppercase font-bold mb-4 block`}>After {activeCfg.name}</span>
                <ul className="space-y-2 text-white font-medium text-lg">
                  {activeCfg.afterDesc.map((item, i) => <li key={`a_${i}`}>{item}</li>)}
                </ul>
              </div>
            </div>
          </section>

          {/* 5. TESTIMONIAL */}
          <section className="py-12 max-w-2xl mx-auto text-center">
            <div className="flex items-center justify-center space-x-1 mb-6">
              {[...Array(5)].map((_, i) => <Star key={i} className={`w-5 h-5 ${activeCfg.textColor} fill-current`} />)}
            </div>
            <p className="text-2xl font-light italic text-gray-300 leading-relaxed mb-6">
              "Aureon helped me become consistent for the first time in years. The AI coaching and focus tools changed my daily trajectory."
            </p>
            <div className="flex items-center justify-center space-x-3">
              <div className="w-10 h-10 rounded-full border border-white/10 bg-gray-800 flex items-center justify-center overflow-hidden">
                 <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus" alt="User" className="w-full h-full" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm">Marcus T.</div>
                <div className={`text-xs ${activeCfg.textColor}`}>{activeCfg.name} Member</div>
              </div>
            </div>
          </section>

          {/* HOW IT WORKS SECTION */}
          <section className="py-16 max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
              <p className="text-gray-400 mt-4 max-w-xl mx-auto">The journey to your evolved self is structured into three simple, continuous phases.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 relative">
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent hidden md:block -translate-y-1/2 z-0" />
              
              <div className="relative z-10 glass-card p-6 border-white/5 flex flex-col items-center text-center bg-[#0d0d0d]/90 backdrop-blur-md">
                <div className={`w-12 h-12 rounded-full ${activeCfg.yearlyBadgeBg} flex items-center justify-center text-xl font-bold mb-4 shadow-lg`}>1</div>
                <h3 className="font-bold text-lg mb-2">Initialize</h3>
                <p className="text-gray-400 text-sm">Tell Aureon your ultimate goal. Our AI crafts a structured, step-by-step roadmap tailored specifically for you.</p>
              </div>

              <div className="relative z-10 glass-card p-6 border-white/5 flex flex-col items-center text-center bg-[#0d0d0d]/90 backdrop-blur-md">
                <div className={`w-12 h-12 rounded-full ${activeCfg.yearlyBadgeBg} flex items-center justify-center text-xl font-bold mb-4 shadow-lg`}>2</div>
                <h3 className="font-bold text-lg mb-2">Execute</h3>
                <p className="text-gray-400 text-sm">Follow your daily and weekly tasks. Use the focus mode to stay locked in and track your progress in real-time.</p>
              </div>

              <div className="relative z-10 glass-card p-6 border-white/5 flex flex-col items-center text-center bg-[#0d0d0d]/90 backdrop-blur-md">
                <div className={`w-12 h-12 rounded-full ${activeCfg.yearlyBadgeBg} flex items-center justify-center text-xl font-bold mb-4 shadow-lg`}>3</div>
                <h3 className="font-bold text-lg mb-2">Evolve</h3>
                <p className="text-gray-400 text-sm">Earn XP, maintain your streak, level up your profile, and receive personalized feedback to overcome plateaus.</p>
              </div>
            </div>
          </section>

          {/* 6. PRICING & 7. CTA */}
          <section className="py-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold tracking-tight">Choose Your Evolution</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-10">
              <div 
                onClick={() => setSelectedPlan("monthly")}
                className={`cursor-pointer rounded-2xl p-6 border-2 transition-all ${selectedPlan === 'monthly' ? 'bg-white/5 border-gray-500' : 'bg-transparent border-white/5 hover:border-white/20'}`}
              >
                <div className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-2">Monthly Plan</div>
                <div className="text-3xl font-black mb-1">{activeCfg.monthlyPrice} <span className="text-sm font-medium text-gray-500">/mo</span></div>
                <p className="text-xs text-gray-500 mt-2">Billed monthly.</p>
              </div>
              <div 
                onClick={() => setSelectedPlan("yearly")}
                className={`cursor-pointer rounded-2xl p-6 border-2 transition-all relative ${selectedPlan === 'yearly' ? `${activeCfg.yearlySelectedBg} ${activeCfg.yearlySelectedBorder}` : 'bg-transparent border-white/5 hover:bg-white/5'}`}
              >
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 ${activeCfg.yearlyBadgeBg} text-[10px] uppercase tracking-widest font-black px-3 py-1 rounded-full`}>
                  Recommended
                </div>
                <div className={`${activeCfg.textColor} font-bold uppercase tracking-widest text-xs mb-2`}>Yearly Plan</div>
                <div className="text-3xl font-black mb-1 text-white">{activeCfg.yearlyPrice} <span className="text-sm font-medium text-gray-500">/yr</span></div>
                <p className={`text-xs ${activeCfg.textColor} opacity-80 mt-2`}>Save 25% ({activeCfg.yearlySave})</p>
              </div>
            </div>
            
            <div className="flex flex-col items-center">
              <button
                onClick={() => setStep("payment")}
                className={`w-full max-w-md py-4 rounded-full font-black uppercase tracking-widest ${activeCfg.buttonBg} ${activeCfg.buttonText} bg-[length:200%_auto] transition-all duration-500 text-sm mb-4`}
              >
                Upgrade to {activeCfg.name}
              </button>
              <span className="text-xs text-gray-500">Start your evolution today. Secure payment.</span>
            </div>
          </section>
        </div>
      ) : showPaymentConfirm ? (
        <div className="max-w-md mx-auto px-4 py-32 h-full flex items-center justify-center">
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="w-full bg-[#111] border border-white/10 rounded-3xl p-8 text-center"
           >
             <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-green-400" />
             </div>
             <h2 className="text-2xl font-bold mb-2">Complete Payment</h2>
             <p className="text-gray-400 text-sm mb-8">
               A secure payment link has been opened in a new tab. Once you have completed the payment via Paystack, click the button below to activate your {activeCfg.name} features.
             </p>
             <button
                onClick={() => {
                   window.location.href = `/?payment=success&tier=${successTierData}`;
                }}
                className={`w-full py-4 rounded-xl font-bold ${activeCfg.buttonSolid} ${activeCfg.buttonText} transition-all disabled:opacity-50`}
              >
                I have completed the payment
              </button>
           </motion.div>
        </div>
      ) : (
        <div className="max-w-md mx-auto px-4 py-32 h-full flex items-center justify-center">
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="w-full bg-[#111] border border-white/10 rounded-3xl p-8"
           >
             <h2 className="text-2xl font-bold mb-2">Secure Checkout</h2>
             <p className="text-gray-400 text-sm mb-8">
               Subscribe to Aureon {activeCfg.name} ({selectedPlan === 'yearly' ? `${activeCfg.yearlyPrice}/year` : `${activeCfg.monthlyPrice}/month`})
             </p>

             <div className="space-y-4 mb-8">
               <div className="grid grid-cols-3 gap-2">
                 <button
                   onClick={() => setPaymentMethod("card")}
                   className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 border ${paymentMethod === 'card' ? `bg-white/10 ${activeCfg.borderPulse}` : 'bg-white/5 border-transparent hover:bg-white/10'} transition-all`}
                 >
                   <CreditCard className={`w-6 h-6 ${paymentMethod === 'card' ? activeCfg.textLight : 'text-gray-400'}`} />
                   <span className="text-xs font-bold">Card</span>
                 </button>
                 <button
                   onClick={() => setPaymentMethod("bank_transfer")}
                   className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 border ${paymentMethod === 'bank_transfer' ? `bg-white/10 ${activeCfg.borderPulse}` : 'bg-white/5 border-transparent hover:bg-white/10'} transition-all`}
                 >
                   <Wallet className={`w-6 h-6 ${paymentMethod === 'bank_transfer' ? activeCfg.textLight : 'text-gray-400'}`} />
                   <span className="text-xs font-bold">Bank Transfer</span>
                 </button>
                 <button
                   onClick={() => setPaymentMethod("eft")}
                   className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 border ${paymentMethod === 'eft' ? `bg-white/10 ${activeCfg.borderPulse}` : 'bg-white/5 border-transparent hover:bg-white/10'} transition-all`}
                 >
                   <SmartphoneNfc className={`w-6 h-6 ${paymentMethod === 'eft' ? activeCfg.textLight : 'text-gray-400'}`} />
                   <span className="text-xs font-bold">EFT</span>
                 </button>
               </div>
               
               {/* PAYMENT INPUTS */}
               <div className="pt-4 border-t border-white/5">
                 {paymentMethod === 'card' ? (
                   <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
                      <CreditCard className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                      <div className="text-sm font-bold">Pay with Credit/Debit Card</div>
                      <div className="text-xs text-gray-400 mt-1">You will be securely redirected to Paystack to process your payment.</div>
                   </div>
                 ) : paymentMethod === 'bank_transfer' ? (
                   <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
                      <Wallet className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                      <div className="text-sm font-bold">Pay with Bank Transfer</div>
                      <div className="text-xs text-gray-400 mt-1">You will be redirected to Paystack to complete your purchase securely via Bank Transfer.</div>
                   </div>
                 ) : (
                   <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
                      <SmartphoneNfc className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <div className="text-sm font-bold">Pay with EFT</div>
                      <div className="text-xs text-gray-400 mt-1">You will be securely redirected to Paystack to process your EFT transaction.</div>
                   </div>
                 )}
               </div>
             </div>

             <div className="space-y-3">
               <button
                 onClick={handlePayment}
                 disabled={isProcessing}
                 className={`w-full py-4 rounded-xl font-bold ${activeCfg.buttonSolid} ${activeCfg.buttonText} transition-all flex items-center justify-center space-x-2 disabled:opacity-50`}
               >
                 {isProcessing ? <Loader2 className="w-5 h-5 animate-spin text-black" /> : <Shield className="w-4 h-4" />}
                 <span>{isProcessing ? 'Processing...' : `Pay ${selectedPlan === 'yearly' ? activeCfg.yearlyPrice : activeCfg.monthlyPrice} with ${paymentMethod === 'card' ? 'Card' : paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 'EFT'}`}</span>
               </button>
               <button
                 onClick={() => setStep("presentation")}
                 className="w-full py-4 rounded-xl font-bold bg-transparent text-gray-400 hover:text-white transition-colors"
               >
                 Back
               </button>
             </div>
           </motion.div>
        </div>
      )}
    </div>
  );
};

const FeatureGuard = ({
  children,
  userTier = "free",
  requiredTier,
  featureName,
  fallback,
  onShowUpgrade,
}: {
  children: React.ReactNode;
  userTier?: "free" | "pro" | "elite";
  requiredTier: "pro" | "elite";
  featureName: string;
  fallback?: React.ReactNode;
  onShowUpgrade: (reqTier: "pro" | "elite", feature: string) => void;
}) => {
  const currentLevel = TIERS[userTier].level;
  const reqLevel = TIERS[requiredTier].level;

  if (currentLevel >= reqLevel) {
    return <>{children}</>;
  }

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onShowUpgrade(requiredTier, featureName);
      }}
      className="relative group cursor-pointer inline-block w-full h-full"
    >
      <div className="pointer-events-none opacity-50 select-none grayscale w-full h-full">
        {fallback || children}
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px] rounded-xl border border-white/10">
         <div className="bg-black text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center space-x-1 shadow-xl">
           <Lock className="w-3 h-3 text-yellow-400" />
           <span>Requires {requiredTier === 'pro' ? 'Pro' : 'Elite'}</span>
         </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3200); // Wait for 3s logo animation
    return () => clearTimeout(timer);
  }, []);

  const [user, loading] = useAuthState(auth);

  const [currentView, setCurrentView] = useState<View>(() => {
    return "loading" as View;
  });

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (getFromLocalStorage()?.roadmap) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentView("home");
      } else {
        setCurrentView("onboarding");
      }
    } else {
      setCurrentView("auth");
    }
  }, [user, loading]);
  
  const [upgradeModal, setUpgradeModal] = useState<{isOpen: boolean; requiredTier: "pro"|"elite"; featureName: string}>({
    isOpen: false, requiredTier: "pro", featureName: ""
  });
  const handleShowUpgrade = (requiredTier: "pro" | "elite", featureName: string) => {
    setUpgradeModal({ isOpen: true, requiredTier, featureName });
  };

  const [tasks, setTasks] = useState<Task[]>(() => {
    const localTasks = getFromLocalStorage()?.tasks || [];
    return localTasks.map((t: any) => ({
      ...t,
      timeLeft: typeof t.timeLeft === "number" && !isNaN(t.timeLeft) ? t.timeLeft : (Number(t.duration) || 15) * 60
    }));
  });
  const [xp, setXp] = useState(() => {
    return getFromLocalStorage()?.xp || 0;
  });
  const level = Math.floor(xp / 1000) + 1;
  const [roadmap, setRoadmap] = useState<Roadmap | null>(() => {
    return getFromLocalStorage()?.roadmap || null;
  });
  const [streak, setStreak] = useState(() => {
    return getFromLocalStorage()?.streak || 0;
  });
  const [lastCompletedDate, setLastCompletedDate] = useState<string | null>(() => {
    return getFromLocalStorage()?.lastCompletedDate || null;
  });
  const [dailyQuote, setDailyQuote] = useState(
    "Your limit is only your imagination.",
  );
  const [coachInsight, setCoachInsight] = useState<string | null>(null);
  const [decomposingTask, setDecomposingTask] = useState<Task | null>(null);
  const [isZoneOpen, setIsZoneOpen] = useState(false);

  const handleAddSubtasksFromDecomposition = (subtasks: { title: string; duration: number; description?: string; sources?: TaskSource[] }[]) => {
    const todayStrLong = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const newTasks: Task[] = subtasks.map((s, idx) => ({
      id: `decomp_${Date.now()}_${idx}`,
      title: s.title,
      duration: s.duration,
      description: s.description || "",
      completed: false,
      color: "blue",
      xp: 25,
      dayOfWeek: decomposingTask?.dayOfWeek || todayStrLong,
      priority: "medium",
      timeLeft: s.duration * 60,
      sources: s.sources || decomposingTask?.sources || [],
    }));
    setTasks((prev) => [...prev, ...newTasks]);
    setXp((prev) => prev + 15);
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 },
      colors: ["#F59E0B", "#10B981", "#3B82F6"],
    });
  };
  const [history, setHistory] = useState<number[]>(() => {
    return getFromLocalStorage()?.history || [0, 0, 0, 0, 0, 0, 0];
  }); // Weekly XP history
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const profile = getFromLocalStorage()?.userProfile || {
      name: "",
      bio: "Focusing on personal growth.",
      startDate: new Date().toISOString(),
      memberSince: new Date().toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    };
    profile.tier = "pro";
    return profile;
  });
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [addTaskDefaultDay, setAddTaskDefaultDay] = useState<string | undefined>(undefined);
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showConsent, setShowConsent] = useState(() => {
    return localStorage.getItem("lifeos-consent") !== "true";
  });

  const handleConsent = () => {
    localStorage.setItem("lifeos-consent", "true");
    setShowConsent(false);
    saveToLocalStorage({ roadmap, xp, tasks, streak, history, userProfile, lastCompletedDate, chatMessages });
  };

  const [themeColor, setThemeColor] = useState<
    "auto" | "blue" | "purple" | "orange"
  >("auto");
  const [workDuration, setWorkDuration] = useState(25);
  const [compactMode, setCompactMode] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "coach"; text: string }[]
  >(() => {
    return getFromLocalStorage()?.chatMessages || [
      {
        role: "coach",
        text: "How can I help you today? I am your AI coach powered by Gemini.",
      },
    ];
  });
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);

  const handleUpgrade = (tier: "pro" | "elite") => {
    setUserProfile(prev => ({ ...prev, tier }));
    setUpgradeModal(prev => ({...prev, isOpen: false}));
    alert(`Welcome to Aureon ${TIERS[tier].name}. Your evolution begins now.`);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      const tierParam = params.get("tier") as "pro" | "elite" | null;
      if (tierParam) {
        localStorage.setItem("pending_upgrade", tierParam);
      }
      // clean up url
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get("payment") === "cancel") {
      alert("Payment was cancelled.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Initialize notification state
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      const savedPref = localStorage.getItem("lifeos-notifications");
      if (savedPref === "true") {
        // Will be picked up on next render loop? No, setState in effect is bad if unconditional
        // We handle this by setting the initial state better, but doing it here is fine as long as we don't trigger cascading renders.
        // For simplicity:
      }
    }
  }, []);

  // Sync initial notification state once
  useEffect(() => {
    const savedPref = localStorage.getItem("lifeos-notifications");
    if (savedPref === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotificationsEnabled(true);
    }
  }, []);

  // Task timer logic
  useEffect(() => {
    const interval = setInterval(() => {
      let playedAudio = false;
      setTasks((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (
            t.isActive &&
            !t.completed &&
            typeof t.timeLeft === "number" &&
            t.timeLeft > 0
          ) {
            changed = true;
            if (t.timeLeft - 1 <= 0 && !playedAudio) {
              audio.playLevelUp(); // Sound when time is up
              playedAudio = true;
              return { ...t, isActive: false, timeLeft: 0 };
            }
            return { ...t, timeLeft: Math.max(0, t.timeLeft - 1) };
          } else if (
            t.isActive &&
            !t.completed &&
            typeof t.timeLeft === "number" &&
            t.timeLeft <= 0
          ) {
            changed = true;
            if (!playedAudio) {
               audio.playLevelUp();
               playedAudio = true;
            }
            return { ...t, isActive: false, timeLeft: 0 };
          }
          return t;
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Periodic reminder logic
  useEffect(() => {
    if (notificationsEnabled && "Notification" in window) {
      const interval = setInterval(
        () => {
          const pendingTasks = tasks.filter((t) => !t.completed);
          if (pendingTasks.length > 0) {
            new Notification("Aureon Reminder", {
              body: `You still have ${pendingTasks.length} pending tasks to complete today. Let's get to work!`,
              icon: "/favicon.ico", // optional
            });
          }
        },
        2 * 60 * 60 * 1000,
      ); // 2 hours
      return () => clearInterval(interval);
    }
  }, [notificationsEnabled, tasks]);

  const handleToggleNotifications = () => {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notification");
      return;
    }

    if (!notificationsEnabled) {
      if (Notification.permission === "granted") {
        setNotificationsEnabled(true);
        localStorage.setItem("lifeos-notifications", "true");
        new Notification("Aureon", { body: "Push reminders enabled!" });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            setNotificationsEnabled(true);
            localStorage.setItem("lifeos-notifications", "true");
            new Notification("Aureon", { body: "Push reminders enabled!" });
          }
        });
      } else {
        alert(
          "Please enable notifications in your browser settings to receive reminders.",
        );
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem("lifeos-notifications", "false");
    }
  };

  const handleTestNotification = () => {
    if (notificationsEnabled && "Notification" in window) {
      const pendingTasks = tasks.filter((t) => !t.completed);
      new Notification("Aureon Reminder", {
        body: `Test: You have ${pendingTasks.length} pending tasks to complete. Focus up!`,
      });
    }
  };

  const startTaskTimer = (e?: React.MouseEvent | null, id?: string) => {
    if (e?.stopPropagation) e.stopPropagation();
    const targetId = id || (typeof e === 'string' ? e : '');
    if (!targetId) return;
    audio.playTimerStart();
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === targetId) {
          if (t.completed) return t;
          return { ...t, isActive: true };
        }
        return { ...t, isActive: false };
      }),
    );
  };

  const pauseTaskTimer = (e?: React.MouseEvent | null, id?: string) => {
    if (e?.stopPropagation) e.stopPropagation();
    const targetId = id || (typeof e === 'string' ? e : '');
    if (!targetId) return;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === targetId) {
          if (t.completed) return t;
          return { ...t, isActive: false };
        }
        return t;
      }),
    );
  };

  const resetTaskTimer = (e?: React.MouseEvent | null, id?: string) => {
    if (e?.stopPropagation) e.stopPropagation();
    const targetId = id || (typeof e === 'string' ? e : '');
    if (!targetId) return;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === targetId) {
          if (t.completed) return t;
          return { ...t, isActive: false, timeLeft: (t.duration || 25) * 60 };
        }
        return t;
      }),
    );
  };

  const todayStrLong = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const currentWeek = (() => {
    const start = new Date(userProfile.startDate || new Date());
    const now = new Date();
    const diffDays = Math.floor(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(3, Math.floor(diffDays / 7)));
  })();

  const todayTasks = tasks.filter((t) => {
    if (t.dayOfWeek && t.dayOfWeek !== todayStrLong) return false;
    if (t.weekIndex !== undefined && t.weekIndex !== currentWeek) return false;
    return true;
  });

  const toggleTaskImportant = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return { ...t, isImportant: !t.isImportant };
        }
        return t;
      }),
    );
  };

  const handleChat = async () => {
    if (!chatInput.trim() || isChatting) return;
    const userMessage = chatInput;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsChatting(true);

    try {
      // transform history for the gemini function
      const historyPayload = chatMessages.map((m) => ({
        role: m.role === "coach" ? "model" : "user",
        parts: [{ text: m.text }],
      }));
      const currentGoal = roadmap?.goal || "General Self-Improvement";

      const response = await chatWithCoach(
        userMessage,
        currentGoal,
        historyPayload,
      );
      setChatMessages((prev) => [...prev, { role: "coach", text: response }]);
    } catch (e) {
      console.error(e);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "coach",
          text: "Sorry, I encountered an error communicating with Gemini.",
        },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  const shareTask = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const shareText = task.completed
      ? `I just completed "${task.title}" on Aureon and earned +${task.xp} XP! 🚀🎯`
      : `I'm focusing on "${task.title}" using Aureon right now! ⏱️🎯`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Aureon Progress",
          text: shareText,
          url: window.location.href,
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      navigator.clipboard.writeText(shareText + " " + window.location.href);
      alert("Progress copied to clipboard!");
    }
  };

  const formatTaskTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const prevLevel = useRef(1);

  useEffect(() => {
    const currentLevel = Math.floor(xp / 1000) + 1;
    if (xp > 0 && currentLevel > prevLevel.current) {
      setShowLevelUp(true);
      audio.playLevelUp();
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
      });
      setTimeout(() => setShowLevelUp(false), 3000);
    }
    prevLevel.current = currentLevel;
  }, [xp]);

  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    if (!user) {
      if (!loading) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentView("auth");
      }
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          isRemoteUpdate.current = true;
          setRoadmap(data.roadmap || null);
          setXp(data.xp || 0);
          setTasks((prevTasks) => {
            const hasActive = prevTasks.some((t) => t.isActive);
            if (hasActive) {
               return prevTasks;
            }
            return (data.tasks || []).map((t: any) => ({
              ...t,
              timeLeft: typeof t.timeLeft === "number" && !isNaN(t.timeLeft) ? t.timeLeft : (Number(t.duration) || 15) * 60
            }));
          });

          const savedDate = data.lastCompletedDate;
          let currentStreak = data.streak || 0;

          if (savedDate) {
            setLastCompletedDate(savedDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const lastDate = new Date(savedDate);
            lastDate.setHours(0, 0, 0, 0);

            if (lastDate.getTime() < yesterday.getTime()) {
              currentStreak = 0; // Missed a day
            }
          }
          setStreak(currentStreak);

          setHistory(data.history || [0, 0, 0, 0, 0, 0, 0]);
          if (data.chatMessages) {
            setChatMessages(data.chatMessages);
          }
          
          let currentUserProfile = data.userProfile || { name: "", bio: "", tier: "pro", avatarUrl: "" };
          currentUserProfile.tier = "pro"; // FORCE PRO MODE FOR TESTING
          const pendingUpgrade = localStorage.getItem("pending_upgrade");
          if (pendingUpgrade) {
            currentUserProfile = { ...currentUserProfile, tier: pendingUpgrade as "pro" | "elite" };
            localStorage.removeItem("pending_upgrade");
            confetti({
              particleCount: 200,
              spread: 80,
              origin: { y: 0.6 },
              colors: ["#FFD700", "#FFA500", "#FFF8DC"],
            });
            setTimeout(() => {
              const tierName = pendingUpgrade === "pro" ? "Pro" : pendingUpgrade === "elite" ? "Elite" : pendingUpgrade;
              alert(`Welcome to Aureon ${tierName}. Your evolution begins now.`);
            }, 500);
            isRemoteUpdate.current = false; // Force write-back to database
          }
          
          setUserProfile(currentUserProfile);

          if (data.roadmap) {
            // Only force home view if we are stuck on onboarding, otherwise preserve user's view
            setTimeout(() => setCurrentView((prev) => prev === "onboarding" ? "home" : prev), 0);
          } else {
            setTimeout(() => setCurrentView("onboarding"), 0);
          }
        } else {
          // New user (no cloud data)
          if (!roadmap) {
            setTimeout(() => setCurrentView("onboarding"), 0);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      },
    );

    return () => unsubscribe();
  }, [user, loading, roadmap]);

  // Save to local storage on any state change
  useEffect(() => {
    saveToLocalStorage({
      roadmap,
      xp,
      tasks,
      streak,
      history,
      userProfile,
      lastCompletedDate,
      chatMessages,
    });
  }, [
    roadmap,
    xp,
    tasks,
    streak,
    history,
    userProfile,
    lastCompletedDate,
    chatMessages,
  ]);

  const debouncedAutoSync = useMemo(
    () =>
      debounce((userId: string, payload: any, profile: any) => {
        setDoc(doc(db, "users", userId), payload, { merge: true }).catch((error) =>
          handleFirestoreError(error, OperationType.WRITE, `users/${userId}`),
        );

        if (profile && profile.name) {
          setDoc(doc(db, "publicProfiles", userId), {
            userId: userId,
            name: profile.name,
            xp: payload.xp,
            ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
          }, { merge: true }).catch((error) =>
            handleFirestoreError(error, OperationType.WRITE, `publicProfiles/${userId}`),
          );
        }
      }, 1500),
    []
  );

  useEffect(() => {
    if (user && roadmap && !loading) {
      if (isRemoteUpdate.current) {
        isRemoteUpdate.current = false;
        return;
      }

      const payload = JSON.parse(JSON.stringify({
        userId: user.uid,
        roadmap,
        xp,
        tasks,
        streak,
        history,
        userProfile,
        lastCompletedDate,
        chatMessages,
      }));
      
      debouncedAutoSync(user.uid, payload, userProfile);
    }
    
    // Cleanup on unmount
    return () => {
      debouncedAutoSync.cancel();
    };
  }, [
    roadmap,
    xp,
    tasks,
    streak,
    history,
    userProfile,
    lastCompletedDate,
    chatMessages,
    user,
    loading,
    debouncedAutoSync
  ]);

  // Instant flush to Firestore on refresh/close
  useEffect(() => {
    if (!user || !roadmap) return;
    
    const handleBeforeUnload = () => {
      debouncedAutoSync.flush();
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user, roadmap, debouncedAutoSync]);

  useEffect(() => {
    // Generate a daily quote if onboarding is done
    if (roadmap && !dailyQuote.includes("Aureon:")) {
      getDailyInsight(roadmap.goal, xp, streak).then((insight) => {
        setDailyQuote(`Aureon: ${insight}`);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmap, streak]);

  const handleOnboardingComplete = (
    newRoadmap: Roadmap,
    name: string,
    age: string,
  ) => {
    setRoadmap(newRoadmap);
    setUserProfile((prev) => ({ 
      ...prev, 
      name, 
      age,
      startDate: new Date().toISOString()
    }));
    // Initialize tasks for all 4 weeks
    const initialTasks: Task[] = newRoadmap.weeks.flatMap((w, weekIdx) => w.tasks.map((t, i) => ({
      id: Math.random().toString(),
      title: t.title,
      description: t.description,
      duration: t.duration,
      timeLeft: t.duration * 60,
      xp: t.xp,
      completed: false,
      color: ["blue", "purple", "orange"][i % 3] as any,
      dayOfWeek: t.dayOfWeek,
      priority: t.priority as "low" | "medium" | "high",
      isImportant: t.isImportant,
      weekIndex: weekIdx,
      sources: t.sources || [],
    })));
    setTasks(initialTasks);
    setXp(0);
    setCurrentView("home");
  };

  const handleReset = async () => {
    clearLocalStorage();
    setRoadmap(null);
    setTasks([]);
    setXp(0);
    setStreak(1);
    setHistory([0, 0, 0, 0, 0, 0, 0]);
    setDailyQuote("Your limit is only your imagination.");
    setCoachInsight(null);
    setCurrentView("onboarding");
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch (err: any) {
        console.error("Failed to delete user data", err);
      }
    }
  };

  const handleLogout = () => {
    auth.signOut();
    clearLocalStorage();
    setRoadmap(null);
    setTasks([]);
    setXp(0);
    setStreak(0);
    setHistory([0, 0, 0, 0, 0, 0, 0]);
    setChatMessages([{ role: "coach", text: "How can I help you dominate your day?" }]);
    setDailyQuote("Your limit is only your imagination.");
    setCoachInsight(null);
    setCurrentView("onboarding");
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (window.confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "users", user.uid));
        await deleteDoc(doc(db, "publicProfiles", user.uid));
        await deleteUser(user);
        handleLogout();
      } catch (err: any) {
        if (err.code === "auth/requires-recent-login") {
           alert("Please log out and log back in to verify your identity before deleting your account.");
        } else {
           console.error("Failed to delete account", err);
           alert("Failed to delete account. Please try again.");
        }
      }
    }
  };

  const handleUpdateGoal = (newGoal: string) => {
    if (roadmap) {
      setRoadmap({ ...roadmap, goal: newGoal });
    }
  };

  const handleRegenerate = async () => {
    if (!roadmap) return;
    try {
      const newRoadmap = await generateRoadmap(roadmap.goal, userProfile.name, userProfile.age || "");
      handleOnboardingComplete(
        newRoadmap,
        userProfile.name,
        userProfile.age || "",
      );
    } catch (err: any) {
      alert(err.message || "Failed to regenerate roadmap. Please try again.");
    }
  };

  useEffect(() => {
    if (roadmap && tasks.length > 0) {
      const level = Math.floor(xp / 1000) + 1;
      getCoachRecommendation(roadmap.goal, tasks, streak, level, history).then(
        setCoachInsight,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmap?.goal, tasks, streak, xp]);

  // Logic to determine theme color based on goal
  const accentHex = "#FFDE00";

  // Add offline indicator logic
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#FFDE00", "#DFAD00", "#A67B00"],
    });
  };

  const toggleTask = (id: string) => {
    const targetTask = tasks.find((t) => t.id === id);
    if (!targetTask) return;

    const isNowCompleted = !targetTask.completed;
    const addedXp = targetTask.xp;

    if (isNowCompleted) {
      setXp((curr) => curr + addedXp);
      setHistory((prevHistory) => {
        const newHistory = [...prevHistory];
        newHistory[newHistory.length - 1] = (newHistory[newHistory.length - 1] || 0) + addedXp;
        return newHistory;
      });
    } else {
      setXp((curr) => Math.max(0, curr - addedXp));
    }

    const newTasks = tasks.map((t) => {
      if (t.id === id) {
        return { ...t, completed: isNowCompleted, isActive: isNowCompleted ? false : t.isActive };
      }
      return t;
    });

    // Day Complete Bonus
    const todayStrLong = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const currentWeek = (() => {
      const start = new Date(userProfile.startDate || new Date());
      const now = new Date();
      const diffDays = Math.floor(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, Math.min(3, Math.floor(diffDays / 7)));
    })();
    
    const filterTodayTasks = (tasksList: Task[]) => tasksList.filter((t) => {
      if (t.dayOfWeek && t.dayOfWeek !== todayStrLong) return false;
      if (t.weekIndex !== undefined && t.weekIndex !== currentWeek) return false;
      return true;
    });

    const todayNewTasks = filterTodayTasks(newTasks);
    const allDone = todayNewTasks.length > 0 && todayNewTasks.every((t) => t.completed);
    const prevTodayTasks = filterTodayTasks(tasks);
    const isNewlyDone = allDone && !prevTodayTasks.every((t) => t.completed);

    if (isNewlyDone) {
      const todayStr = new Date().toDateString();
      if (lastCompletedDate !== todayStr) {
        setXp((curr) => curr + 250);
        setStreak((s) => s + 1);
        setLastCompletedDate(todayStr);
        audio.playTaskComplete();
        triggerConfetti();
        setCoachInsight(
          "Phenomenal work today. You've maximized your output. Take some time to recover and prepare for tomorrow's climb.",
        );
      }
    }

    setTasks(newTasks);
  };

  const deleteTask = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };


  return (
    <>
      <AnimatePresence>
        {showConsent && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-[#0A0A0A]/95 backdrop-blur-md border-t border-[#DFAD00]/20 z-[200] flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
          >
            <p className="text-sm text-gray-300 max-w-3xl leading-relaxed">
              <strong className="text-[#DFAD00]">Data Storage Consent:</strong> Aureon stores your progress, settings, and personal data securely in your browser's local storage and syncing with our database to give you a seamless experience. We need your permission to store this data locally.
            </p>
            <button 
              onClick={handleConsent}
              className="flex-shrink-0 gradient-bg text-black px-8 py-3 rounded-full font-black text-sm tracking-widest uppercase hover:scale-105 transition-all shadow-[0_0_20px_rgba(223,173,0,0.3)] hover:shadow-[0_0_30px_rgba(255,222,0,0.5)]"
            >
              I Accept
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={() => setUpgradeModal(prev => ({ ...prev, isOpen: false }))}
        requiredTier={upgradeModal.requiredTier}
        featureName={upgradeModal.featureName}
        onUpgrade={handleUpgrade}
      />
      <TaskDecompositionModal
        isOpen={!!decomposingTask}
        onClose={() => setDecomposingTask(null)}
        taskTitle={decomposingTask?.title || ""}
        taskDescription={decomposingTask?.description}
        duration={decomposingTask?.duration}
        goal={roadmap?.goal}
        onAddSubtasks={handleAddSubtasksFromDecomposition}
        onStartFocusStep={(_step) => {
          setIsTimerOpen(true);
        }}
      />
      <TheZone
        isOpen={isZoneOpen}
        tasks={tasks}
        todayTasks={todayTasks}
        goal={roadmap?.goal || "Peak Performance"}
        userTier={userProfile.tier || "free"}
        onCompleteTask={(taskId) => {
          toggleTask(taskId);
        }}
        onStartTimer={(taskId) => {
          startTaskTimer(null, taskId);
        }}
        onPauseTimer={(taskId) => {
          pauseTaskTimer(null, taskId);
        }}
        onResetTimer={(taskId) => {
          resetTaskTimer(null, taskId);
        }}
        onExitZone={() => setIsZoneOpen(false)}
      />
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#080808]"
          >
            <div className="w-32 h-32 flex items-center justify-center rounded-3xl gradient-bg shadow-2xl shadow-black/50 relative overflow-hidden">
              <Logo className="w-full h-full object-cover z-10" animate={true} />
              <Sparkles className="w-16 h-16 text-white absolute mix-blend-overlay opacity-30" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex h-screen w-full overflow-hidden bg-transparent">
        {/* Subtle Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden hidden md:block">
        <div className="absolute top-[-10%] left-[20%] w-[40%] h-[40%] bg-[#DFAD00]/10 blur-[150px] rounded-full mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-10%] right-[10%] w-[30%] h-[30%] bg-[#FFDE00]/5 blur-[120px] rounded-full mix-blend-screen opacity-30" />
      </div>

      {/* SIDEBAR FOR DESKTOP */}
      {currentView !== "onboarding" && (
        <aside className="hidden md:flex flex-col w-64 lg:w-72 border-r border-white/5 bg-black/40 shrink-0 h-full relative z-10 backdrop-blur-xl">
          <div className="flex items-center justify-center p-6 border-b border-white/5">
            <span className="font-black text-2xl tracking-widest uppercase text-transparent bg-clip-text gradient-text">Aureon</span>
          </div>

          <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
            <button
              onClick={() => setCurrentView("home")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === "home" ? "bg-white/10 text-white font-bold shadow-sm" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
            >
              <Home
                className={`w-5 h-5 ${currentView === "home" ? "text-gray-400" : ""}`}
              />
              <span>Home</span>
            </button>
            <button
              onClick={() => setCurrentView("path")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === "path" ? "bg-white/10 text-white font-bold shadow-sm" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
            >
              <MapIcon
                className={`w-5 h-5 ${currentView === "path" ? "text-gray-400" : ""}`}
              />
              <span>Path</span>
            </button>
            <button
              onClick={() => setCurrentView("calendar")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === "calendar" ? "bg-white/10 text-white font-bold shadow-sm" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
            >
              <Calendar
                className={`w-5 h-5 ${currentView === "calendar" ? "text-gray-400" : ""}`}
              />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => {
                if (TIERS[userProfile.tier || "free"].level < TIERS.pro.level) {
                  handleShowUpgrade("pro", "The Zone");
                } else {
                  setIsZoneOpen(true);
                }
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border ${
                TIERS[userProfile.tier || "free"].level >= TIERS.elite.level
                  ? "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                  : TIERS[userProfile.tier || "free"].level >= TIERS.pro.level
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                  : "border-white/5 text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Zap className="w-5 h-5 text-current" />
                <span className="font-bold">The Zone</span>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-full bg-white/10 text-current">
                {TIERS[userProfile.tier || "free"].level >= TIERS.elite.level ? "Elite" : "Pro"}
              </span>
            </button>
            <button
              onClick={() => setCurrentView("journal")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === "journal" ? "bg-white/10 text-white font-bold shadow-sm" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
            >
              <Book
                className={`w-5 h-5 ${currentView === "journal" ? "text-gray-400" : ""}`}
              />
              <span>Journal</span>
            </button>
            <button
              onClick={() => setCurrentView("leaderboard")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === "leaderboard" ? "bg-white/10 text-white font-bold shadow-sm" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
            >
              <BarChart3
                className={`w-5 h-5 ${currentView === "leaderboard" ? "text-gray-400" : ""}`}
              />
              <span>Leaderboard</span>
            </button>
            <button
              onClick={() => setCurrentView("profile")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === "profile" ? "bg-white/10 text-white font-bold shadow-sm" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
            >
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt="Avatar"
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <User
                  className={`w-5 h-5 ${currentView === "profile" ? "text-gray-400" : ""}`}
                />
              )}
              <span>Profile</span>
            </button>
          </nav>

          <div className="p-4 border-t border-white/5">
            <button
              onClick={() => setCurrentView("settings")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === "settings" ? "bg-white/10 text-white font-bold shadow-sm" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
            >
              <SettingsIcon
                className={`w-5 h-5 ${currentView === "settings" ? "text-gray-400" : ""}`}
              />
              <span>Settings</span>
            </button>
          </div>
        </aside>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 h-full overflow-y-auto relative pb-24 md:pb-0 scrollbar-hide">
        {/* TOP BAR / HEADER (Inside Main) */}
        {currentView !== "onboarding" && (
          <header className="sticky top-0 z-40 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between transition-all md:px-10">
            {/* Mobile / Desktop Logo & Title */}
            <div className="flex justify-between items-center w-full md:w-auto md:hidden">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
                  <Logo className="w-full h-full object-cover" />
                </div>
                <span className="font-bold tracking-tight">Aureon</span>
              </div>
              {isOffline && (
                <div className="px-2 py-1 bg-[#FFDE00]/10 text-[#FFDE00] text-[10px] font-bold uppercase tracking-widest rounded-full border border-[#FFDE00]/30 animate-pulse mr-12 sm:mr-0">
                  Offline Sync
                </div>
              )}
            </div>

            {/* Desktop Title */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden border border-white/10 shrink-0 shadow-sm">
                <Logo className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold tracking-tight">
                  {currentView === "home"
                    ? `Good morning, ${userProfile.name.split(" ")[0]} 👋`
                    : currentView === "path"
                      ? "My Path"
                      : currentView === "calendar"
                        ? "Calendar"
                        : currentView === "leaderboard"
                          ? "Leaderboard"
                          : currentView === "profile"
                            ? "Profile"
                            : "Settings"}
                  </h1>
                  {isOffline && (
                    <div className="px-3 py-1 bg-[#FFDE00]/10 text-[#FFDE00] text-[10px] font-bold uppercase tracking-widest rounded-full border border-[#FFDE00]/30 animate-pulse">
                      Offline Sync
                    </div>
                  )}
                </div>
              <p className="text-gray-400 text-sm mt-0.5">
                {currentView === "home"
                  ? "You're on a roll! Keep up the momentum."
                  : currentView === "path"
                    ? "Visualizing your long-term success."
                    : currentView === "calendar"
                      ? "Your week at a glance."
                      : currentView === "leaderboard"
                        ? "See how you stack up."
                        : currentView === "profile"
                          ? "Your personal insights and data."
                          : "Manage your experience."}
              </p>
            </div>
            </div>

            <div className="flex items-center space-x-4 shrink-0">
              <div className="glass-panel px-4 py-2 flex items-center space-x-2">
                <span className="text-[#FFDE00] font-bold">
                  ⚡
                </span>
                <span className="font-mono font-medium text-sm text-[#FFDE00]">
                  {history[history.length - 1] || 0} XP Today
                </span>
              </div>
              <button
                className="md:hidden w-10 h-10 rounded-full glass-panel flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setCurrentView("settings")}
              >
                <SettingsIcon
                  className={`w-5 h-5 ${currentView === "settings" ? "text-[#FFDE00]" : "text-gray-400"}`}
                />
              </button>
            </div>
          </header>
        )}

        <div
          className={`mx-auto ${currentView === "onboarding" ? "max-w-3xl mt-12" : currentView === "auth" ? "max-w-3xl mt-12" : "max-w-6xl"} p-6 md:p-10 space-y-8`}
        >
          {currentView === "auth" && (
            <AuthView />
          )}

          {currentView === "onboarding" && (
            <OnboardingView user={user} onComplete={handleOnboardingComplete} />
          )}

          {currentView === "home" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <div className="xl:col-span-8 flex flex-col space-y-8">
                {/* 1. DAILY EXECUTIVE BRIEFING & THE ZONE (PRO/ELITE) */}
                {roadmap && TIERS[userProfile.tier || "free"].level >= TIERS.pro.level ? (
                  <DailyExecutiveBriefing
                    goal={roadmap.goal}
                    tasks={tasks}
                    streak={streak}
                    xp={xp}
                    level={level}
                    userName={userProfile.name}
                    onEnterTheZone={() => setIsZoneOpen(true)}
                  />
                ) : (
                  <div
                    onClick={() => handleShowUpgrade("pro", "The Zone & Executive Briefing")}
                    className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-[#18181b]/50 to-transparent hover:border-amber-500/40 transition-all p-4 cursor-pointer flex items-center justify-between group shadow-lg shadow-amber-500/5"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                        <Zap className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                            The Zone & Executive Kickoff
                          </p>
                          <span className="text-[9px] uppercase font-bold tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded-full">
                            Pro
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Lock into distraction-free focus mode with sequential task timers, 2m breathing resets, and 40Hz soundscapes.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider shrink-0 ml-3 flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                      <span>Unlock</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                )}

                {/* 2. PROGRESS CARD */}
                <GlassCard className="flex items-center space-x-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity">
                    <Trophy className="w-20 h-20 text-white" />
                  </div>
                  <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                    <svg
                      className="absolute inset-0 w-full h-full transform -rotate-90"
                      viewBox="0 0 100 100"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        stroke={accentHex}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray="282.7"
                        strokeDashoffset={
                          282.7 - (282.7 * ((xp % 1000) / 10)) / 100
                        }
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient
                          id="grad"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="#3B82F6" />
                          <stop offset="50%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#F97316" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">
                        {Math.floor(xp / 1000) + 1}
                      </span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest">
                        Level
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <h2 className="text-lg font-semibold">
                          Level {Math.floor(xp / 1000) + 1} – {getLevelTitle(Math.floor(xp / 1000) + 1)}
                        </h2>
                        <p className="text-sm text-gray-400 font-medium">
                          Next milestone at {(Math.floor(xp / 1000) + 1) * 1000}{" "}
                          XP
                        </p>
                      </div>
                      <span className="text-sm font-medium text-gray-300">
                        {(xp % 1000).toLocaleString()} / 1,000 XP (
                        {Math.round((xp % 1000) / 10)}%)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-900/50 rounded-full overflow-hidden">
                      <motion.div
                        key={xp}
                        initial={{ width: 0 }}
                        animate={{ width: `${(xp % 1000) / 10}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full gradient-bg rounded-full"
                      />
                    </div>
                  </div>
                </GlassCard>
                
                {roadmap && TIERS[userProfile.tier || "free"].level >= TIERS.pro.level && (
                  <WeeklyReviewCard goal={roadmap.goal} tasks={tasks} streak={streak} level={level} xp={xp} />
                )}

                {/* 3. TODAY’S TASKS */}
                <section className="space-y-4">
                  {(() => {
                    const todayStrLong = new Date().toLocaleDateString("en-US", { weekday: "long" });
                    const todayTasks = tasks.filter(t => {
                      if (t.dayOfWeek && t.dayOfWeek !== todayStrLong) return false;
                      if (t.weekIndex !== undefined) {
                        const start = new Date(userProfile.startDate || new Date());
                        const now = new Date();
                        const diffDays = Math.floor(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                        const currentWeek = Math.max(0, Math.min(3, Math.floor(diffDays / 7)));
                        if (t.weekIndex !== currentWeek) return false;
                      }
                      return true;
                    });
                    return (
                      <>
                        <div className="flex justify-between items-center px-1">
                          <h3 className="text-lg font-semibold flex items-center">
                            Today's Focus
                            {todayTasks.every((t) => t.completed) && todayTasks.length > 0 && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="ml-2 text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded-full uppercase tracking-tighter"
                              >
                                Day Complete!
                              </motion.span>
                            )}
                          </h3>
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                            {todayTasks.filter((t) => !t.completed).length} Tasks Remaining
                          </span>
                        </div>

                        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 mb-4 italic text-sm text-gray-400">
                          "{dailyQuote}"
                        </div>
                        <div className="space-y-3">
                          {todayTasks.length === 0 ? (
                            <motion.div
                              key="empty-state"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="glass-card flex flex-col items-center justify-center p-8 text-center border-dashed border border-white/10"
                            >
                              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10 shadow-lg ">
                                <Coffee className="w-8 h-8 text-gray-400" />
                              </div>
                              <h4 className="text-lg font-bold mb-1">
                                Clear Horizon
                              </h4>
                              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                                No tasks scheduled for today. Take a well-deserved
                                break or start something new.
                              </p>
                              <button
                                onClick={() => setIsAddTaskOpen(true)}
                                className="mt-6 px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center space-x-2"
                              >
                                <Plus className="w-4 h-4" />
                                <span>Add Focus Task</span>
                              </button>
                            </motion.div>
                          ) : (
                            <AnimatePresence mode="popLayout">
                              {[...todayTasks].sort((a, b) => {
                                if (a.completed !== b.completed) return a.completed ? 1 : -1;
                                if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
                                return 0;
                              }).map((task) => (
                                <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('button')) return;
                              toggleTask(task.id)
                            }}
                            className={`glass-panel ${compactMode ? "p-3 sm:p-2" : "p-4"} flex items-start sm:items-center gap-3 sm:gap-4 border-l-4 cursor-pointer transition-all group ${
                              task.completed
                                ? "task-dim !border-white/10 shadow-none bg-black/40"
                                : "border-[#FFDE00] bg-[#FFDE00]/5 shadow-[0_0_15px_-3px_rgba(255,222,0,0.1)] hover:shadow-[0_0_20px_-3px_rgba(255,222,0,0.2)]"
                            }`}
                          >
                            <div
                              className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                                compactMode ? "" : "mt-0.5"
                              } ${
                                task.completed
                                  ? "bg-white border-white"
                                  : "border-gray-600 hover:border-gray-400"
                              }`}
                            >
                              {task.completed && (
                                <motion.div
                                  initial={{ scale: 0, rotate: -45 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 25,
                                  }}
                                >
                                  <CheckCircle2 className="w-4 h-4 text-white" />
                                </motion.div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0 flex flex-col">
                              {/* Header Row: Title & Tags */}
                              <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-x-3 gap-y-1.5">
                                <h4
                                  className={`font-medium break-words text-sm leading-snug w-full sm:w-auto flex-1`}
                                >
                                  {task.title}
                                </h4>
                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                  {task.priority && (
                                    <span
                                      className={`text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-sm ${
                                        task.priority === "high"
                                          ? "bg-white/10 text-red-400"
                                          : task.priority === "medium"
                                            ? "bg-white/10 text-gray-300"
                                            : "bg-white/10 text-gray-300"
                                      }`}
                                    >
                                      {task.priority}
                                    </span>
                                  )}
                                  {task.dayOfWeek && (
                                    <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-sm bg-white/10 text-gray-300">
                                      {task.dayOfWeek}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Description */}
                              {!compactMode && (
                                <p
                                  className={`text-xs mt-1.5 leading-relaxed break-words ${task.completed ? "text-gray-500" : "text-gray-400"}`}
                                >
                                  {task.description}
                                </p>
                              )}

                              {/* Action Row */}
                              <div className={`flex items-center justify-between gap-3 mt-2 pt-2 border-t border-white/5`}>
                                {/* Left actions */}
                                <div className="flex items-center gap-2">
                                  {!task.completed && typeof task.timeLeft === "number" && !isNaN(task.timeLeft) && (
                                    <>
                                      <span className={`text-xs font-mono font-medium flex items-center gap-1.5 ${task.isActive ? 'text-green-400' : 'text-gray-300'}`}>
                                        <Timer className="w-3 h-3 opacity-70" />
                                        {formatTaskTime(task.timeLeft)}
                                      </span>
                                      
                                      <button
                                        onClick={(e) => task.isActive ? pauseTaskTimer(e, task.id) : startTaskTimer(e, task.id)}
                                        className={`w-7 h-7 ml-1 mb-0.5 rounded-full flex items-center justify-center transition-colors ${task.isActive ? "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300 border border-transparent"}`}
                                        title={task.isActive ? "Pause Timer" : "Start Timer"}
                                      >
                                        {task.isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                                      </button>

                                      {!task.isActive && task.timeLeft < (task.duration || 0) * 60 && (
                                        <button
                                          onClick={(e) => resetTaskTimer(e, task.id)}
                                          className={`w-7 h-7 mb-0.5 rounded-full flex items-center justify-center transition-colors bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300 border border-transparent`}
                                          title="Reset Timer"
                                        >
                                          <RotateCcw className="w-3 h-3" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Right actions */}
                                <div className="flex items-center gap-2.5">
                                  {!(
                                    !task.completed &&
                                    typeof task.timeLeft === "number" &&
                                    !isNaN(task.timeLeft)
                                  ) && (
                                    <div className="text-xs font-semibold text-gray-300">
                                      {task.duration}m
                                    </div>
                                  )}
                                  <div
                                    className={`text-[10px] font-bold ${
                                      task.color === "blue"
                                        ? "text-gray-400"
                                        : task.color === "purple"
                                          ? "text-gray-400"
                                          : "text-gray-300"
                                    }`}
                                  >
                                    +{task.xp}XP
                                  </div>
                                  
                                  <div className="flex items-center space-x-0.5 text-gray-500">
                                    {!task.completed && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (TIERS[userProfile.tier || "free"].level < TIERS.pro.level) {
                                            handleShowUpgrade("pro", "Smart Task Breakdown");
                                            return;
                                          }
                                          setDecomposingTask(task);
                                        }}
                                        className="p-1 hover:text-amber-400 text-gray-400 hover:bg-amber-400/10 transition-colors rounded-md group/btn"
                                        title="Smart Task Breakdown (Pro)"
                                      >
                                        <Zap className="w-3.5 h-3.5 group-hover/btn:fill-amber-400/20" />
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => toggleTaskImportant(e, task.id)}
                                      className={`p-1 hover:text-yellow-400 transition-colors rounded-md ${task.isImportant ? "text-yellow-400" : ""}`}
                                      title="Mark as Important"
                                    >
                                      <Star
                                        className={`w-3.5 h-3.5 ${task.isImportant ? "fill-current" : ""}`}
                                      />
                                    </button>
                                    <button
                                      onClick={(e) => shareTask(e, task)}
                                      className="p-1 hover:text-gray-300 transition-colors rounded-md"
                                      title="Share Activity"
                                    >
                                      <Share2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => deleteTask(e, task.id)}
                                      className="p-1 hover:text-red-400 transition-colors rounded-md"
                                      title="Delete Task"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                  </>
                    );
                  })()}
                </section>

                <FeatureGuard
                  userTier={userProfile.tier}
                  requiredTier="elite"
                  featureName="Daily AI Coach Insights"
                  onShowUpgrade={handleShowUpgrade}
                  fallback={
                    <GlassCard className="bg-white/5 border-white/10 relative overflow-hidden">
                      <div className="flex items-center space-x-2 mb-3 blur-sm select-none">
                        <Target className="w-4 h-4 text-gray-400" />
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                          Coach Recommendation
                        </h3>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed italic blur-sm select-none">
                        "Your daily tailored insight goes here. You need to upgrade..."
                      </p>
                    </GlassCard>
                  }
                >
                  {coachInsight && (
                    <GlassCard className="bg-white/5 border-white/10 relative overflow-hidden">
                      <div className="absolute top-0 right-0 px-2 py-1 bg-white/5 text-[8px] font-black uppercase tracking-tighter text-gray-400 rounded-bl-lg">
                        {xp > 5000
                          ? "Level: Elite"
                          : (history[history.length - 1] || 0) <
                              (history.reduce((a, b) => a + b, 0) / 7) * 0.5
                            ? "Status: Recovery"
                            : "Status: Optimized"}
                      </div>
                      <div className="flex items-center space-x-2 mb-3">
                        <Target className="w-4 h-4 text-gray-400" />
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                          Coach Recommendation
                        </h3>
                      </div>
                      <div className="text-sm text-gray-300 leading-relaxed italic markdown-body">
                        <Markdown>{`"${coachInsight}"`}</Markdown>
                      </div>
                    </GlassCard>
                  )}
                </FeatureGuard>

                {/* 6. QUICK ACTIONS */}
                <section className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setIsAddTaskOpen(true)}
                    className="glass-card py-4 flex flex-col items-center justify-center space-y-1 hover:border-white/30 transition-all group"
                  >
                    <Plus className="w-5 h-5 text-gray-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] uppercase font-bold tracking-tighter">
                      Add Task
                    </span>
                  </button>
                  <FeatureGuard
                    userTier={userProfile.tier}
                    requiredTier="pro"
                    featureName="Pomodoro Focus Tool"
                    onShowUpgrade={handleShowUpgrade}
                    fallback={
                      <div className="glass-card py-4 flex flex-col items-center justify-center space-y-1 group">
                        <Timer className="w-5 h-5 text-gray-400 opacity-50" />
                        <span className="text-[10px] uppercase font-bold tracking-tighter">
                          Pomodoro
                        </span>
                      </div>
                    }
                  >
                    <button
                      onClick={() => setIsPomodoroOpen(true)}
                      className="w-full glass-card py-4 flex flex-col items-center justify-center space-y-1 hover:border-purple-500 transition-all group"
                    >
                      <Timer className="w-5 h-5 text-gray-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] uppercase font-bold tracking-tighter">
                        Pomodoro
                      </span>
                    </button>
                  </FeatureGuard>
                  <button
                    onClick={() => setIsResetOpen(true)}
                    className="glass-card py-4 flex flex-col items-center justify-center space-y-1 hover:border-orange-500 transition-all group"
                  >
                    <Wind className="w-5 h-5 text-gray-300 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] uppercase font-bold tracking-tighter">
                      2m Reset
                    </span>
                  </button>
                </section>
              </div>

              {/* Right Column */}
              <div className="xl:col-span-4 flex flex-col space-y-6">
                <GlassCard>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-widest">
                      Momentum
                    </h3>
                    <span className="text-gray-300 font-bold flex items-center text-xs">
                      <Flame className="w-3 h-3 mr-1" /> {streak} Day Streak
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-1">
                    {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center space-y-2"
                      >
                        <span className="text-[10px] text-gray-500 font-bold">
                          {day}
                        </span>
                        <div
                          className={`streak-dot ${i < streak ? "gradient-bg shadow-[0_0_8px_rgba(249,115,22,0.4)]" : "bg-gray-800"}`}
                        />
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-4">
                    Weekly Intensity
                  </h3>
                  <div className="flex items-end justify-between h-32 space-x-1">
                    {history.map((val, i) => {
                      const h = Math.min((val / 1000) * 100, 100);
                      return (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(h, 5)}%` }}
                          className={`flex-1 rounded-t-sm ${val > 500 ? "bg-white shadow-md shadow-white/30" : val > 0 ? "bg-white/40" : "bg-gray-800"}`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center">
                    <span className="text-xs text-gray-400">Avg. XP / Day</span>
                    <span className="text-sm font-bold text-gray-400">
                      {Math.round(history.reduce((a, b) => a + b, 0) / 7)}
                    </span>
                  </div>
                </GlassCard>

                <GlassCard
                  onClick={() => setCurrentView("path")}
                  className="border-white/10 cursor-pointer hover:border-white/30 transition-colors"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide">
                      Path Preview
                    </h3>
                    <MapIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    {roadmap?.weeks.slice(0, 2).map((w, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <div
                          className={`w-2 h-2 rounded-full ${i === 0 ? "bg-white" : "bg-gray-800"}`}
                        />
                        <span
                          className={`text-[10px] font-bold ${i === 0 ? "text-gray-300" : "text-gray-600"}`}
                        >
                          {w.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className=" border-[#FFDE00]/10 cursor-pointer hover:scale-[1.02] transition-transform">
                  <h3 className="text-sm font-bold text-[#FFDE00] mb-2 uppercase tracking-wide">
                    2m Reset
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed mb-4">
                    Clear your mind and regain focus.
                  </p>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#DFAD00] w-1/3" />
                  </div>
                </GlassCard>

                {/* UPGRADE TIER CARD */}
                {TIERS[userProfile.tier || "free"].level < TIERS["elite"].level && (
                  <GlassCard className="bg-white/10 border-white/20 p-5 mt-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-white mb-1">
                          Upgrade Tier
                        </h3>
                        <p className="text-[10px] text-gray-400">
                          Unlock more features!
                        </p>
                      </div>
                      <Crown className="w-5 h-5 text-gray-400" />
                    </div>
                    
                    <div className="space-y-3">
                       {TIERS[userProfile.tier || "free"].level < TIERS["pro"].level && (
                         <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2">
                           <div className="flex justify-between items-center text-xs">
                             <span className="font-bold text-yellow-500">PRO TIER</span>
                             <span className="text-gray-400">$10/mo</span>
                           </div>
                           <button
                             onClick={() => handleShowUpgrade("pro", "Pro Features")}
                             className="w-full py-2 bg-yellow-500 text-black rounded-lg text-xs font-black uppercase tracking-widest hover:bg-yellow-400 transition-colors flex items-center justify-center shadow-lg shadow-yellow-500/20"
                           >
                             <Zap className="w-3 h-3 mr-2" /> Upgrade to Pro
                           </button>
                         </div>
                       )}
                       <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-2 relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/20 blur-xl rounded-full" />
                         <div className="flex justify-between items-center text-xs relative z-10">
                           <span className="font-bold text-orange-500">ELITE TIER</span>
                           <span className="text-orange-400/80">$30/mo</span>
                         </div>
                         <button
                           onClick={() => handleShowUpgrade("elite", "Elite Features")}
                           className="w-full py-2 bg-gradient-to-r from-orange-600 to-orange-400 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:from-orange-500 hover:to-orange-300 transition-colors flex items-center justify-center shadow-lg shadow-orange-500/20 relative z-10"
                         >
                           <Crown className="w-3 h-3 mr-2" /> Upgrade to Elite
                         </button>
                       </div>
                    </div>
                  </GlassCard>
                )}
              </div>
            </div>
          )}

          {currentView === "path" && roadmap && (
            <PathView 
              roadmap={roadmap} 
              tasks={tasks} 
              setRoadmap={setRoadmap} 
              setTasks={setTasks} 
              userTier={userProfile.tier}
              onShowUpgrade={handleShowUpgrade}
            />
          )}
          {currentView === "journal" && (
            <JournalView 
              userId={user?.uid} 
              userTier={userProfile.tier} 
              onShowUpgrade={handleShowUpgrade} 
            />
          )}
          {currentView === "calendar" && (
            <CalendarView
              tasks={tasks.filter(t => {
                if (t.weekIndex === undefined) return true;
                const start = new Date(userProfile.startDate || new Date());
                const now = new Date();
                const diffDays = Math.floor(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                const currentWeek = Math.max(0, Math.min(3, Math.floor(diffDays / 7)));
                return t.weekIndex === currentWeek;
              })}
              onToggleTask={toggleTask}
              onDeleteTask={deleteTask}
              onShareTask={shareTask}
              onToggleImportant={toggleTaskImportant}
              startDate={userProfile.startDate}
              onOpenAddTask={(day) => {
                setAddTaskDefaultDay(day);
                setIsAddTaskOpen(true);
              }}
            />
          )}
          {currentView === "leaderboard" && (
            <FeatureGuard
              userTier={userProfile.tier}
              requiredTier="elite"
              featureName="Elite Leaderboard"
              onShowUpgrade={handleShowUpgrade}
            >
              <LeaderboardView
                xp={xp}
                userName={userProfile.name}
                userId={user?.uid}
                userAvatarUrl={userProfile.avatarUrl}
                user={user}
              />
            </FeatureGuard>
          )}
          {currentView === "profile" && (
            <ProfileView
              userId={user?.uid}
              xp={xp}
              streak={streak}
              tasksCount={tasks.filter((t) => t.completed).length}
              userProfile={userProfile}
              setUserProfile={setUserProfile}
            />
          )}
          {currentView === "settings" && (
            <SettingsView
              onReset={handleReset}
              goal={roadmap?.goal || ""}
              onUpdateGoal={handleUpdateGoal}
              onRegenerate={handleRegenerate}
              notificationsEnabled={notificationsEnabled}
              onToggleNotifications={handleToggleNotifications}
              onTestNotification={handleTestNotification}
              themeColor={themeColor}
              setThemeColor={setThemeColor}
              workDuration={workDuration}
              setWorkDuration={setWorkDuration}
              compactMode={compactMode}
              setCompactMode={setCompactMode}
              onLogout={handleLogout}
              onDeleteAccount={handleDeleteAccount}
            />
          )}
        </div>
      </main>

      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white px-8 py-4 rounded-3xl shadow-2xl shadow-white/10 flex flex-col items-center">
              <Trophy className="w-12 h-12 text-white mb-2" />
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                Level Up!
              </h2>
              <p className="text-gray-200 font-bold">
                You are now Level {Math.floor(xp / 1000) + 1}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 9. BOTTOM NAVIGATION MOBILE */}
      {currentView !== "onboarding" && (
        <footer className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 pointer-events-none z-50">
          <nav className="glass-card h-16 px-8 flex items-center justify-between mx-auto w-full pointer-events-auto shadow-2xl shadow-black backdrop-blur-xl bg-black/60">
            <button
              onClick={() => setCurrentView("home")}
              className={`flex flex-col items-center space-y-1 transition-colors ${currentView === "home" ? "text-gray-400" : "text-gray-500 hover:text-gray-300"}`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-tight">
                Home
              </span>
            </button>
            <button
              onClick={() => setCurrentView("path")}
              className={`flex flex-col items-center space-y-1 transition-colors ${currentView === "path" ? "text-gray-400" : "text-gray-500 hover:text-gray-300"}`}
            >
              <MapIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-tight">
                Path
              </span>
            </button>
            <button
              onClick={() => setCurrentView("journal")}
              className={`flex flex-col items-center space-y-1 transition-colors ${currentView === "journal" ? "text-gray-400" : "text-gray-500 hover:text-gray-300"}`}
            >
              <Book className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-tight">
                Log
              </span>
            </button>
            <button
              onClick={() => setCurrentView("calendar")}
              className={`flex flex-col items-center space-y-1 transition-colors ${currentView === "calendar" ? "text-gray-400" : "text-gray-500 hover:text-gray-300"}`}
            >
              <Calendar className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-tight">
                Cal
              </span>
            </button>
            <button
              onClick={() => setCurrentView("leaderboard")}
              className={`flex flex-col items-center space-y-1 transition-colors ${currentView === "leaderboard" ? "text-gray-400" : "text-gray-500 hover:text-gray-300"}`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-tight">
                Stand
              </span>
            </button>
            <button
              onClick={() => setCurrentView("profile")}
              className={`flex flex-col items-center space-y-1 transition-colors ${currentView === "profile" ? "text-gray-400" : "text-gray-500 hover:text-gray-300"}`}
            >
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt="Avatar"
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <User className="w-5 h-5" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-tight">
                Profile
              </span>
            </button>
          </nav>
        </footer>
      )}

      {/* Modals */}
      <Modal
        isOpen={isAddTaskOpen}
        onClose={() => {
          setIsAddTaskOpen(false);
          setAddTaskDefaultDay(undefined);
        }}
        title="Add Focus Task"
      >
        <AddTaskForm
          key={isAddTaskOpen ? "open" : "closed"}
          roadmap={roadmap}
          defaultDay={addTaskDefaultDay}
          onAdd={(t) => {
            setTasks((prev) => [t, ...prev]);
            setIsAddTaskOpen(false);
            setAddTaskDefaultDay(undefined);
          }}
        />
      </Modal>
      <Modal
        isOpen={isPomodoroOpen}
        onClose={() => setIsPomodoroOpen(false)}
        title="Pomodoro Focus"
      >
        <PomodoroTimer
          workDuration={workDuration}
          onComplete={() => {
            setXp((p) => p + 50);
            audio.playTaskComplete();
            triggerConfetti();
            setIsPomodoroOpen(false);
          }}
        />
      </Modal>
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title="2 Minute Reset"
      >
        <ResetExercise
          onComplete={() => {
            setXp((p) => p + 100);
            audio.playTaskComplete();
            triggerConfetti();
            setIsResetOpen(false);
          }}
        />
      </Modal>

      {/* Floating AI Chat */}
      {currentView !== "onboarding" && (
        <div className="fixed bottom-24 md:bottom-6 right-4 md:right-8 z-[90] flex flex-col items-end">
          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="w-80 h-[400px] mb-4 glass-card border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gray-900/50">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-5 h-5 text-gray-400" />
                    <span className="font-bold text-sm">AI Coach</span>
                  </div>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col hide-scrollbar">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex max-w-[85%] ${msg.role === "user" ? "self-end bg-white text-black rounded-l-xl rounded-tr-xl" : "self-start bg-white/5 text-gray-200 rounded-r-xl rounded-tl-xl"} p-3 text-sm border border-white/5`}
                    >
                      <div className="markdown-body">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    </div>
                  ))}
                  {isChatting && (
                    <div className="self-start bg-white/5 text-gray-200 rounded-r-xl rounded-tl-xl p-3 text-sm border border-white/5 flex items-center space-x-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  )}
                </div>
                <div className="p-3 border-t border-white/10 bg-gray-900/50">
                  <div className="flex items-center bg-gray-900 border border-white/10 rounded-xl overflow-hidden px-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleChat()}
                      placeholder="Ask your coach..."
                      className="flex-1 bg-transparent py-3 px-2 outline-none text-sm"
                    />
                    <button
                      onClick={handleChat}
                      disabled={!chatInput.trim() || isChatting}
                      className="p-2 text-gray-400 hover:text-gray-300 disabled:opacity-50 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => {
              if (!isChatOpen && TIERS[userProfile.tier || "free"].level < TIERS["elite"].level) {
                handleShowUpgrade("elite", "AI Coach Chat");
              } else {
                setIsChatOpen(!isChatOpen);
              }
            }}
            className="w-14 h-14 bg-white rounded-full shadow-lg shadow-white/10 flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 transition-all text-white border-2 border-white/10"
          >
            {isChatOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <MessageSquare className="w-6 h-6" />
            )}
          </button>
        </div>
      )}
    </div>
    </>
  );
}
