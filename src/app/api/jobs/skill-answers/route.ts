// src/app/api/jobs/skill-answers/route.ts
// POST { answers: [{ name, display, kind, hard, have, categoryId?, example?, itemId? }] } -> { ok, resume, declined, warning? }.
// The tailor window's questionnaire, for job requirements nothing in the library covers.
// "Yes" on a soft requirement appends it to the printed "Soft skills" category; "Yes" on a hard
// requirement appends it to the skill category the user picked, or the one the text model
// picks (a new "Technical skills" category when nothing fits). An example becomes one
// AI-worded bullet on the item the user picked. Touched items are re-tagged and additionally
// carry the answered requirement's tag, so coverage is immediate even if tagging fails.
// "No" is remembered in meta/preferences.declinedSoftSkills (hard and soft; warned about on
// later jobs until answered Yes).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { auth } from "@/auth";
import { chatCompletion, isGlmConfigured, textModel } from "@/lib/glm/client";
import { extractJson } from "@/lib/import/parsed-resume";
import { mergeTagAliases, readTagAliases } from "@/lib/db/meta";
import { readPreferences, writePreferences } from "@/lib/db/jobs";
import { userCol } from "@/lib/db/user-collection";
import { db } from "@/lib/firestore";
import { loadResumeData } from "@/lib/db/load-resume";
import { SKILL_BULLET_SYSTEM_PROMPT, SKILL_CATEGORY_SYSTEM_PROMPT, skillBulletUserMessage, skillCategoryUserMessage } from "@/lib/match/prompt";
import type { DeclinedSkill } from "@/lib/match/types";
import { contentHashOf, itemText, tagContext, type TagInput } from "@/lib/tags/content";
import { extractTags } from "@/lib/tags/extract";
import { isTagKind, type Tag, type TagKind } from "@/lib/tags/types";
import { SECTION_COLLECTION, itemTitle } from "@/lib/sections";
import { skillEntries, skillKey } from "@/lib/sub-items";
import { toBullets } from "@/lib/typst/doc";
import type { ResumeData, ResumeListKey } from "@/types/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const SOFT_CATEGORY = "Soft skills";
const HARD_CATEGORY = "Technical skills";
const BULLET_SECTIONS: ResumeListKey[] = ["workExperience", "projects", "volunteering"];

interface Answer {
    name: string;
    display: string;
    kind: TagKind;
    /** Hard requirement (goes into a technical category, not "Soft skills"). */
    hard: boolean;
    have: boolean;
    /** Skill category id picked by the user; "" lets the text model pick. */
    categoryId: string;
    example: string;
    itemId: string;
}

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

function readAnswers(v: unknown): Answer[] {
    if (!Array.isArray(v)) return [];
    const out: Answer[] = [];
    for (const r of v.slice(0, 60)) {
        if (!r || typeof r !== "object") continue;
        const o = r as Record<string, unknown>;
        if (typeof o.name !== "string" || !o.name.trim() || typeof o.have !== "boolean") continue;
        out.push({
            name: o.name.trim().slice(0, 120),
            display: (typeof o.display === "string" && o.display.trim() ? o.display : o.name).trim().slice(0, 120),
            kind: isTagKind(o.kind) ? o.kind : "soft-skill",
            hard: o.hard === true,
            have: o.have,
            categoryId: typeof o.categoryId === "string" ? o.categoryId : "",
            example: typeof o.example === "string" ? o.example.trim().slice(0, 600) : "",
            itemId: typeof o.itemId === "string" ? o.itemId : "",
        });
    }
    return out;
}

