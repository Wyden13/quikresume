import React from "react";
import { cn } from "@/lib/cn";
import { Badge, type BadgeTone } from "@/components/ui/primitives/badge";
import { FLAG_LABEL, type ItemReview } from "@/lib/review/types";

export const scoreTone = (score: number): BadgeTone => (score >= 8 ? "success" : score >= 6 ? "neutral" : "warning");

/** "7/10" coach score; greyed out when the text changed since the review. */
export function ScoreBadge({ review, outdated, className }: { review: ItemReview; outdated?: boolean; className?: string }) {
    const flags = review.flags.map(f => FLAG_LABEL[f]).join(", ");
    return (
        <Badge
            tone={outdated ? "neutral" : scoreTone(review.score)}
            className={cn("tabular-nums", outdated && "text-fg-subtle", className)}
            title={outdated ? "Coach score for an earlier version of this text" : `Coach score${flags ? `: ${flags}` : ""}`}
        >
            {review.score}/10
        </Badge>
    );
}
