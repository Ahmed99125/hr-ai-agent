/**
 * AnswerPolicyQuestionTool.ts
 *
 * Answers HR policy and labor law questions by performing
 * semantic search against the RAG knowledge base using Lua's Data API.
 * Covers: Saudi/UAE/Egypt/Jordan labor law, probation, leave,
 * Nitaqat, SOPs, and company policies.
 */

import { LuaTool, Data } from "lua-cli";
import { z } from "zod";

export class AnswerPolicyQuestionTool implements LuaTool {
  name = "answer_policy_question";
  description =
    "Search the HR knowledge base to answer questions about labor laws (KSA/UAE/Egypt/Jordan), probation periods, leave entitlements, Nitaqat/Saudization, and company SOPs (salary certificates, visa processes, medical insurance, etc.). Returns the answer with source references.";

  inputSchema = z.object({
    question: z
      .string()
      .min(5)
      .describe("The HR policy question to answer (in Arabic or English). Examples: 'What is the probation period in Saudi Arabia?', 'How do I get a salary certificate?', 'ما هي إجازة الأمومة في الإمارات؟'"),
    country: z
      .enum(["KSA", "UAE", "EGY", "JOR", "ALL"])
      .optional()
      .default("ALL")
      .describe("Narrow the search to a specific country's laws. Use 'ALL' to search across all jurisdictions."),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    // Map country acronyms to bilingual names for better semantic search results in both languages
    const countryMap: Record<string, string> = {
      KSA: "Saudi Arabia السعودية",
      UAE: "UAE الإمارات",
      EGY: "Egypt مصر",
      JOR: "Jordan الأردن",
    };

    // Build the search query — prepend full country name if specified
    const countryName = input.country && input.country !== "ALL" ? countryMap[input.country] : null;
    const searchQuery = countryName ? `${countryName} ${input.question}` : input.question;

    // Search the Lua RAG knowledge base (resources uploaded via 'lua resources')
    const results = await Data.search("hr_knowledge_base", searchQuery, 4);

    if (!results || results.length === 0) {
      return {
        found: false,
        question: input.question,
        country: input.country,
        instructionsForAgent:
          "No policies or legal references were found for this question in the knowledge base. " +
          "Apologize to the user IN THEIR EXACT LANGUAGE and ask if they would like you to log this as a policy gap for the HR team to review. " +
          "Do not use Arabic if the user spoke English.",
      };
    }

    // Combine the top results into a coherent answer context
    const topResults = results.slice(0, 3);
    const contextRefs = topResults.map((r: { source?: string; score?: number; content?: string }, i: number) => ({
      rank: i + 1,
      source: r.source ?? "HR Knowledge Base",
      relevanceScore: r.score ? `${Math.round(r.score * 100)}%` : "High",
      content: r.content ?? "",
    }));

    return {
      found: true,
      question: input.question,
      country: input.country,
      sourcesSearched: results.length,
      context: contextRefs,
      instructionsForAgent:
        "Using the context provided above, synthesize a clear and accurate answer to the user's question in their language. " +
        "Do not just echo the context back or ask the user to review it. Actually answer their question based strictly on the provided text. " +
        "Include a small disclaimer that for binding legal advice they should consult the HR Legal team.",
    };
  }
}
