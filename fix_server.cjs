const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const helper = `
  const handleAiError = (res: any, err: any) => {
    if (err.message && (err.message.includes("API key not valid") || err.message.includes("API_KEY_INVALID"))) {
      res.status(401).json({ error: "The provided GEMINI_API_KEY is invalid. Please update it in the Settings menu." });
    } else if (err.status === 429 || (err.message && (err.message.includes("429") || err.message.toLowerCase().includes("quota") || err.message.includes("RESOURCE_EXHAUSTED")))) {
      res.status(429).json({ error: "You exceeded your current AI quota with Gemini. Please try again later." });
    } else {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  };
`;

code = code.replace("app.use(express.json());", "app.use(express.json());\n" + helper);

const regex = /catch\s*\(err:\s*any\)\s*\{\s*if\s*\([^\{]+\{\s*[^\{]*res\.status\(401\)\.json\([^;]+\);?\s*\}\s*else\s*\{\s*console\.error\([^;]+\);\s*res\.status\(500\)\.json\([^;]+\);\s*\}\s*\}/g;

code = code.replace(regex, "catch (err: any) { handleAiError(res, err); }");

fs.writeFileSync('server.ts', code);
console.log("Done");
