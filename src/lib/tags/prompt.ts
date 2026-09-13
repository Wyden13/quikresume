// src/lib/tags/prompt.ts
// Prompt for the smart-tag extractor (text model, JSON mode). Tuned here, sent
// by src/lib/tags/extract.ts.

import { TAG_KINDS } from "@/lib/tags/types";
import type { TagInput } from "@/lib/tags/content";

const KIND_GUIDE = `- technical-skill: programming languages, frameworks, libraries, concepts you *do* (e.g. "Python", "React", "Distributed Systems", "Data Modeling", "Unit Testing").
- tool-platform: products, clouds, services and tools (e.g. "PostgreSQL", "Docker", "Amazon Web Services", "Jira", "Figma", "Git").
- domain: industries and problem areas (e.g. "Fintech", "Healthcare", "Computer Vision", "E-commerce", "Education").
- soft-skill: interpersonal and working traits evidenced by the text (e.g. "Leadership", "Mentoring", "Public Speaking", "Cross-functional Collaboration").
- methodology: ways of working (e.g. "Agile", "Scrum", "Test-Driven Development", "CI/CD", "Design Thinking").
- credential: degrees, majors, certifications, licences, awards as credentials (e.g. "Bachelor of Science", "Computer Science", "AWS Certified Solutions Architect", "Dean's List").
- language: human languages only (e.g. "English", "French"). Never programming languages.`;

export const TAG_SYSTEM_PROMPT = `You are a skills taxonomist for a resume builder. You receive resume items and return the skills and keywords each item evidences, as tags with a kind.

Input: a JSON object {"items":[{"id":"...","section":"...","text":"..."}]}.
Output: ONE JSON object and nothing else:
{"items":[{"id":"<same id>","tags":[{"name":"<canonical name>","kind":"<kind>"}]}],"aliases":{"<form used in the text>":"<canonical name>"}}

Kinds (use exactly these ids: ${TAG_KINDS.map(k => k.id).join(", ")}):
${KIND_GUIDE}

Rules:
- Return every input id exactly once, in the same order. Never invent ids.
- 3 to 12 tags per item; fewer for tiny items (a language entry may have 1).
- Only tag what the text evidences. Never guess skills the item does not mention or clearly imply.
- Canonical names: the common industry spelling, capitalised as usually written ("PostgreSQL", "Node.js", "Machine Learning", "CI/CD"). No version numbers ("Python", not "Python 3.11"). 1 to 4 words. Split compounds: "React/Redux" -> "React" and "Redux"; "HTML/CSS" -> "HTML" and "CSS".
- A skills section item ("Skills (Languages): Python, Go, SQL") gets one tag per listed skill, plus nothing else.
- Education items: tag the degree level ("Bachelor of Science"), the major ("Computer Science"), notable minors and clearly listed coursework topics (as technical-skill), and honours ("Dean's List" as credential).
- Work, project and volunteering items: tag the technologies, domains, methodologies and clearly evidenced soft skills (leading a team -> "Leadership"; presenting to clients -> "Client Communication").
- "aliases": only when the text used a different form than the canonical name (e.g. "Postgres" -> "PostgreSQL", "JS" -> "JavaScript"). Omit or leave {} otherwise.
- Output must be valid JSON. No markdown, no commentary.`;

export function tagUserMessage(inputs: TagInput[]): string {
    return JSON.stringify({ items: inputs.map(i => ({ id: i.id, section: i.section, text: i.text.slice(0, 4000) })) });
}