const unionTags = (a: Tag[], b: Tag[]) => {
    const seen = new Set(a.map(t => t.name));
    return [...a, ...b.filter(t => !seen.has(t.name) && seen.add(t.name))];
};

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return fail(401, "You need to be signed in.");
        const uid = session.user.id;

        let body: { answers?: unknown };
        try {
            body = await req.json();
        } catch {
            return fail(400, "Expected a JSON body.");
        }
        const answers = readAnswers(body.answers);
        if (answers.length === 0) return fail(400, "No answers to save.");

        const [data, prefs, aliases] = await Promise.all([loadResumeData(uid), readPreferences(uid), readTagAliases(uid)]);
        const yes = answers.filter(a => a.have);
        const no = answers.filter(a => !a.have);
        const warnings: string[] = [];
        const now = Timestamp.now();

        // In-memory copies of the items we touch: key -> item (post-change), plus the tags to force on.
        const touched = new Map<string, { key: ResumeListKey; item: ResumeData[ResumeListKey][number]; forced: Tag[]; isNew: boolean }>();
        const reqTag = (a: Answer): Tag => ({ name: a.name, display: a.display, kind: a.kind });

        type Skill = ResumeData["skills"][number];
        const categoryNamed = (name: string): Skill | undefined => {
            const lower = name.trim().toLowerCase();
            const pending = [...touched.values()].find(t => t.key === "skills" && (t.item as Skill).category.trim().toLowerCase() === lower);
            return (pending?.item as Skill | undefined) ?? data.skills.find(s => s.category.trim().toLowerCase() === lower);
        };
        /** Appends the answered skills to a category (an existing item, or a new one by name). */
        const addSkills = (target: Skill | string, group: Answer[]) => {
            const found = typeof target === "string" ? categoryNamed(target) : target;
            const current = found ? ((touched.get(found.id)?.item as Skill | undefined) ?? found) : undefined;
            const entries = skillEntries(current?.items);
            const have = new Set(entries.map(e => e.key));
            const added = group.map(a => a.display).filter(d => { const k = skillKey(d); return !have.has(k) && have.add(k); });
            const items = [...entries.map(e => e.label), ...added].join(", ");
            const item: Skill = current
                ? { ...current, items }
                : { id: userCol(uid, "skills").doc().id, category: target as string, items, isSelected: true, hidden: [], tags: [], tagsHash: null };
            const prev = touched.get(item.id);
            touched.set(item.id, { key: "skills", item, forced: unionTags(prev?.forced ?? [], group.map(reqTag)), isNew: prev?.isNew ?? !current });
        };

        // 1. Soft requirements -> "Soft skills" category.
        const softYes = yes.filter(a => !a.hard);
        if (softYes.length > 0) addSkills(SOFT_CATEGORY, softYes);

        // 2. Hard requirements -> the picked category, else the model's pick, else "Technical skills".
        const hardYes = yes.filter(a => a.hard);
        const categoryById = new Map(data.skills.map(s => [s.id, s]));
        const unplaced = hardYes.filter(a => !categoryById.has(a.categoryId));
        const placed = new Map<string, string>();
        const candidates = data.skills.filter(s => s.category.trim().toLowerCase() !== SOFT_CATEGORY.toLowerCase());

        // 3. Examples -> one bullet each on the picked item (worded while the categories are picked).
        const withExample = yes.filter(a => a.example && a.itemId);
        const itemIndex = new Map<string, { key: ResumeListKey; item: ResumeData[ResumeListKey][number] }>();
        for (const key of BULLET_SECTIONS) for (const item of data[key]) itemIndex.set(item.id, { key, item });
        const bulletFor = new Map<number, string>();
        const examples = withExample.map((a, i) => ({ i, a, target: itemIndex.get(a.itemId) })).filter(x => x.target);

        const pickCategories = async () => {
            if (unplaced.length === 0 || candidates.length === 0) return;
            try {
                if (!isGlmConfigured()) throw new Error("GLM not configured");
                const result = await chatCompletion(
                    [
                        { role: "system", content: SKILL_CATEGORY_SYSTEM_PROMPT },
                        { role: "user", content: skillCategoryUserMessage({ categories: candidates.map(s => ({ id: s.id, name: s.category, skills: skillEntries(s.items).map(e => e.label) })), skills: unplaced.map(a => a.display) }) },
                    ],
                    { model: textModel(), json: true, effort: "low", temperature: 0.1, maxTokens: 2000, timeoutMs: 30_000, retries: 0 },
                );
                const json = extractJson(result.text) as { placements?: unknown };
                for (const p of Array.isArray(json.placements) ? json.placements : []) {
                    const o = p as Record<string, unknown>;
                    if (typeof o?.skill === "string" && typeof o.categoryId === "string" && candidates.some(s => s.id === o.categoryId)) placed.set(o.skill.trim().toLowerCase(), o.categoryId);
                }
            } catch (err) {
                console.error("[jobs/skill-answers] category pick failed:", err);
                warnings.push(`The AI could not pick a category, so new skills went into "${HARD_CATEGORY}".`);
            }
        };
        const wordBullets = async () => {
            if (examples.length === 0) return;
            try {
                if (!isGlmConfigured()) throw new Error("GLM not configured");
                const result = await chatCompletion(
                    [
                        { role: "system", content: SKILL_BULLET_SYSTEM_PROMPT },
                        { role: "user", content: skillBulletUserMessage(examples.map(x => ({ key: String(x.i), skill: x.a.display, item: itemTitle(x.target!.key, x.target!.item), example: x.a.example }))) },
                    ],
                    { model: textModel(), json: true, effort: "low", temperature: 0.3, maxTokens: 3000, timeoutMs: 40_000, retries: 0 },
                );
                const json = extractJson(result.text) as { bullets?: unknown };
                for (const b of Array.isArray(json.bullets) ? json.bullets : []) {
                    const o = b as Record<string, unknown>;
                    if (typeof o?.key === "string" && typeof o.bullet === "string" && o.bullet.trim()) bulletFor.set(Number(o.key), o.bullet.trim().slice(0, 300));
                }
            } catch (err) {
                console.error("[jobs/skill-answers] bullet wording failed:", err);
                warnings.push("The AI could not word your examples, so they were added as you wrote them.");
            }
        };
        await Promise.all([pickCategories(), wordBullets()]);

        const byCategory = new Map<string, Answer[]>();
        for (const a of hardYes) {
            const id = categoryById.has(a.categoryId) ? a.categoryId : placed.get(a.display.trim().toLowerCase()) ?? "";
            byCategory.set(id, [...(byCategory.get(id) ?? []), a]);
        }
        for (const [id, group] of byCategory) addSkills(categoryById.get(id) ?? HARD_CATEGORY, group);

        for (const x of examples) {
            const { key, item } = x.target!;
            const current = touched.get(item.id)?.item ?? item;
            const bullet = bulletFor.get(x.i) ?? x.a.example;
            const description = [...toBullets((current as ResumeData["workExperience"][number]).description), bullet].join("\n");
            const prev = touched.get(item.id);
            touched.set(item.id, { key, item: { ...current, description } as typeof item, forced: unionTags(prev?.forced ?? [], [reqTag(x.a)]), isNew: false });
        }

        // 4. Re-tag touched items (bounded), then force the answered requirement tags on.
        let tagsById: Record<string, Tag[]> = {};
        if (touched.size > 0 && isGlmConfigured()) {
            const inputs: TagInput[] = [...touched.values()].map(t => ({ id: t.item.id, section: t.key, text: itemText(t.key, t.item) }));
            try {
                const res = await extractTags(inputs, aliases, { budgetMs: 30_000, context: tagContext(data) });
                tagsById = res.tagsById;
                await mergeTagAliases(uid, res.aliases);
            } catch (err) {
                console.error("[jobs/skill-answers] tagging failed:", err);
                warnings.push("Skill analysis did not finish; the answered skills still count for matching.");
            }
        }

        const batch = db.batch();
        for (const t of touched.values()) {
            const hash = contentHashOf(t.key, t.item);
            const tags = unionTags(tagsById[t.item.id] ?? t.item.tags, t.forced);
            const ref = userCol(uid, SECTION_COLLECTION[t.key]).doc(t.item.id);
            const content = t.key === "skills"
                ? { category: (t.item as ResumeData["skills"][number]).category, items: (t.item as ResumeData["skills"][number]).items }
                : { description: toBullets((t.item as ResumeData["workExperience"][number]).description) };
            const fields = { ...content, tags, contentHash: hash, tagsHash: hash, taggedAt: now, updatedAt: now };
            if (t.isNew) batch.set(ref, { ...fields, isSelected: true, hidden: [], createdAt: now });
            else batch.update(ref, fields);
        }

        // 5. Declined list: drop answered-Yes, upsert answered-No.
        const yesNames = new Set(yes.map(a => a.name));
        const declined: DeclinedSkill[] = prefs.declinedSoftSkills.filter(d => !yesNames.has(d.name));
        for (const a of no) if (!declined.some(d => d.name === a.name)) declined.push({ name: a.name, display: a.display, at: now.toDate().toISOString() });

        await batch.commit();
        await writePreferences(uid, { declinedSoftSkills: declined });
        revalidatePath("/dashboard");

        return NextResponse.json({ ok: true, resume: await loadResumeData(uid), declined, warning: warnings.join(" ") || undefined });
    } catch (err) {
        console.error("[jobs/skill-answers] failed:", err);
        return fail(500, err instanceof Error ? err.message : "Could not save your answers.");
    }
}
