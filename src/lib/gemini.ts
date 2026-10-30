export async function getGoalSuggestions(): Promise<string[]> {
  try {
    const res = await fetch("/api/ai/getGoalSuggestions", { method: "POST" });
    const data = await res.json();
    if (data.result) return data.result.split(",").map((s: string) => s.trim());
    return ["Launch a SaaS", "Run a Marathon", "Learn TypeScript", "Master Chess"];
  } catch (err) {
    return ["Launch a SaaS", "Run a Marathon", "Learn TypeScript", "Master Chess"];
  }
}

export interface TaskSource {
  title: string;
  url?: string;
  type?: "documentation" | "book" | "course" | "tool" | "article" | "community" | "video";
  description?: string;
}

export interface Roadmap {
  goal: string;
  weeks: {
    title: string;
    description: string;
    tasks: {
      title: string;
      description: string;
      xp: number;
      duration: number;
      dayOfWeek?: string;
      priority?: "low" | "medium" | "high";
      isImportant?: boolean;
      sources?: TaskSource[];
    }[];
  }[];
}

export async function generateRoadmap(goal: string, name?: string, age?: string): Promise<Roadmap> {
  try {
    const res = await fetch("/api/ai/generateRoadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, name, age }),
    });
    const data = await res.json();
    if (res.ok && data.weeks) return data as Roadmap;
    throw new Error(data.error || `Invalid response: ${JSON.stringify(data)}`);
  } catch (error: any) {
    console.error("Error generating roadmap:", error.message || error);
    return {
      goal,
      weeks: [
        {
          title: "Week 1: Initial Execution & Foundation",
          description: `Kickstart your progress on: ${goal}.`,
          tasks: [
            {
              title: "Define Requirements & Setup",
              description: `Identify strictly what is needed to achieve ${goal}.`,
              xp: 20,
              duration: 25,
              dayOfWeek: "Monday",
              priority: "high",
              isImportant: true,
              sources: [
                {
                  title: `${goal} Getting Started Guide`,
                  url: `https://www.google.com/search?q=${encodeURIComponent(goal + " getting started official documentation guide")}`,
                  type: "documentation",
                  description: "Comprehensive step-by-step setup overview and best practices."
                },
                {
                  title: "Deep Work (Cal Newport)",
                  url: "https://www.google.com/search?q=Deep+Work+Cal+Newport+summary",
                  type: "book",
                  description: "Rules for focused success in a distracted world."
                }
              ]
            },
            {
              title: "First Tangible Action Sprint",
              description: `Execute the first tangible step directly related to ${goal}.`,
              xp: 30,
              duration: 45,
              dayOfWeek: "Wednesday",
              priority: "medium",
              isImportant: false,
              sources: [
                {
                  title: "Atomic Habits Ch. 1: Fundamentals",
                  url: "https://jamesclear.com/atomic-habits",
                  type: "book",
                  description: "How small daily habits compound into massive long-term results."
                },
                {
                  title: `${goal} Core Practice Exercises`,
                  url: `https://www.google.com/search?q=${encodeURIComponent(goal + " beginner tutorial practical exercises")}`,
                  type: "course",
                  description: "Interactive exercises to build early muscle memory."
                }
              ]
            },
            {
              title: "Review & Quality Calibration",
              description: `Review your output for ${goal} and commit to the process.`,
              xp: 20,
              duration: 15,
              dayOfWeek: "Friday",
              priority: "low",
              isImportant: false,
              sources: [
                {
                  title: "The Checklist Manifesto",
                  url: "https://www.google.com/search?q=The+Checklist+Manifesto+Atul+Gawande",
                  type: "book",
                  description: "How to get things right and prevent unforced errors."
                }
              ]
            }
          ]
        },
        {
          title: "Week 2: Deep Work & Consistency",
          description: `Build momentum towards ${goal}.`,
          tasks: [
            {
              title: "Expand Scope & Core Drills",
              description: `Take the next significant step for ${goal}.`,
              xp: 25,
              duration: 45,
              dayOfWeek: "Monday",
              priority: "high",
              isImportant: true,
              sources: [
                {
                  title: `${goal} Intermediate Reference`,
                  url: `https://www.google.com/search?q=${encodeURIComponent(goal + " best practices reference")}`,
                  type: "documentation",
                  description: "Official reference material and patterns for clean execution."
                }
              ]
            },
            {
              title: "Iterate & Optimize Workflow",
              description: `Refine your work based on initial results.`,
              xp: 20,
              duration: 30,
              dayOfWeek: "Wednesday",
              priority: "medium",
              isImportant: false,
              sources: [
                {
                  title: "Principles by Ray Dalio",
                  url: "https://www.principles.com",
                  type: "book",
                  description: "Radical open-mindedness and systematic problem solving."
                }
              ]
            },
            {
              title: "Milestone Audit & Adjustments",
              description: `Assess if you are on track for week 2 goals.`,
              xp: 15,
              duration: 20,
              dayOfWeek: "Friday",
              priority: "low",
              isImportant: false,
              sources: [
                {
                  title: "Feynman Technique for Mastery",
                  url: "https://www.google.com/search?q=Feynman+technique+mental+model",
                  type: "article",
                  description: "Explain concepts simply to reveal gaps in your knowledge."
                }
              ]
            }
          ]
        },
        {
          title: "Week 3: Advanced Execution",
          description: `Tackle complex challenges for ${goal}.`,
          tasks: [
            {
              title: "Address Key Bottlenecks",
              description: `Solve the hardest problem currently blocking ${goal}.`,
              xp: 40,
              duration: 60,
              dayOfWeek: "Monday",
              priority: "high",
              isImportant: true,
              sources: [
                {
                  title: "High Output Management (Andy Grove)",
                  url: "https://www.google.com/search?q=High+Output+Management+Andy+Grove",
                  type: "book",
                  description: "Leverage and bottleneck elimination frameworks."
                }
              ]
            },
            {
              title: "Accelerate Velocity Sprint",
              description: `Put in focused effort to speed up delivery.`,
              xp: 30,
              duration: 50,
              dayOfWeek: "Wednesday",
              priority: "medium",
              isImportant: false,
              sources: [
                {
                  title: `${goal} Advanced Playbook`,
                  url: `https://www.google.com/search?q=${encodeURIComponent(goal + " advanced guide techniques")}`,
                  type: "tool",
                  description: "Advanced tooling and acceleration blueprints."
                }
              ]
            },
            {
              title: "External Feedback & Refinement",
              description: `Get input from someone else on your ${goal} progress.`,
              xp: 20,
              duration: 20,
              dayOfWeek: "Friday",
              priority: "low",
              isImportant: false,
              sources: [
                {
                  title: "Thanks for the Feedback (Stone & Heen)",
                  url: "https://www.google.com/search?q=Thanks+for+the+Feedback+Douglas+Stone",
                  type: "book",
                  description: "The science and art of receiving feedback well."
                }
              ]
            }
          ]
        },
        {
          title: "Week 4: Mastery & Finalization",
          description: `Complete the initial phase of ${goal}.`,
          tasks: [
            {
              title: "Final Polish & Verification",
              description: `Ensure all deliverables for ${goal} are high quality.`,
              xp: 35,
              duration: 50,
              dayOfWeek: "Monday",
              priority: "high",
              isImportant: true,
              sources: [
                {
                  title: `${goal} Production Quality Standards`,
                  url: `https://www.google.com/search?q=${encodeURIComponent(goal + " verification checklist")}`,
                  type: "article",
                  description: "Excellence standards and finishing checklist."
                }
              ]
            },
            {
              title: "Launch, Deploy or Publish",
              description: `Put your work out there or finalize the objective.`,
              xp: 50,
              duration: 30,
              dayOfWeek: "Wednesday",
              priority: "high",
              isImportant: true,
              sources: [
                {
                  title: "Show Your Work! (Austin Kleon)",
                  url: "https://austinkleon.com/show-your-work/",
                  type: "book",
                  description: "10 ways to share your creativity and get discovered."
                }
              ]
            },
            {
              title: "Strategic Retrospective",
              description: `Reflect on what went well and what didn't for next time.`,
              xp: 20,
              duration: 30,
              dayOfWeek: "Friday",
              priority: "medium",
              isImportant: false,
              sources: [
                {
                  title: "After-Action Review Guidelines",
                  url: "https://www.google.com/search?q=After+Action+Review+framework",
                  type: "article",
                  description: "Military debrief system to lock in hard-earned insights."
                }
              ]
            }
          ]
        }
      ]
    } as Roadmap;
  }
}

