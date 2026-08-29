import { LuaJob } from "lua-cli";
import { bambooHR } from "../services/BambooHRService.js";


/**
 * IqamaExpiryCheckJob
 *
 * Runs daily at 8:00 AM (Sunday–Thursday, KSA workweek) to scan all employee
 * records for Iqama documents expiring within 60 days and send proactive alerts.
 */
export const iqamaExpiryCheckJob = new LuaJob({
  name: "iqama-expiry-daily-scan",
  description: "Daily scan for Iqama documents expiring within 60 days — sends proactive alerts to HR coordinators",
  schedule: {
    type: "cron",
    expression: "0 8 * * 0-4", // 8:00 AM, Sunday–Thursday (KSA workweek)
  },
  execute: async (job) => {
    const user = await job.user();

    let employees;
    try {
      employees = await bambooHR.getAllEmployees();
    } catch (err) {
      await user.send([{
        type: "text",
        text: `⚠️ Iqama Expiry Scan: Could not fetch employee data. Error: ${String(err)}`,
      }]);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expired: string[] = [];
    const critical: string[] = []; // < 30 days
    const warning: string[] = [];  // 30–60 days

    for (const emp of employees) {
      if (!emp.iqamaExpiryDate) continue;

      const expiry = new Date(emp.iqamaExpiryDate);
      expiry.setHours(0, 0, 0, 0);
      const days = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (days < 0) {
        expired.push(`🚨 ${emp.fullName} (ID: ${emp.id}) — EXPIRED ${Math.abs(days)} days ago`);
      } else if (days < 30) {
        critical.push(`🔴 ${emp.fullName} (ID: ${emp.id}) — ${days} day(s) remaining`);
      } else if (days <= 60) {
        warning.push(`🟡 ${emp.fullName} (ID: ${emp.id}) — ${days} day(s) remaining`);
      }
    }

    // Build the alert message
    const hasAlerts = expired.length > 0 || critical.length > 0 || warning.length > 0;

    if (!hasAlerts) {
      await user.send([{
        type: "text",
        text: `✅ *Daily Iqama Scan — ${today.toISOString().split("T")[0]}*\n\nAll employee Iqama documents are valid with more than 60 days remaining. No action required.`,
      }]);
      return;
    }

    let message = `📋 *Daily Iqama Expiry Report — ${today.toISOString().split("T")[0]}*\n\n`;

    if (expired.length > 0) {
      message += `🚨 *EXPIRED (${expired.length} employee(s)):*\n${expired.join("\n")}\n\n`;
    }

    if (critical.length > 0) {
      message += `🔴 *CRITICAL — Under 30 Days (${critical.length} employee(s)):*\n${critical.join("\n")}\n\n`;
    }

    if (warning.length > 0) {
      message += `🟡 *WARNING — 30–60 Days (${warning.length} employee(s)):*\n${warning.join("\n")}\n\n`;
    }

    message += `_Action required: Contact the Company PRO to initiate Iqama renewal for all flagged employees. Expired Iqamas may result in legal violations._`;

    await user.send([{ type: "text", text: message }]);
  },
});
