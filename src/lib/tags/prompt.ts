// src/lib/tags/prompt.ts
// Prompt for the smart-tag extractor (text model, JSON mode). Tuned here, sent
// by src/lib/tags/extract.ts.

import { TAG_KINDS } from "@/lib/tags/types";
import type { TagInput } from "@/lib/tags/content";
import { sanitizeForPrompt, UNTRUSTED_INPUT_RULE } from "@/lib/security/prompt";

const KIND_GUIDE = `- technical-skill: programming languages, frameworks, libraries, concepts you *do* (e.g. "Python", "React", "Distributed Systems", "Data Modeling", "Unit Testing").
- tool-platform: products, clouds, services and tools (e.g. "PostgreSQL", "Docker", "Amazon Web Services", "Jira", "Figma", "Git").
- domain: industries and problem areas (e.g. "Fintech", "Healthcare", "Computer Vision", "E-commerce", "Education").
- soft-skill: interpersonal and working traits evidenced by the text (e.g. "Leadership", "Mentoring", "Public Speaking", "Cross-functional Collaboration").
- methodology: ways of working (e.g. "Agile", "Scrum", "Test-Driven Development", "CI/CD", "Design Thinking").
- credential: degrees, majors, certifications, licences, awards as credentials (e.g. "Bachelor of Science", "Computer Science", "AWS Certified Solutions Architect", "Dean's List").
- language: human languages only (e.g. "English", "French"). Never programming languages.`;

export const TAG_SYSTEM_PROMPT = `You are a skills taxonomist for a resume builder. You receive resume items and return the skills and keywords each item evidences, as tags with a kind.

Input: a JSON object {"candidate":"<background on the candidate, may be empty>","items":[{"id":"...","section":"...","text":"..."}]}.
Output: ONE JSON object and nothing else:
{"items":[{"id":"<same id>","tags":[{"name":"<canonical name>","kind":"<kind>"}]}],"aliases":{"<form used in the text>":"<canonical name>"}}

Kinds (use exactly these ids: ${TAG_KINDS.map(k => k.id).join(", ")}):
${KIND_GUIDE}

Rules:
- Return every input id exactly once, in the same order. Never invent ids.
- 3 to 12 tags per item; fewer for tiny items (a language entry may have 1).
- Tag what the text evidences, including what it clearly implies. Reason like a senior engineer reading the item, not like a keyword matcher:
  * Name the recognised concept behind a description even when the word is absent: "split the backend into 5 services talking over HTTP" -> "Microservices"; "trained a CNN on 50k images" -> "Deep Learning", "Computer Vision"; "designed the schema and wrote the queries" -> "SQL", "Data Modeling"; "handled 10k requests/s" -> "Scalability"; "wrote a scheduler for a toy OS" -> "Operating Systems".
  * Tag the broad field a project or role plainly sits in as a domain, the way a recruiter would file it: a compiler, an OS scheduler, a distributed key-value store or an algorithms coursework project -> "Computer Science"; a trading bot -> "Fintech"; a patient portal -> "Healthcare".
  * Products, tools and platforms (kind tool-platform) only when they are actually named. Never invent numbers, tools or outcomes.
- "candidate" is background only (headline, degrees, summary). Use it to resolve ambiguity and to decide which field an item belongs to; do not copy its skills onto items that do not evidence them.
- Canonical names: the common industry spelling, capitalised as usually written ("PostgreSQL", "Node.js", "Machine Learning", "CI/CD"). No version numbers ("Python", not "Python 3.11"). 1 to 4 words. Split compounds: "React/Redux" -> "React" and "Redux"; "HTML/CSS" -> "HTML" and "CSS".
- A skills section item ("Skills (Languages): Python, Go, SQL") gets one tag per listed skill, plus nothing else.
- Education items: tag the specific degree ("Bachelor of Science"), the generic level as its own credential tag ("Bachelor's Degree" / "Master's Degree" / "Doctorate"), the major ("Computer Science"), notable minors and clearly listed coursework topics (as technical-skill), and honours ("Dean's List" as credential). "B.Sc. Computer Science" therefore yields at least "Bachelor of Science", "Bachelor's Degree" and "Computer Science".
- Work, project and volunteering items: tag the technologies, domains, methodologies and clearly evidenced soft skills (leading a team -> "Leadership"; presenting to clients -> "Client Communication").
- "aliases": only when the text used a different form than the canonical name (e.g. "Postgres" -> "PostgreSQL", "JS" -> "JavaScript"). Omit or leave {} otherwise.
- Output must be valid JSON. No markdown, no commentary.
${UNTRUSTED_INPUT_RULE}`;

export function tagUserMessage(inputs: TagInput[], context = ""): string {
    return JSON.stringify({
        candidate: sanitizeForPrompt(context, 1500),
        items: inputs.map(i => ({ id: i.id, section: i.section, text: sanitizeForPrompt(i.text, 4000) })),
    });
}