export async function refineRoadmap(roadmap: Roadmap, message: string): Promise<Roadmap> {
  try {
    const res = await fetch("/api/ai/refineRoadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roadmap, message }),
    });
    const data = await res.json();
    if (res.ok && data.weeks) return data as Roadmap;
    throw new Error(data.error || `Invalid response: ${JSON.stringify(data)}`);
  } catch (error: any) {
    console.error("Error refining roadmap:", error.message || error);
    throw error;
  }
}

export async function getSmartTaskSuggestion(
  taskTitle: string,
  goal: string
): Promise<{
  description: string;
  xp: number;
  duration: number;
  priority?: "low" | "medium" | "high";
  sources?: TaskSource[];
}> {
  try {
    const res = await fetch("/api/ai/getSmartTaskSuggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskTitle, goal }),
    });
    const data = await res.json();
    if (res.ok && data.description) return data;
    throw new Error(data.error || "Invalid response");
  } catch (err) {
    return {
      description: "Complete this specific action block without any distractions.",
      xp: 10,
      duration: 15,
      priority: "medium",
      sources: [
        {
          title: `${taskTitle} Guide & Reference`,
          url: `https://www.google.com/search?q=${encodeURIComponent(taskTitle + " " + goal + " tutorial documentation")}`,
          type: "documentation",
          description: "Curated learning guide, documentation, and reference materials."
        }
      ]
    };
  }
}

