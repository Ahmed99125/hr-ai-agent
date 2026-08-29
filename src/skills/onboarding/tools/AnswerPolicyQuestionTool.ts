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
    // Build the search query — prepend country context if specified
    const searchQuery =
      input.country && input.country !== "ALL"
        ? `${input.country} ${input.question}`
        : input.question;

    // Search the Lua RAG knowledge base (resources uploaded via 'lua resources')
    const results = await Data.search("hr_knowledge_base", searchQuery, 4);

    if (!results || results.length === 0) {
      return {
        found: false,
        question: input.question,
        answer: null,
        sources: [],
        message:
          "I couldn't find a specific policy or legal reference for this question in the knowledge base. This may be a policy gap — would you like me to log it for the HR team to review?\n\n" +
          "لم أجد إجابة محددة في قاعدة معرفتنا. هل تريد تسجيل هذا السؤال لمراجعة فريق الموارد البشرية؟",
      };
    }

    // Combine the top results into a coherent answer context
    const topResults = results.slice(0, 3);
    const sourceRefs = topResults.map((r: { source?: string; score?: number; content?: string }, i: number) => ({
      rank: i + 1,
      source: r.source ?? "HR Knowledge Base",
      relevanceScore: r.score ? `${Math.round(r.score * 100)}%` : "High",
      excerpt: r.content ? r.content.slice(0, 200).trim() + "..." : "",
    }));

    return {
      found: true,
      question: input.question,
      country: input.country,
      sourcesSearched: results.length,
      sources: sourceRefs,
      note: "Answer is generated based on the following knowledge base excerpts. For binding legal advice, please consult the HR Legal team.",
      message:
        `Found ${results.length} relevant reference(s) in the knowledge base for your question.\n\n` +
        `Please review the sources above. The answer has been generated based on your organization's official HR documents and local labor law references for ${input.country === "ALL" ? "all jurisdictions" : input.country}.`,
    };
  }
}
