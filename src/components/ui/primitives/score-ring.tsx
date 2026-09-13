import React from "react";

export function scoreColor(score: number) {
    return score >= 75 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--danger)";
}

export function ScoreRing({ score, size = 40, className }: { score: number; size?: number; className?: string }) {
    const stroke = Math.max(3, Math.round(size / 10));
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={`Match score ${score}`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none" stroke={scoreColor(score)} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
            <text x="50%" y="50%" dy="0.36em" textAnchor="middle" fontSize={size * 0.32} fontWeight={600} fill="var(--fg)">{score}</text>
        </svg>
    );
}
