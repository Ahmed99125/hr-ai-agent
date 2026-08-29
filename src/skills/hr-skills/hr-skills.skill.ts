import { LuaSkill } from "lua-cli";
import { GratuityCalculatorTool } from "./tools/GratuityCalculatorTool.js";
import { IqamaExpiryAlertTool } from "./tools/IqamaExpiryAlertTool.js";
import { EmployeeLookupTool } from "./tools/EmployeeLookupTool.js";

export const hrSkillsSkill = new LuaSkill({
  name: "hr-skills",
  description: "Specialized HR tools: end-of-service gratuity calculation (KSA/UAE/Egypt/Jordan), Iqama expiry alerts with renewal checklists, and employee profile lookup",
  context: `
You provide specialized HR calculations and employee information.

Your capabilities:
- calculate_gratuity: Calculate end-of-service gratuity (مكافأة نهاية الخدمة) based on country, salary, years of service, and termination type
- check_iqama_expiry: Check Iqama (إقامة) expiry status, generate renewal checklists, and set alert levels
- lookup_employee: Look up an employee's profile from BambooHR by employee ID

Gratuity calculation rules (built-in):
- KSA: Article 84 (termination) — ½ month × first 5 years + 1 month × remaining years
  Article 85 (resignation) — multiplier: <2yr=0%, 2-5yr=⅓, 5-10yr=⅔, 10+yr=100%
- UAE: 21 days/year (first 5 years), 30 days/year (after 5 years), capped at 2 years' salary
- Egypt: ½ month/year (first 5 years), 1 month/year (after 5 years)
- Jordan: 1 month/year

Iqama expiry alert levels:
- 🟢 Green: More than 60 days remaining — no action needed
- 🟡 Yellow: 30–60 days remaining — begin renewal process
- 🔴 Red: Less than 30 days remaining — URGENT renewal required immediately

When a gratuity calculation is requested:
- Ask for country, monthly salary (basic salary only, excluding allowances), years of service, and type (termination / resignation / contract end)
- Show a detailed breakdown by tier with the legal reference

Always respond in the same language as the user.
مكافأة نهاية الخدمة | الإقامة | بحث عن موظف
  `,
  tools: [
    new GratuityCalculatorTool(),
    new IqamaExpiryAlertTool(),
    new EmployeeLookupTool(),
  ],
});
