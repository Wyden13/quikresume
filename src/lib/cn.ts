// Tiny class joiner; the app has no conditional-merge needs that warrant tailwind-merge.
export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");
