import fs from "fs";
const content = fs.readFileSync("server.ts", "utf-8");

const newContent = content.replace(/\} catch \(err: any\) \{\s*if \(err\.message && err\.message\.includes\("API key not valid"\)\) \{\s*res\.status\(401\)\.json\(\{ error: "The provided GEMINI_API_KEY is invalid\. Please update it in the Settings menu\." \}\);\s*\} else \{\s*console\.error\(err\);\s*res\.status\(500\)\.json\(\{ error: err\.message \}\);\s*\}\s*\}/g,
`} catch (err: any) {
      if (err.message && (err.message.includes("API key not valid") || err.message.includes("API_KEY_INVALID"))) {
        res.status(401).json({ error: "The provided GEMINI_API_KEY is invalid. Please update it in the Settings menu." });
      } else {
        console.error(err);
        res.status(500).json({ error: err.message });
      }
    }`);
fs.writeFileSync("server.ts", newContent);
console.log("Replaced instances:", (content.match(/\} catch \(err: any\) \{/g) || []).length);
console.log("Content changed:", content !== newContent);
