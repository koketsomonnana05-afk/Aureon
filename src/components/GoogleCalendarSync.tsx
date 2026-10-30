import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Clock,
  Trash2,
  ExternalLink,
  RefreshCw,
  Loader2,
  CalendarCheck,
  CalendarPlus,
  AlertCircle,
  X,
  Check,
} from "lucide-react";
import {
  GoogleCalendarEvent,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getCalendarAccessToken,
  insertCalendarEvent,
  deleteCalendarEvent,
} from "../googleCalendar";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  dayOfWeek?: string;
  completed?: boolean;
}

export interface DayInfo {
  name: string;
  dateStr: string;
  isToday: boolean;
  date: Date;
}

interface GoogleCalendarSyncProps {
  weekDays: DayInfo[];
  tasks: TaskItem[];
  events: GoogleCalendarEvent[];
  isConnected: boolean;
  isLoading: boolean;
  onRefreshEvents: () => Promise<void>;
  onConnectionChange: (connected: boolean) => void;
  onEventCreated?: (newEvent: GoogleCalendarEvent) => void;
  onEventDeleted?: (eventId: string) => void;
}

export const GoogleCalendarBanner = ({
  isConnected,
  isLoading,
  onConnect,
  onDisconnect,
  onRefresh,
  onOpenBatchSync,
}: {
  isConnected: boolean;
  isLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onOpenBatchSync: () => void;
}) => {
  return (
    <div className="rounded-2xl p-5 border border-white/10 bg-white/[0.03] backdrop-blur-md relative overflow-hidden mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-lg text-white">Google Calendar Sync</h3>
              {isConnected ? (
                <span className="flex items-center space-x-1.5 text-[11px] font-semibold tracking-wider uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Connected</span>
                </span>
              ) : (
                <span className="text-[11px] font-semibold tracking-wider uppercase text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-gray-400 text-xs sm:text-sm mt-1 max-w-xl">
              {isConnected
                ? "Your weekly schedule and Aureon tasks are connected to your Google Calendar. Add tasks as time blocks or review your upcoming events."
                : "Connect your Google Calendar to see your external events alongside your weekly tasks and schedule work sessions directly onto your calendar."}
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 shrink-0 self-start md:self-center">
          {isConnected ? (
            <>
              <button
                onClick={onOpenBatchSync}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
                title="Sync this week's tasks to your Google Calendar"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>Sync Week</span>
              </button>
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                title="Refresh calendar events"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-400" : ""}`} />
              </button>
              <button
                onClick={onDisconnect}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-white/10 text-gray-400 text-xs font-medium transition-colors"
                title="Disconnect Google Calendar"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={onConnect}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl bg-white text-black hover:bg-gray-200 text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-2 shadow-lg hover:shadow-white/10 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span>Connect Google Calendar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const GoogleEventCard = ({
  event,
  onDeleteRequest,
}: {
  event: GoogleCalendarEvent;
  onDeleteRequest: (event: GoogleCalendarEvent) => void;
}) => {
  const formatTime = (isoString?: string) => {
    if (!isoString) return "All Day";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "All Day";
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const startTime = formatTime(event.start.dateTime);
  const endTime = event.end.dateTime ? formatTime(event.end.dateTime) : "";

  return (
    <div className="flex items-start justify-between p-2.5 rounded-xl bg-blue-950/20 border border-blue-500/20 hover:border-blue-500/40 transition-colors group text-xs">
      <div className="flex items-start space-x-2.5 overflow-hidden flex-1 pr-2">
        <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-blue-200 truncate">{event.summary || "(No Title)"}</p>
          <div className="flex items-center space-x-1.5 text-blue-400/80 text-[11px] mt-0.5">
            <Clock className="w-3 h-3" />
            <span>
              {startTime}
              {endTime && ` - ${endTime}`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-blue-400/70 hover:text-blue-300 rounded hover:bg-blue-500/10"
            title="Open in Google Calendar"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <button
          onClick={() => onDeleteRequest(event)}
          className="p-1 text-gray-500 hover:text-red-400 rounded hover:bg-red-500/10"
          title="Delete from Google Calendar"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

// Mandatory User Confirmation Modal for Adding a Task to Google Calendar
export const ScheduleTaskConfirmationModal = ({
  isOpen,
  task,
  targetDate,
  onClose,
  onConfirm,
  isScheduling,
}: {
  isOpen: boolean;
  task: TaskItem | null;
  targetDate: Date | null;
  onClose: () => void;
  onConfirm: (startTime: string) => Promise<void>;
  isScheduling: boolean;
}) => {
  const [selectedTime, setSelectedTime] = useState("09:00");

  if (!isOpen || !task || !targetDate) return null;

  const formattedDate = targetDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const durationMin = Number(task.duration) || 30;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="glass-card w-full max-w-md p-6 relative z-10 border-white/10 shadow-2xl"
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <CalendarPlus className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-white">Add to Google Calendar</h2>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4 text-sm text-gray-300">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
              <p className="text-xs uppercase font-bold tracking-wider text-gray-400">Task Summary</p>
              <p className="font-semibold text-white text-base">{task.title}</p>
              {task.description && (
                <p className="text-xs text-gray-400 line-clamp-2">{task.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[11px] uppercase font-bold tracking-wider text-gray-400 mb-1">Date</p>
                <p className="font-semibold text-white text-xs">{formattedDate}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[11px] uppercase font-bold tracking-wider text-gray-400 mb-1">Duration</p>
                <p className="font-semibold text-white text-xs">{durationMin} minutes</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
              <span>
                This will create a new scheduled event on your primary Google Calendar. You can edit or remove it at any time.
              </span>
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              onClick={onClose}
              disabled={isScheduling}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(selectedTime)}
              disabled={isScheduling}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5 shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              {isScheduling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirm & Schedule</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// Mandatory User Confirmation Modal for Destructive Workspace Operations (Deleting an Event)
export const DeleteEventConfirmationModal = ({
  isOpen,
  event,
  onClose,
  onConfirm,
  isDeleting,
}: {
  isOpen: boolean;
  event: GoogleCalendarEvent | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}) => {
  if (!isOpen || !event) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="glass-card w-full max-w-md p-6 relative z-10 border-red-500/20 shadow-2xl"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Delete Calendar Event?</h2>
              <p className="text-xs text-gray-400">Confirmation required</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-gray-300">
            <p>
              Are you sure you want to permanently delete{" "}
              <strong className="text-white">"{event.summary || "Untitled Event"}"</strong> from your primary Google Calendar?
            </p>
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              This action cannot be undone. The event will be removed from your Google Calendar.
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5 shadow-lg shadow-red-600/30 disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Event</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// Mandatory User Confirmation Modal for Batch Syncing Week Tasks to Google Calendar
export const BatchSyncConfirmationModal = ({
  isOpen,
  tasksToSync,
  weekDays,
  onClose,
  onConfirm,
  isSyncing,
}: {
  isOpen: boolean;
  tasksToSync: { task: TaskItem; date: Date }[];
  weekDays: DayInfo[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isSyncing: boolean;
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="glass-card w-full max-w-lg p-6 relative z-10 border-white/10 shadow-2xl max-h-[90vh] flex flex-col"
        >
          <div className="flex justify-between items-center mb-4 shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-white">Sync Week to Google Calendar</h2>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-sm text-gray-300">
            <p className="text-xs text-gray-400">
              Review the <strong className="text-white">{tasksToSync.length}</strong> tasks to be scheduled on your Google Calendar for this week. Each task will be added as a dedicated focus block starting at 09:00 AM on its designated day.
            </p>

            {tasksToSync.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center text-gray-400 text-xs italic">
                No active tasks with assigned days found for this week.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {tasksToSync.map(({ task, date }, idx) => (
                  <div
                    key={task.id || idx}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="font-semibold text-white truncate">{task.title}</p>
                      <p className="text-[11px] text-gray-400">
                        {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} • {task.duration || 30} mins
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full shrink-0">
                      09:00 AM
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start space-x-2 shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
              <span>
                Google Calendar events will be created. Your existing calendar appointments will remain completely untouched.
              </span>
            </div>
          </div>

          <div className="flex space-x-3 mt-6 shrink-0">
            <button
              onClick={onClose}
              disabled={isSyncing}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isSyncing || tasksToSync.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5 shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Syncing Tasks...</span>
                </>
              ) : (
                <>
                  <CalendarCheck className="w-4 h-4" />
                  <span>Confirm Sync ({tasksToSync.length})</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
