/**
 * VerifyEmployeeTool.ts
 *
 * Looks up an employee by their ID in BambooHR and returns their verified
 * identity details (name, job title, department, location, supervisor).
 *
 * Used at the start of the daily performance check-in to:
 *   1. Verify the team lead's own identity before accepting any submissions.
 *   2. Verify each team member's identity before recording their entry.
 *
 * The agent MUST call this tool and show the result to the user for
 * confirmation before proceeding.
 */

import { LuaTool } from "lua-cli";
import { z } from "zod";
import { bambooHR } from "../../../services/BambooHRService.js";

export class VerifyEmployeeTool implements LuaTool {
  name = "verify_employee";
  description =
    "Look up an employee by their ID in BambooHR to verify their identity. " +
    "Returns their full name, job title, department, and location. " +
    "MUST be called to verify the team lead at session start, and for each " +
    "team member before recording their performance entry. Always show the " +
    "result back to the user and ask them to confirm before proceeding.";

  inputSchema = z.object({
    employeeId: z
      .string()
      .describe("The BambooHR employee ID to look up (e.g. '1001')"),
    role: z
      .enum(["team_lead", "team_member"])
      .describe(
        "Whether this is verifying the team lead (session start) or a team member (during check-in collection)"
      ),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    let employee;
    try {
      employee = await bambooHR.getEmployee(input.employeeId);
      if (!employee) throw new Error("Not found");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Handle the common "not found" case clearly
      if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
        return {
          found: false,
          employeeId: input.employeeId,
          message:
            `❌ No employee found with ID **${input.employeeId}** in BambooHR.\n` +
            `Please double-check the ID and try again.`,
        };
      }
      return {
        found: false,
        employeeId: input.employeeId,
        message: `❌ Failed to look up employee ${input.employeeId}: ${msg}`,
      };
    }

    const isTeamLead = employee.agentRole === "Team Lead";

    if (input.role === "team_lead" && !isTeamLead) {
      return {
        found: false,
        employeeId: input.employeeId,
        message: `❌ Authorization Denied: Employee **${employee.fullName}** (${employee.jobTitle}) is not authorized. Daily check-ins can only be submitted by Team Leads.`,
      };
    }

    // Map location to human-readable office name
    const officeMap: Record<string, string> = {
      riyadh_hq: "Riyadh HQ 🇸🇦",
      dubai_plant: "Dubai Plant 🇦🇪",
      alexandria_hub: "Alexandria Hub 🇪🇬",
      amman_center: "Amman Center 🇯🇴",
    };
    const officeName = officeMap[employee.location] ?? employee.location;

    const confirmationPrompt =
      input.role === "team_lead"
        ? `✅ Team lead verified. Please confirm this is you before we proceed:\n\n` +
          `**Name:** ${employee.fullName}\n` +
          `**Title:** ${employee.jobTitle}\n` +
          `**Department:** ${employee.department}\n` +
          `**Office:** ${officeName}\n\n` +
          `Type **"yes"** to confirm your identity, or **"no"** if this is incorrect.`
        : `✅ Employee found. Is this the team member you want to rate?\n\n` +
          `**Name:** ${employee.fullName}\n` +
          `**Title:** ${employee.jobTitle}\n` +
          `**Department:** ${employee.department}\n` +
          `**Office:** ${officeName}\n\n` +
          `Type **"yes"** to confirm, or provide the correct employee ID.`;

    return {
      found: true,
      employeeId: input.employeeId,
      fullName: employee.fullName,
      jobTitle: employee.jobTitle,
      department: employee.department,
      location: employee.location,
      officeName,
      supervisor: employee.supervisor,
      supervisorId: employee.supervisorId,
      confirmationPrompt,
    };
  }
}
