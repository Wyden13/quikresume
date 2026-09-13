// src/lib/match/prompt.ts
// Prompts for Job Match: JD -> requirements, and gap -> proposals.

import { TAG_KINDS } from "@/lib/tags/types";
import type { Requirement } from "@/lib/match/types";

export const JD_MAX_CHARS = 30_000;

export const JD_SYSTEM_PROMPT = `You analyse job postings for a resume builder. Turn the posting into structured requirements that can be matched against a candidate's skill tags.

Output ONE JSON object and nothing else:
{"title":"<job title>","company":"<company or empty>","summary":"<one or two sentences on the role>","requirements":[{"name":"<canonical skill/keyword>","kind":"<kind>","importance":"must"|"nice","yearsMin":<number or null>}]}

Kinds (exact ids): ${TAG_KINDS.map(k => k.id).join(", ")}.
- technical-skill: languages, frameworks, concepts. tool-platform: products, clouds, tools. domain: industries / problem areas. soft-skill: interpersonal traits. methodology: ways of working (Agile, CI/CD). credential: degrees, certifications, clearances. language: human languages.

Rules:
- 8 to 30 requirements. Merge duplicates. Skip generic filler ("team player", "fast-paced environment") unless the posting stresses it.
- "must": stated as required / must / minimum qualifications, or clearly central to the role. "nice": preferred / bonus / plus.
- Canonical names as commonly written: "PostgreSQL", "Node.js", "Amazon Web Services", "Machine Learning", "CI/CD", "Bachelor of Science". Split compounds ("React/Vue" -> two entries). No version numbers.
- Degree requirements become two entries: the level ("Bachelor of Science", credential) and the field ("Computer Science", credential). "or equivalent experience" keeps them as "nice".
- yearsMin only when the posting states a number of years for that requirement (e.g. "5+ years of Go" -> Go with yearsMin 5).
- Never invent requirements that are not in the posting.
- Valid JSON only. No markdown.`;

export function jdUserMessage(text: string): string {
    return `Job posting:\n\n${text.slice(0, JD_MAX_CHARS)}`;
}

export const PROPOSAL_SYSTEM_PROMPT = `You are a resume coach. Given a job's requirements, which of them the candidate's resume already covers, and the candidate's actual resume items, propose concrete, honest improvements.

Output ONE JSON object and nothing else:
{"proposals":[
  {"kind":"rewrite-bullet","itemId":"<id>","current":"<exact existing bullet>","proposed":"<rewritten bullet>","tags":["<requirement name>"],"reason":"<why>"},
  {"kind":"add-skill","itemId":"<skills category id>","proposed":"<skill name>","tags":["<requirement name>"],"reason":"<why>"},
  {"kind":"gap","tags":["<requirement name>"],"reason":"<what is missing and what would close it>"}
]}

Rules:
- At most 10 proposals. Prioritise must-have requirements that are missing or only weakly covered.
- rewrite-bullet: "current" must be copied verbatim from the item's bullets. The rewrite keeps every fact, adds the requirement's keyword only where the bullet already evidences it, and may make impact more concrete. Never invent numbers, tools or outcomes.
- add-skill: only when the skill is genuinely evidenced by the candidate's other items (a tag on a work/project item) but missing from the skills section. Use the id of the best-fitting skills category.
- gap: for requirements nothing in the library supports. Say plainly what would close it (a course, a project, a certification). Do not suggest lying.
- Do not propose anything for requirements listed as muted.
- Valid JSON only. No markdown.`;

export interface ProposalPromptItem {
    id: string;
    section: string;
    label: string;
    bullets: string[];
    tags: string[];
}

export function proposalUserMessage(input: {
    job: { title: string; company: string; summary: string };
    requirements: Requirement[];
    coverage: { name: string; strength: number }[];
    items: ProposalPromptItem[];
    skillCategories: { id: string; category: string; items: string }[];
    muted: string[];
}): string {
    return JSON.stringify({
        job: input.job,
        requirements: input.requirements.map(r => ({ name: r.display, importance: r.importance, kind: r.kind })),
        coverage: input.coverage,
        items: input.items,
        skillCategories: input.skillCategories,
        mutedRequirements: input.muted,
    });
}
