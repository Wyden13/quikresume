import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Crawlers that collect pages to train or ground generative models. Search engines are welcome
// (see the catch-all rule below); these are not. Blocking here is advisory - it is honoured by the
// operators that publish these tokens, and nothing more.
const AI_CRAWLERS = [
    "GPTBot",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "CCBot",
    "Google-Extended",
    "Applebot-Extended",
    "FacebookBot",
    "Meta-ExternalAgent",
    "Meta-ExternalFetcher",
    "Bytespider",
    "PerplexityBot",
    "Amazonbot",
    "cohere-ai",
    "cohere-training-data-crawler",
    "Diffbot",
    "ImagesiftBot",
    "Omgilibot",
    "Omgili",
    "YouBot",
    "AI2Bot",
    "AI2Bot-Dolma",
    "Timpibot",
    "Webzio-Extended",
    "PanguBot",
    "SemrushBot-OCOB",
    "TikTokSpider",
    "DuckAssistBot",
    "Scrapy",
];

// Nothing behind sign-in, and no route handlers, belong in an index.
const PRIVATE_PATHS = ["/dashboard", "/dashboard/", "/api/", "/login"];

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            { userAgent: AI_CRAWLERS, disallow: "/" },
            { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
