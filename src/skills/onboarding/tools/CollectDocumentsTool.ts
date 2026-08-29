/**
 * CollectDocumentsTool.ts
 *
 * Validates and stores required onboarding documents:
 * - Iqama number (10 digits, for expats in KSA/UAE)
 * - Saudi/UAE IBAN (SA + 22 digits, or AE + 21 digits)
 * - National ID (for EGY/JOR local hires)
 * - Emergency contact details
 *
 * Stores the collected data via Lua Data API (Data.upsert).
 */

import { LuaTool, Data } from "lua-cli";
import { z } from "zod";

export class CollectDocumentsTool implements LuaTool {
  name = "collect_documents";
  description =
    "Validate and record a new employee's required onboarding documents: Iqama number (for KSA/UAE expats), bank IBAN, national ID (for Egypt/Jordan locals), and emergency contact. Validates format correctness before storing.";

  inputSchema = z.object({
    employeeId: z
      .string()
      .describe("The BambooHR employee ID of the new joiner (e.g. '124')"),
    employeeName: z
      .string()
      .describe("Full name of the new employee"),
    country: z
      .enum(["KSA", "UAE", "EGY", "JOR"])
      .describe("Country of employment"),
    iqamaNumber: z
      .string()
      .optional()
      .describe("Iqama number for expats in KSA or UAE (must be exactly 10 digits). Required for non-Saudi/non-UAE nationals."),
    nationalId: z
      .string()
      .optional()
      .describe("National ID number for Egyptian or Jordanian local hires"),
    iban: z
      .string()
      .optional()
      .describe("Bank IBAN for salary payments. KSA: starts with SA + 22 digits (24 total). UAE: starts with AE + 21 digits (23 total)."),
    emergencyContactName: z
      .string()
      .optional()
      .describe("Full name of the emergency contact person"),
    emergencyContactRelationship: z
      .string()
      .optional()
      .describe("Relationship to the employee (e.g. Spouse, Father, Sister)"),
    emergencyContactPhone: z
      .string()
      .optional()
      .describe("Phone number of the emergency contact (include country code)"),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const validationErrors: string[] = [];
    const validatedFields: Record<string, string> = {};

    // ─── Validate Iqama Number ────────────────────────────────────────────────
    if (input.iqamaNumber !== undefined) {
      const cleaned = input.iqamaNumber.replace(/\s/g, "");
      if (!/^\d{10}$/.test(cleaned)) {
        validationErrors.push(
          `❌ Iqama number '${input.iqamaNumber}' is invalid. It must be exactly 10 digits (e.g. 2345678901).`
        );
      } else {
        validatedFields.iqamaNumber = cleaned;
      }
    }

    // ─── Validate National ID ─────────────────────────────────────────────────
    if (input.nationalId !== undefined) {
      const cleaned = input.nationalId.replace(/\s/g, "");
      if (input.country === "EGY" && !/^\d{14}$/.test(cleaned)) {
        validationErrors.push(
          `❌ Egyptian National ID '${input.nationalId}' is invalid. It must be exactly 14 digits.`
        );
      } else if (input.country === "JOR" && !/^\d{9,10}$/.test(cleaned)) {
        validationErrors.push(
          `❌ Jordanian National Number '${input.nationalId}' is invalid. It must be 9 or 10 digits.`
        );
      } else {
        validatedFields.nationalId = cleaned;
      }
    }

    // ─── Validate IBAN ────────────────────────────────────────────────────────
    if (input.iban !== undefined) {
      const cleaned = input.iban.replace(/\s/g, "").toUpperCase();
      if (input.country === "KSA") {
        if (!/^SA\d{22}$/.test(cleaned)) {
          validationErrors.push(
            `❌ Saudi IBAN '${input.iban}' is invalid. Must start with 'SA' followed by exactly 22 digits (24 characters total). Example: SA0380000000608010167519`
          );
        } else {
          validatedFields.iban = cleaned;
        }
      } else if (input.country === "UAE") {
        if (!/^AE\d{21}$/.test(cleaned)) {
          validationErrors.push(
            `❌ UAE IBAN '${input.iban}' is invalid. Must start with 'AE' followed by exactly 21 digits (23 characters total).`
          );
        } else {
          validatedFields.iban = cleaned;
        }
      } else {
        // Egypt and Jordan — basic format check
        if (cleaned.length < 15 || cleaned.length > 34) {
          validationErrors.push(
            `❌ IBAN '${input.iban}' appears to be invalid (length ${cleaned.length}). Please verify with your bank.`
          );
        } else {
          validatedFields.iban = cleaned;
        }
      }
    }

    // ─── Validate Emergency Contact ───────────────────────────────────────────
    const hasPartialEmergency =
      input.emergencyContactName || input.emergencyContactRelationship || input.emergencyContactPhone;

    if (hasPartialEmergency) {
      if (!input.emergencyContactName) {
        validationErrors.push("❌ Emergency contact name is required.");
      }
      if (!input.emergencyContactRelationship) {
        validationErrors.push("❌ Emergency contact relationship is required (e.g. Spouse, Father).");
      }
      if (!input.emergencyContactPhone) {
        validationErrors.push("❌ Emergency contact phone number is required.");
      } else if (!/^\+?[\d\s\-()]{7,15}$/.test(input.emergencyContactPhone)) {
        validationErrors.push(
          `❌ Emergency contact phone '${input.emergencyContactPhone}' format is invalid. Include country code (e.g. +966501234567).`
        );
      }

      if (
        input.emergencyContactName &&
        input.emergencyContactRelationship &&
        input.emergencyContactPhone
      ) {
        validatedFields.emergencyContactName = input.emergencyContactName;
        validatedFields.emergencyContactRelationship = input.emergencyContactRelationship;
        validatedFields.emergencyContactPhone = input.emergencyContactPhone;
      }
    }

    // ─── Return validation errors early ──────────────────────────────────────
    if (validationErrors.length > 0) {
      return {
        success: false,
        employeeId: input.employeeId,
        employeeName: input.employeeName,
        validationErrors,
        message: `Please correct the following issues before we can proceed:\n${validationErrors.join("\n")}`,
      };
    }

    // ─── Store via Lua Data API (create or update) ───────────────────────────
    const record = {
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      country: input.country,
      collectedAt: new Date().toISOString(),
      ...validatedFields,
    };

    // Try to update existing, otherwise create new
    try {
      const existing = await Data.get("onboarding_documents", { employeeId: input.employeeId });
      if (existing.data && existing.data.length > 0) {
        await Data.update("onboarding_documents", existing.data[0].id, record);
      } else {
        await Data.create("onboarding_documents", record, `onboarding-${input.employeeId}`);
      }
    } catch {
      // If collection doesn't exist yet, create silently
      await Data.create("onboarding_documents", record, `onboarding-${input.employeeId}`);
    }

    // ─── Build summary ────────────────────────────────────────────────────────
    const collected: string[] = [];
    if (validatedFields.iqamaNumber) collected.push("✅ Iqama Number");
    if (validatedFields.nationalId) collected.push("✅ National ID");
    if (validatedFields.iban) collected.push("✅ IBAN");
    if (validatedFields.emergencyContactName) collected.push("✅ Emergency Contact");

    const missing: string[] = [];
    const needsIqama = ["KSA", "UAE"].includes(input.country) && !validatedFields.iqamaNumber;
    const needsId = ["EGY", "JOR"].includes(input.country) && !validatedFields.nationalId;
    if (needsIqama) missing.push("⏳ Iqama Number");
    if (needsId) missing.push("⏳ National ID");
    if (!validatedFields.iban) missing.push("⏳ IBAN (for salary payments)");
    if (!validatedFields.emergencyContactName) missing.push("⏳ Emergency Contact details");

    return {
      success: true,
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      country: input.country,
      documentsCollected: collected,
      documentsPending: missing,
      allDocumentsComplete: missing.length === 0,
      message:
        missing.length === 0
          ? `🎉 All required documents for ${input.employeeName} have been collected and stored successfully! You can now proceed to generate the onboarding checklist.`
          : `✅ Documents recorded! Still needed from ${input.employeeName}: ${missing.join(", ")}. Please provide the remaining items to complete onboarding.`,
    };
  }
}