export async function analyzeJournal(content: string): Promise<string> {
  try {
    const res = await fetch("/api/ai/analyzeJournal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (res.ok && data.result) return data.result;
    throw new Error(data.error || "Invalid response");
  } catch (err) {
    return "Keep logging your journey.";
  }
}

export async function getDailyInsight(goal: string, xp: number, streak: number): Promise<string> {
  try {
    const res = await fetch("/api/ai/getDailyInsight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, xp, streak }),
    });
    const data = await res.json();
    if (res.ok && data.result) return data.result;
    throw new Error(data.error || "Invalid response");
  } catch (err) {
    return "The discipline you build today is the freedom you enjoy tomorrow.";
  }
}

export async function chatWithCoach(message: string, goal: string, history: { role: string, parts?: { text: string }[], text?: string }[] = []): Promise<string> {
  try {
    const res = await fetch("/api/ai/chatWithCoach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, goal, history }),
    });
    if (res.status === 429) {
      return "I've hit my API limits right now. Please try again later when my quota resets.";
    }
    const data = await res.json();
    if (res.ok && data.result) return data.result;
    throw new Error(data.error || "Invalid response");
  } catch (err) {
    console.error("Chat error:", err);
    return "I'm currently recalibrating. Focus on your immediate tasks.";
  }
}

export async function getCoachRecommendation(goal: string, tasks: any[], streak: number, level: number, history: number[]): Promise<string> {
  try {
    const res = await fetch("/api/ai/getCoachRecommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, tasks, streak, level, history }),
    });
    const data = await res.json();
    if (res.ok && data.result) return data.result;
    throw new Error(data.error || "Invalid response");
  } catch (err) {
    return "Strategic optimization is the only path to the top. Keep pushing.";
  }
}

