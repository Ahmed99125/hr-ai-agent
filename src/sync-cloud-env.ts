import { execFileSync } from "child_process";
import * as fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const lines = envContent.split("\n");

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;

  const equalIndex = trimmed.indexOf("=");
  if (equalIndex === -1) continue;

  const key = trimmed.slice(0, equalIndex).trim();
  const value = trimmed.slice(equalIndex + 1).trim();

  if (key && value) {
    console.log(`Setting ${key} on Lua Cloud (staging & production)...`);
    try {
      execFileSync(
        "lua.cmd",
        ["env", "staging", "-k", key, "-v", value],
        { shell: true, stdio: "inherit" }
      );
      execFileSync(
        "lua.cmd",
        ["env", "production", "-k", key, "-v", value],
        { shell: true, stdio: "inherit" }
      );
      console.log(`✅ ${key} set successfully!\n`);
    } catch (err: any) {
      console.error(`❌ Failed to set ${key}:`, err.message, "\n");
    }
  }
}

console.log("==========================================");
console.log("🎉 ALL ENVIRONMENT VARIABLES SYNCED TO LUA CLOUD!");
console.log("==========================================");
