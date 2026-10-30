import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import http from "http";
import { GoogleGenAI, Type, Schema } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  const server = http.createServer(app);

  app.use(express.json());

  const handleAiError = (res: any, err: any) => {
    if (err.message && (err.message.includes("API key not valid") || err.message.includes("API_KEY_INVALID"))) {
      res.status(401).json({ error: "The provided GEMINI_API_KEY is invalid. Please update it in the Settings menu." });
    } else if (err.status === 429 || (err.message && (err.message.includes("429") || err.message.toLowerCase().includes("quota") || err.message.includes("RESOURCE_EXHAUSTED")))) {
      res.status(429).json({ error: "You exceeded your current AI quota with Gemini. Upgrading to a paid tier increases your quota. You can select a billing-enabled API key in the Settings > Secrets panel." });
    } else if (err.status === 503 || (err.message && (err.message.includes("503") || err.message.toLowerCase().includes("high demand") || err.message.toLowerCase().includes("unavailable")))) {
      res.status(503).json({ error: "The AI model is currently experiencing high demand. Please try again in a few moments." });
    } else {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  };


  const getGemini = () => {
    const key = process.env.GEMINI_API_KEY?.replace(/['"]/g, '').trim();
    console.log("GEMINI KEY:", typeof key, key ? key.length : 0);
    if (!key || key === 'undefined' || key === 'null') {
      throw new Error("GEMINI_API_KEY is not configured in the environment variables.");
    }
    return new GoogleGenAI({ apiKey: key });
  };

  app.post("/api/ai/getGoalSuggestions", async (req, res) => {
    try {
      const ai = getGemini();
      const prompt = "Generate 4 diverse, high-impact life goals for a high-performer. Keep them very short (max 3 words). Return ONLY a comma-separated list.";
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      res.json({ result: response.text?.trim() });
    } catch (err: any) { handleAiError(res, err); }
  });

  // API Route: AI generateRoadmap
  app.post("/api/ai/generateRoadmap", async (req, res) => {
    try {
      const ai = getGemini();
      const { goal, name, age } = req.body;
      const userContext = name ? `The user is named ${name}${age ? ` and is ${age} years old` : ""}. ` : "";
      
      const prompt = `
You are Aureon AI, an intelligent performance and self-improvement strategist.

Your task is to generate a structured roadmap for a user goal.

The roadmap must transform a large goal into:
- clear weekly phases
- actionable daily tasks
- realistic progression
- measurable momentum

The system should prioritize:
- consistency
- sustainability
- discipline
- progressive improvement
NOT extreme intensity or unrealistic expectations.

----------------------------------
USER INPUT:
Goal: "${goal}"
User Details: ${name ? name : "A user"}${age ? `, ${age} years old` : ""}
----------------------------------
ROADMAP REQUIREMENTS:

1. Generate a roadmap for exactly 4 weeks. (The system requires exactly 4 weeks).
2. Each week must include:
- week number in the title
- focus title
- short explanation (description)
- exactly 5 actionable tasks per week (assign a distinct dayOfWeek from Monday to Friday).

3. Tasks must:
- be specific
- measurable
- beginner-friendly when necessary
- realistically achievable
- focused on momentum building

4. Tasks should gradually increase in difficulty.

5. Include:
- research tasks
- practical action
- repetition
- reflection
- performance improvement

6. Assign XP values to each task based on difficulty:
- Easy: 10–20 XP
- Medium: 25–40 XP
- Hard: 50+ XP

7. SOURCES & MATERIALS (CRITICAL REQUIREMENT):
For EVERY task, you must provide 1 to 3 reputable, specific study materials, official docs, books, courses, or trusted tool references where the user can find the material needed to complete the task.

----------------------------------
IMPORTANT BEHAVIOR RULES:
1. Do NOT generate vague advice. (Bad: "Work harder", "Stay motivated"). Generate highly detailed, practical actions.
2. If the user's goal involves physical fitness, recommend specific exercises (e.g., planks, push-ups) in order of priority and effectiveness. Adapt this logic to all types of goals—always provide the exact 'what' and 'how'.
3. Keep tasks small enough to encourage consistency. 
4. The roadmap should feel intelligent, structured, disciplined, achievable, and motivating.
5. Avoid burnout-focused planning.
6. Build identity reinforcement subtly through wording.

----------------------------------
OUTPUT STYLE:
The tone should feel:
- premium
- strategic
- calm
- disciplined
- emotionally intelligent
Avoid: cheesy motivation, excessive hype, childish gamification language.

----------------------------------
FINAL OUTPUT FORMAT:

Return the response as a clean JSON object with this exact structure:
{
  "goal": "string (the exact goal or a refined, clearer version of it)",
  "weeks": [
    {
      "title": "string (e.g., 'Week 1: Foundation and Research')",
      "description": "string (A strategic explanation of the week's focus)",
      "tasks": [
        {
          "title": "string (max 5-7 words, powerful action-oriented)",
          "description": "string (Extremely detailed and highly specific. Give exact steps, commands, or subjects in order of priority and effectiveness. Max 35 words.)",
          "xp": number (see rules above),
          "duration": number (minutes, range 15-120),
          "dayOfWeek": "string ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday' - assign distinct days)",
          "priority": "string ('low', 'medium', 'high')",
          "isImportant": boolean (true if it's the most critical task of the week, max 2 per week),
          "sources": [
            {
              "title": "string (Specific resource name, e.g. 'MDN Web Docs: CSS Grid Guide' or 'Atomic Habits Ch. 1')",
              "url": "string (e.g. 'https://developer.mozilla.org' or search link)",
              "type": "string ('documentation' | 'book' | 'course' | 'tool' | 'article')",
              "description": "string (1-sentence guidance on how to use this material)"
            }
          ]
        }
      ]
    }
  ]
}

ONLY return the JSON object, NO markdown.
      `;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: {
          type: Type.OBJECT,
          properties: {
            goal: { type: Type.STRING },
            weeks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  tasks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        xp: { type: Type.NUMBER },
                        duration: { type: Type.NUMBER },
                        dayOfWeek: { type: Type.STRING },
                        priority: { type: Type.STRING },
                        isImportant: { type: Type.BOOLEAN },
                        sources: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              title: { type: Type.STRING },
                              url: { type: Type.STRING },
                              type: { type: Type.STRING },
                              description: { type: Type.STRING },
                            },
                            required: ["title", "type", "description"]
                          }
                        }
                      },
                      required: ["title", "description", "xp", "duration", "dayOfWeek", "priority", "isImportant"]
                    }
                  }
                },
                required: ["title", "description", "tasks"]
              }
            }
          },
          required: ["goal", "weeks"]
        }}
      });
      let text = response.text || "{}";
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        text = text.substring(startIdx, endIdx + 1);
      }
      text = text.replace(/,\s*([}\]])/g, "$1");
      res.json(JSON.parse(text));
    } catch (err: any) { handleAiError(res, err); }
  });

  app.post("/api/ai/getSmartTaskSuggestion", async (req, res) => {
    try {
      const ai = getGemini();
      const { taskTitle, goal } = req.body;
      const prompt = `
        You are an elite productivity and strategic execution AI.
        A user is pursuing the primary goal: "${goal}".
        They want to add a task called: "${taskTitle}".
        Suggest an incredibly concise, high-leverage description (max 20 words) explaining the exact, most effective action to take to ensure maximum tangible progress and intended outcomes.
        
        CRITICAL INTELLIGENCE: 
        1. Ensure the description explicitly uses the vocabulary and aligns with the specific mechanics of the goal: "${goal}". Replace generic words with highly relevant domain-specific terms.
        2. Break the task down into the smallest atomic action that yields the highest ROI. Assure it is highly actionable.
        3. Recommend 1 to 2 reputable, high-leverage sources or materials (official documentation, books, course platforms, tools, or articles) where the user can get reference material or study resources to execute this task effectively.
        
        Also suggest an appropriate, mathematically realistic XP reward (10-50), and duration in minutes (15-120) based strictly on cognitive load and effort required, and priority ('low', 'medium', 'high').
        Return ONLY JSON:
        {
          "description": "string",
          "xp": number,
          "duration": number,
          "priority": "string",
          "sources": [
            {
              "title": "string (name of book, doc, or tool)",
              "url": "string (direct link or search url)",
              "type": "string ('documentation' | 'book' | 'course' | 'tool' | 'article')",
              "description": "string (1-sentence guidance on how to use it)"
            }
          ]
        }
      `;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            xp: { type: Type.NUMBER },
            duration: { type: Type.NUMBER },
            priority: { type: Type.STRING },
            sources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  url: { type: Type.STRING },
                  type: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["title", "type", "description"]
              }
            }
          },
          required: ["description", "xp", "duration", "priority"]
        }}
      });
      let text = response.text || "{}";
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        text = text.substring(startIdx, endIdx + 1);
      }
      text = text.replace(/,\s*([}\]])/g, "$1");
      res.json(JSON.parse(text));
    } catch (err: any) { handleAiError(res, err); }
  });

  app.post("/api/ai/analyzeJournal", async (req, res) => {
    try {
      const ai = getGemini();
      const { content } = req.body;
      const prompt = `
        You are an elite cognitive behavioral AI. 
        Analyze this journal entry and extract one profound, actionable insight or mental framework shift.
        Keep the response to a single, concise sentence (max 15 words) that sounds highly intelligent and stoic.
        Journal Entry: "${content}"
      `;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      res.json({ result: response.text?.trim() });
    } catch (err: any) { handleAiError(res, err); }
  });

  app.post("/api/ai/getDailyInsight", async (req, res) => {
    try {
      const ai = getGemini();
      const { goal, xp, streak } = req.body;
      const prompt = `
        You are a world-class performance coach AI.
        Generate a 1-sentence profound, stoic, and highly intelligent motivational insight for a user with the goal: "${goal}".
        They have ${xp} total XP and a ${streak}-day streak.
        The insight should be paradigm-shifting, not a cliché. Connect the wisdom to their specific pursuit.
        Return ONLY the sentence.
      `;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      res.json({ result: response.text?.trim() });
    } catch (err: any) { handleAiError(res, err); }
  });

  app.post("/api/ai/chatWithCoach", async (req, res) => {
    try {
      const ai = getGemini();
      const { message, goal, history } = req.body;
      const prompt = `
        You are an elite, highly intelligent Performance & Strategy AI Coach.
        The user's primary objective is: "${goal}".
        Respond in a brilliant, motivational, and actionable manner. 
        Use sophisticated mental models, stoicism, and peak performance psychology. 
        Do not use clichés. Be provocative yet intensely supportive. 
        Structure your response clearly with paragraph breaks if needed.
        Keep the response concise (max 2-3 short paragraphs). Do NOT use excessive markdown or emojis.
      `;
      
      const contents = (history || []).map((h: any) => {
        const text = h.parts ? h.parts[0].text : h.text;
        const role = h.role === "coach" || h.role === "model" ? "model" : "user";
        return {
          role,
          parts: [{ text }]
        };
      });

      contents.push({ role: "user", parts: [{ text: message }] });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: { systemInstruction: prompt },
        contents: contents,
      });
      res.json({ result: response.text?.trim() });
    } catch (err: any) { handleAiError(res, err); }
  });

  app.post("/api/ai/refineRoadmap", async (req, res) => {
    try {
      const ai = getGemini();
      const { roadmap, message } = req.body;
      const prompt = `
        You are an elite strategic planner and learning scientist. 
        A user has this ambitious goal: "${roadmap.goal}" and this current 4-week roadmap:
        ${JSON.stringify(roadmap, null, 2)}
        
        The user wants to refine this roadmap. They said: "${message}"
        
        Update the roadmap intelligently based on their request. Maintain the strict structure of exactly 4 weeks, with exactly 3 core tasks per week.
        
        CRITICAL INTELLIGENCE INSTRUCTIONS:
        1. Directly address the user's feedback in the new tasks while preserving the overall progression of the goal.
        2. Adaptability: Adjust the complexity up or down based on their message. If they struggled, add smaller bridging tasks. If they found it too easy, add exponential challenges.
        3. Specificity: Every new task MUST explicitly use domain-specific terminology. Avoid generic tasks. If the goal involves physical fitness, recommend specific exercises (e.g., planks, push-ups) in order of priority. Apply this level of specific steps and concrete actions to all goal types.
        4. Actionable Focus: Every task must be an active, tangible milestone. (e.g., "Build X, Write Y" not "Think about X").
        5. SOURCES & MATERIALS (CRITICAL REQUIREMENT): For EVERY task, provide 1 to 3 reputable study materials, official docs, books, courses, or trusted tool references where the user can obtain material to execute the task.
        
        Return the response as a JSON object with this structure:
        {
          "goal": "string",
          "weeks": [
            {
              "title": "string",
              "description": "string",
              "tasks": [
                {
                  "title": "string",
                  "description": "string (Extremely detailed and highly specific. Give exact steps, commands, or subjects in order of priority and effectiveness. Max 35 words.)",
                  "xp": number (range 10-100),
                  "duration": number (minutes, range 15-180),
                  "dayOfWeek": "string",
                  "priority": "string",
                  "isImportant": boolean,
                  "sources": [
                    {
                      "title": "string",
                      "url": "string",
                      "type": "string ('documentation' | 'book' | 'course' | 'tool' | 'article')",
                      "description": "string"
                    }
                  ]
                }
              ]
            }
          ]
        }
        ONLY return the JSON object, NO markdown.
      `;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              goal: { type: Type.STRING },
              weeks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    tasks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          description: { type: Type.STRING },
                          xp: { type: Type.NUMBER },
                          duration: { type: Type.NUMBER },
                          dayOfWeek: { type: Type.STRING },
                          priority: { type: Type.STRING },
                          isImportant: { type: Type.BOOLEAN },
                          sources: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                title: { type: Type.STRING },
                                url: { type: Type.STRING },
                                type: { type: Type.STRING },
                                description: { type: Type.STRING }
                              },
                              required: ["title", "type", "description"]
                            }
                          }
                        },
                        required: ["title", "description", "xp", "duration", "dayOfWeek", "priority", "isImportant"]
                      }
                    }
                  },
                  required: ["title", "description", "tasks"]
                }
              }
            },
            required: ["goal", "weeks"]
          }
        }
      });
      let text = response.text || "{}";
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        text = text.substring(startIdx, endIdx + 1);
      }
      text = text.replace(/,\s*([}\]])/g, "$1");
      res.json(JSON.parse(text));
    } catch (err: any) { handleAiError(res, err); }
  });

  app.post("/api/ai/getCoachRecommendation", async (req, res) => {
    try {
      const ai = getGemini();
      const { goal, tasks, streak, level, history } = req.body;
      const completedCount = tasks.filter((t: any) => t.completed).length;
      const todayXP = history[5] || 0; 
      const avgXP = history.reduce((a: number, b: number) => a + b, 0) / 7;
      const isSlumping = todayXP < (avgXP * 0.5) && streak > 0;

      const prompt = `
        You are a world-class AI Performance Strategist and Executive Coach. 
        User Goal: "${goal}"
        Current Level: ${level}
        Current Streak: ${streak} days
        Today's Progress: ${completedCount}/${tasks.length} tasks done.
        Weekly History (XP): ${JSON.stringify(history)}
        Status: ${isSlumping ? 'DETECTED SLUMP' : 'HEALTHY PROGRESS'}

        MISSION:
        1. Analyze the data meticulously.
        2. If SLUMPING: Provide a high-leverage, contrarian psychological tactic to instantly break the friction and restart momentum. Focus on neurological resets or micro-wins.
        3. If PROGRESSING: Provide an advanced, elite-level challenge or strategic insight to 10x their results. Introduce a relevant mental model.
        4. Speak in the specific domain language of their goal with absolute authority.
        
        TONE: Elite, razor-sharp, highly intelligent, and paradigm-shifting. 
        Return ONLY a single paragraph block (max 45 words). No markdown.
      `;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      res.json({ result: response.text?.trim() });
    } catch (err: any) { handleAiError(res, err); }
  });

  app.post("/api/ai/generateWeeklyReview", async (req, res) => {
    try {
      const ai = getGemini();
      const { goal, tasks, streak, level, xp } = req.body;
      const completedTasks = tasks.filter((t: any) => t.completed);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Act as an elite productivity analyst. Generate a "Weekly Review" for the user.
Goal: ${goal}
Level: ${level} | XP: ${xp} | Streak: ${streak} days
Completed Tasks This Week: ${completedTasks.map((t: any) => t.title).join(", ")}

Provide a concise, 3-section Markdown summary:
1. **The Wins**: Celebrate their completions.
2. **The Analysis**: What their completed tasks say about their progress toward the goal.
3. **The Next Horizon**: One major focus area for next week based on what they accomplished.

Keep the tone premium, focused, and objective. Limit to 3 short paragraphs.`,
        config: {
          temperature: 0.6,
        }
      });
      
      res.json({ review: response.text });
    } catch (err: any) { handleAiError(res, err); }
  });

  app.post("/api/ai/decomposeTask", async (req, res) => {
    try {
      const ai = getGemini();
      const { taskTitle, taskDescription, duration, goal } = req.body;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `You are an elite behavioral psychologist and executive productivity strategist.
The user wants to conquer friction and execute on this specific task:
Goal context: "${goal || 'High Performance'}"
Task Title: "${taskTitle}"
Description: "${taskDescription || 'None'}"
Original Expected Duration: ${duration || 30} minutes

MISSION:
Decompose this task into 3 to 5 hyper-specific, actionable micro-steps.
Each micro-step must take between 5 to 15 minutes, start with an active physical verb, and have near-zero cognitive friction to start.
Include a brief tactical tip for each step to prevent distraction or hesitation.
Also provide 1 to 3 recommended high-quality sources or reference materials (official docs, books, courses, tutorials, or tools) where the user can get relevant guidance and materials.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rationale: {
                type: Type.STRING,
                description: "A 1-sentence behavioral psychology insight on why this breakdown eliminates resistance."
              },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Actionable micro-step title starting with an active verb" },
                    durationMinutes: { type: Type.NUMBER, description: "Estimated duration in minutes (5 to 15)" },
                    tip: { type: Type.STRING, description: "A tactical tip to avoid friction or perfectionism" },
                  },
                  required: ["title", "durationMinutes", "tip"]
                }
              },
              recommendedSources: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    url: { type: Type.STRING },
                    type: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                  required: ["title", "type", "description"]
                }
              }
            },
            required: ["rationale", "steps"]
          }
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (err: any) {
      handleAiError(res, err);
    }
  });

  app.post("/api/ai/getDailyBriefing", async (req, res) => {
    try {
      const ai = getGemini();
      const { goal, tasks, streak, xp, level, userName, calendarEvents } = req.body;
      const incompleteTasks = (tasks || []).filter((t: any) => !t.completed);
      const eventsSummary = (calendarEvents || [])
        .map((e: any) => `${e.summary || 'Event'} (${e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All-day'})`)
        .slice(0, 5)
        .join(", ");

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `You are the executive chief of staff and high-performance coach for ${userName || 'the user'}.
Generate a Morning Executive Briefing.
Goal: "${goal || 'Personal Mastery'}"
Level: ${level || 1} | XP: ${xp || 0} | Current Streak: ${streak || 0} days
Today's Unfinished Tasks (${incompleteTasks.length}): ${incompleteTasks.map((t: any) => t.title).slice(0, 6).join(", ") || 'None yet'}
Today's Calendar Events: ${eventsSummary || "No external events scheduled"}

MISSION:
Provide a razor-sharp, inspiring, and strategic briefing that prepares them to conquer the day with high cognitive clarity.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              greeting: { type: Type.STRING, description: "Short, elite morning greeting addressing the user" },
              priorityDirective: { type: Type.STRING, description: "The single highest-leverage task or objective to lock in today and why" },
              mentalModel: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Name of the mental model (e.g., Pareto Principle, Activation Energy, Inversion, Eisenhower Matrix)" },
                  explanation: { type: Type.STRING, description: "How to apply this mental model today to their specific tasks (1-2 sentences)" }
                },
                required: ["name", "explanation"]
              },
              scheduleStrategy: { type: Type.STRING, description: "How to sequence deep work vs shallow tasks based on their calendar and task load (1-2 sentences)" },
              powerAffirmation: { type: Type.STRING, description: "A high-conviction, stoic sentence to frame their mindset" }
            },
            required: ["greeting", "priorityDirective", "mentalModel", "scheduleStrategy", "powerAffirmation"]
          }
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (err: any) {
      handleAiError(res, err);
    }
  });

  // API Route: Paystack Checkout
  app.post("/api/create-checkout-session", async (req, res) => {
    const key = process.env.PAYSTACK_SECRET_KEY?.replace(/['"]/g, '').trim();
    const { tier, plan, email = "guest@example.com", paymentMethod } = req.body;

    let baseUrl = req.headers.origin;
    if (!baseUrl) {
      const referer = req.get('referer');
      if (referer) {
        try {
          const parsed = new URL(referer);
          baseUrl = parsed.origin;
        } catch (e) {
            baseUrl = `${req.protocol}://${req.get('host')}`;
        }
      } else {
        baseUrl = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.get('host')}`;
      }
    }

    if (!key || (!key.startsWith('sk_test_') && !key.startsWith('sk_live_'))) {
      console.warn("PAYSTACK_SECRET_KEY not correctly configured (must start with sk_test_ or sk_live_). Using static shop link as fallback.");
      
      let shopUrl = "https://paystack.shop/pay/v0n3349s6p"; // Default to Pro
      if (tier === 'elite') {
         // Fallback for Elite until a specific link is provided
         shopUrl = "https://paystack.shop/pay/v0n3349s6p";
      }

      return res.json({ url: shopUrl, isShopLink: true, tier });
    }

    let unitAmount = 15000;
    let name = 'Aureon Pro Subscription';
    let planCode = '';

    if (tier === 'elite' && plan === 'yearly') {
      planCode = process.env.PAYSTACK_PLAN_CODE_ELITE_YEARLY || '';
      unitAmount = 45000;
      name = 'Aureon Elite Subscription (Yearly)';
    } else if (tier === 'elite' && plan === 'monthly') {
      planCode = process.env.PAYSTACK_PLAN_CODE_ELITE_MONTHLY || '';
      unitAmount = 5000;
      name = 'Aureon Elite Subscription (Monthly)';
    } else if (tier === 'pro' && plan === 'yearly') {
      planCode = process.env.PAYSTACK_PLAN_CODE_PRO_YEARLY || '';
      unitAmount = 15000;
      name = 'Aureon Pro Subscription (Yearly)';
    } else if (tier === 'pro' && plan === 'monthly') {
      planCode = process.env.PAYSTACK_PLAN_CODE_PRO_MONTHLY || '';
      unitAmount = 2000;
      name = 'Aureon Pro Subscription (Monthly)';
    }

    try {
      const payload: any = {
        email,
        amount: unitAmount,
        currency: "ZAR",
        callback_url: `${baseUrl}/?payment=success&tier=${tier}`,
        channels: ['card', 'bank_transfer', 'eft'], // standard Paystack ZA channels
        metadata: {
           custom_fields: [
              {
                 display_name: "Plan Name",
                 variable_name: "plan_name",
                 value: name
              }
           ]
        }
      };
      
      if (planCode) {
        payload.plan = planCode;
      }

      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.status === true && data.data && data.data.authorization_url) {
        res.json({ url: data.data.authorization_url });
      } else {
        throw new Error(data.message || "Failed to initialize Paystack transaction");
      }
    } catch (err: any) {
      if (err.message && err.message.includes("Invalid key")) {
        console.warn("Invalid Paystack key provided. Using static shop link as fallback.");
        let shopUrl = "https://paystack.shop/pay/v0n3349s6p"; // Default to Pro
        if (tier === 'elite') {
           // Fallback for Elite until a specific link is provided
           shopUrl = "https://paystack.shop/pay/v0n3349s6p";
        }
        res.json({ url: shopUrl, isShopLink: true, tier });
      } else {
        console.error("Paystack Error:", err.message);
        res.status(500).json({ error: err.message });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
