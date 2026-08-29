/**
 * GetWeeklySummaryTool.ts
 *
 * Reads performance data from Google Sheets and returns an aggregated
 * weekly summary per team lead or across all teams.
 *
 * Computes:
 *   - Average team rating for the week
 *   - Total check-in entries
 *   - Top performers (highest avg rating)
 *   - Common blockers across the week
 *   - Per-day rating breakdown
 */

import { LuaTool } from "lua-cli";
import { z } from "zod";
import { googleSheets } from "../../../services/GoogleSheetsService.js";

export class GetWeeklySummaryTool implements LuaTool {
  name = "get_weekly_summary";
  description =
    "Retrieve a weekly performance summary from the Google Sheets dashboard. Returns average ratings, top performers, common blockers, and daily trends for a team lead or all teams. Managers use this to review team performance at the end of the week.";

  inputSchema = z.object({
    teamLeadId: z
      .string()
      .optional()
      .describe("Filter summary by a specific team lead's employee ID (e.g. '1001'). Leave empty to see all teams."),
    teamLeadName: z
      .string()
      .optional()
      .describe("Name of the team lead (optional, used for the summary title)"),
    weekStartDate: z
      .string()
      .optional()
      .describe(
        "Start date of the week to summarize (YYYY-MM-DD). Defaults to the current week's Sunday. Example: '2026-08-25'"
      ),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const summary = await googleSheets.getWeeklySummary(input.teamLeadId, input.weekStartDate);

    if (summary.totalEntries === 0) {
      return {
        success: true,
        found: false,
        teamLeadId: input.teamLeadId ?? "All Teams",
        weekStartDate: summary.weekStartDate,
        message:
          input.teamLeadId
            ? `📊 No performance check-in data found for team lead '${input.teamLeadName ?? input.teamLeadId}' this week (starting ${summary.weekStartDate}). The team may not have submitted their daily check-ins yet.`
            : `📊 No performance data found for this week (starting ${summary.weekStartDate}). No check-ins have been submitted yet.`,
      };
    }

    // Compute daily breakdown from entries
    const dailyData: Record<string, { count: number; totalRating: number }> = {};
    for (const entry of summary.entries) {
      if (!dailyData[entry.date]) dailyData[entry.date] = { count: 0, totalRating: 0 };
      dailyData[entry.date].count += 1;
      dailyData[entry.date].totalRating += entry.rating;
    }
    const dailyBreakdown = Object.entries(dailyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        entries: d.count,
        avgRating: Math.round((d.totalRating / d.count) * 10) / 10,
        ratingBar: "⭐".repeat(Math.round(d.totalRating / d.count)),
      }));

    // Format blockers — deduplicate and keep non-trivial ones
    const blockerList = summary.commonBlockers
      .filter((b) => b && b.toLowerCase() !== "none" && b.trim().length > 3)
      .slice(0, 5);

    // Rating performance label
    const ratingLabel =
      summary.averageRating >= 4.5
        ? "🌟 Outstanding"
        : summary.averageRating >= 4.0
        ? "✅ Very Good"
        : summary.averageRating >= 3.0
        ? "📈 Good"
        : summary.averageRating >= 2.0
        ? "⚠️ Needs Attention"
        : "🔴 Critical — Action Required";

    return {
      success: true,
      found: true,
      weekStartDate: summary.weekStartDate,
      teamScope: input.teamLeadId ? `Team Lead: ${input.teamLeadName ?? input.teamLeadId}` : "All Teams",
      totalEntries: summary.totalEntries,
      averageRating: summary.averageRating,
      performanceLabel: ratingLabel,
      topPerformers: summary.topPerformers.map((p) => ({
        name: p.name,
        avgRating: p.avgRating,
        stars: "⭐".repeat(Math.round(p.avgRating)),
      })),
      commonBlockers: blockerList.length > 0 ? blockerList : ["No significant blockers reported this week ✨"],
      dailyBreakdown,
      message:
        `📊 **Weekly Performance Summary** — Week of ${summary.weekStartDate}\n` +
        `🏢 Scope: ${input.teamLeadId ? (input.teamLeadName ?? input.teamLeadId) : "All Teams"}\n\n` +
        `📈 **Overall Rating**: ${summary.averageRating}/5 — ${ratingLabel}\n` +
        `📝 Total Check-In Entries: ${summary.totalEntries}\n\n` +
        (summary.topPerformers.length > 0
          ? `🏆 **Top Performers**:\n${summary.topPerformers.map((p) => `   • ${p.name}: ${p.avgRating}/5`).join("\n")}\n\n`
          : "") +
        (blockerList.length > 0
          ? `⚠️ **Blockers to Address**:\n${blockerList.map((b) => `   • ${b}`).join("\n")}`
          : "✨ No significant blockers this week!"),
    };
  }
}
