/**
 * TriggerOnboardingChecklistTool.ts
 *
 * Creates a BambooHR onboarding checklist for a new employee.
 * Returns a country/entity-specific checklist with tasks, owners,
 * and due dates for Day 1, Week 1, and Month 1.
 */

import { LuaTool } from "lua-cli";
import { z } from "zod";
import { bambooHR } from "../../../services/BambooHRService.js";

export class TriggerOnboardingChecklistTool implements LuaTool {
  name = "trigger_onboarding_checklist";
  description =
    "Create a BambooHR onboarding checklist for a new employee. Returns country-specific tasks with owners (HR, IT, Finance) and due dates. Supports KSA, UAE, Egypt, and Jordan entities.";

  inputSchema = z.object({
    employeeId: z
      .string()
      .describe("BambooHR employee ID of the new joiner (e.g. '124')"),
    employeeName: z
      .string()
      .describe("Full name of the new employee"),
    country: z
      .enum(["KSA", "UAE", "EGY", "JOR"])
      .describe("Country of employment — determines which entity-specific tasks to add"),
    location: z
      .enum(["riyadh_hq", "dubai_plant", "alexandria_hub", "amman_center"])
      .describe("Office location — determines local IT/facilities contacts and orientation details"),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const checklist = await bambooHR.createOnboardingChecklist(input.employeeId, input.country);

    const locationLabels: Record<string, string> = {
      riyadh_hq: "Riyadh HQ",
      dubai_plant: "Dubai Plant",
      alexandria_hub: "Alexandria Hub",
      amman_center: "Amman Center",
    };

    const itContacts: Record<string, string> = {
      riyadh_hq: "it-support@company.sa",
      dubai_plant: "it-dubai@company.ae",
      alexandria_hub: "it-alex@company.eg",
      amman_center: "it-amman@company.jo",
    };

    const hrContacts: Record<string, string> = {
      riyadh_hq: "hr@company.sa",
      dubai_plant: "hr-uae@company.ae",
      alexandria_hub: "hr-egypt@company.eg",
      amman_center: "hr-jordan@company.jo",
    };

    // Group tasks by phase
    const day1Tasks = checklist.items.filter((i) =>
      ["CHK-01", "CHK-02", "CHK-06", "CHK-08"].includes(i.id)
    );
    const week1Tasks = checklist.items.filter((i) =>
      ["CHK-03", "CHK-04", "CHK-07", "CHK-09", "CHK-10"].includes(i.id)
    );
    const month1Tasks = checklist.items.filter((i) =>
      ["CHK-05"].includes(i.id)
    );

    return {
      checklistId: checklist.id,
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      country: input.country,
      location: locationLabels[input.location] ?? input.location,
      totalTasks: checklist.items.length,
      itContact: itContacts[input.location] ?? "it@company.com",
      hrContact: hrContacts[input.location] ?? "hr@company.com",
      phases: {
        day1: {
          label: "📅 Day 1 — Priority Actions",
          tasks: day1Tasks.map((t) => ({
            task: t.task,
            assignedTo: t.assignedTo,
            dueDate: t.dueDate,
            completed: t.completed,
          })),
        },
        week1: {
          label: "📋 Week 1 — Required Registrations",
          tasks: week1Tasks.map((t) => ({
            task: t.task,
            assignedTo: t.assignedTo,
            dueDate: t.dueDate,
            completed: t.completed,
          })),
        },
        month1: {
          label: "🏦 Month 1 — System Setup",
          tasks: month1Tasks.map((t) => ({
            task: t.task,
            assignedTo: t.assignedTo,
            dueDate: t.dueDate,
            completed: t.completed,
          })),
        },
      },
      message: `✅ Onboarding checklist created for ${input.employeeName} at ${locationLabels[input.location]}. ${checklist.items.length} tasks have been generated and assigned to HR, IT, and Finance.`,
    };
  }
}
