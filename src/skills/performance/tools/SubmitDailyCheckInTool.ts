/**
 * SubmitDailyCheckInTool.ts
 *
 * Collects daily performance check-in data from a team lead for
 * each team member, then appends rows to the Google Sheets dashboard.
 *
 * Each team member entry captures:
 *   - What they accomplished today
 *   - Any blockers or obstacles
 *   - Productivity rating (1–5)
 */

import { LuaTool } from "lua-cli";
import { z } from "zod";
import { googleSheets, type PerformanceEntry } from "../../../services/GoogleSheetsService.js";
import { bambooHR } from "../../../services/BambooHRService.js";

const MemberEntrySchema = z.object({
  memberId: z
    .string()
    .describe("Team member's employee ID or name (e.g. '1001' or 'Ahmed Al-Rashidi')"),
  memberName: z
    .string()
    .describe("Full name of the team member"),
  accomplishments: z
    .string()
    .min(5)
    .describe("What this team member accomplished today. Be specific and include deliverables."),
  blockers: z
    .string()
    .describe("Any obstacles, blockers, or issues. Use 'None' if there are no blockers."),
  rating: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("Productivity rating for this team member: 1=Very Low, 2=Low, 3=Average, 4=Good, 5=Excellent"),
});

export class SubmitDailyCheckInTool implements LuaTool {
  name = "submit_daily_checkin";
  description =
    "Submit daily performance check-in data for a team. Appends each team member's accomplishments, blockers, and productivity rating (1–5) to the live Google Sheets performance dashboard. " +
    "IMPORTANT: The team lead and each team member MUST have been verified via verify_employee BEFORE calling this tool. " +
    "Use the verified fullName from BambooHR for teamLeadName and memberName — never rely on user-typed names.";

  inputSchema = z.object({
    teamLeadId: z
      .string()
      .describe("Employee ID of the team lead submitting the check-in (e.g. '1001')"),
    teamLeadName: z
      .string()
      .describe("Full name of the team lead"),
    date: z
      .string()
      .optional()
      .describe("Date for the check-in in YYYY-MM-DD format. Defaults to today if not provided."),
    entries: z
      .array(MemberEntrySchema)
      .min(1)
      .max(30)
      .describe("List of team member entries for this check-in. Must include at least one member."),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const date = input.date ?? new Date().toISOString().split("T")[0];

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        success: false,
        message: `❌ Invalid date format '${date}'. Please use YYYY-MM-DD (e.g. '2026-08-29').`,
      };
    }

    // ── Hard guardrail: verify team lead ID against BambooHR ────────────────
    let verifiedLeadName: string;
    try {
      const lead = await bambooHR.getEmployee(input.teamLeadId);
      verifiedLeadName = lead.fullName;
    } catch {
      return {
        success: false,
        message:
          `❌ Team lead ID **${input.teamLeadId}** was not found in BambooHR.\n` +
          `Submission blocked. Please verify the correct employee ID and try again.`,
      };
    }

    // ── Hard guardrail: verify every member ID against BambooHR ────────────
    const verifiedEntries: Array<{ memberId: string; memberName: string; accomplishments: string; blockers: string; rating: number }> = [];
    for (const entry of input.entries) {
      try {
        const member = await bambooHR.getEmployee(entry.memberId);
        verifiedEntries.push({
          memberId: entry.memberId,
          memberName: member.fullName,  // Always use BambooHR name, ignore LLM-provided name
          accomplishments: entry.accomplishments,
          blockers: entry.blockers,
          rating: entry.rating,
        });
      } catch {
        return {
          success: false,
          message:
            `❌ Team member ID **${entry.memberId}** was not found in BambooHR.\n` +
            `Submission blocked. All employee IDs must be valid BambooHR records.\n` +
            `Please provide the correct employee ID for "${entry.memberName}" and try again.`,
        };
      }
    }

    const performanceEntries: PerformanceEntry[] = verifiedEntries.map((entry) => ({
      date,
      teamLeadId: input.teamLeadId,
      teamLeadName: verifiedLeadName,
      memberId: entry.memberId,
      memberName: entry.memberName,
      accomplishments: entry.accomplishments,
      blockers: entry.blockers,
      rating: entry.rating,
      submittedAt: new Date().toISOString(),
    }));

    let result: { rowsAdded: number; sheetUrl: string };
    try {
      result = await googleSheets.appendRows(performanceEntries);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        errorDetail: errorMsg,
        message:
          `❌ Failed to write to Google Sheets.\n\n` +
          `**Technical error**: ${errorMsg}\n\n` +
          `Please report this error to the IT team.`,
      };
    }

    // Build per-member summary for confirmation
    const memberSummary = verifiedEntries.map((e) => ({
      name: e.memberName,
      rating: `${e.rating}/5 ${"⭐".repeat(e.rating)}`,
      hasBlockers: e.blockers.toLowerCase() !== "none" && e.blockers.trim().length > 0,
    }));

    const avgRating =
      Math.round((verifiedEntries.reduce((sum, e) => sum + e.rating, 0) / verifiedEntries.length) * 10) / 10;

    const blockerCount = memberSummary.filter((m) => m.hasBlockers).length;

    return {
      success: true,
      date,
      teamLeadId: input.teamLeadId,
      teamLeadName: verifiedLeadName,
      rowsAdded: result.rowsAdded,
      teamAvgRating: avgRating,
      membersWithBlockers: blockerCount,
      memberSummary,
      sheetUrl: result.sheetUrl,
      message:
        `✅ Daily check-in for ${date} submitted successfully!\n` +
        `📊 ${result.rowsAdded} team member(s) recorded | Team avg: ${avgRating}/5\n` +
        (blockerCount > 0
          ? `⚠️ ${blockerCount} blocker(s) reported — please review and escalate if needed.\n`
          : `✨ No blockers reported today!\n`) +
        `\n📋 View the live dashboard: ${result.sheetUrl}`,
    };
  }
}
