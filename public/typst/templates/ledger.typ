// "Ledger" résumé template — a pure styling template.
//
// It receives the resume document produced by src/lib/typst/doc.ts
// (see TypstResumeDoc there for the exact shape). Every field is a string
// (possibly empty) or an array; the app has already filtered out unselected
// items and pre-formatted date ranges. Templates never see raw markup:
// all user text is displayed as plain strings, so no escaping is needed.
//
// Exported entry point: `render(data)`.
// Fonts: Inter (vendored in public/typst/fonts). Falls back to Helvetica/Arial.

// ---------- Tokens ----------
#let ink = rgb("#292b31")
#let muted = rgb("#595d6c")
#let soft = rgb("#3f424d")
#let accent = rgb("#9184d9")
#let accent-deep = rgb("#5d5294")
#let rule = rgb("#cfd3e5")

// ---------- Helpers ----------
#let opt(x) = x != none and x != ""

// Joins the non-empty items of `parts` with `sep`.
#let join-present(parts, sep) = parts.filter(opt).join(sep)

// Ensures a URL has a scheme so `link()` produces a clickable target.
#let as-url(s) = if s.starts-with("http://") or s.starts-with("https://") { s } else { "https://" + s }

// Strips the scheme and trailing slash for a compact display label.
#let url-label(s) = {
  let t = s
  for prefix in ("https://", "http://", "www.") {
    if t.starts-with(prefix) { t = t.slice(prefix.len()) }
  }
  t.trim("/", at: end)
}

#let mailto-or-text(email) = link("mailto:" + email)[#email]

// Fading rule: solid at left, transparent at right.
#let fade-rule(color: rule) = box(
  width: 1fr, height: 1pt,
  fill: gradient.linear(color, color.transparentize(100%), angle: 0deg),
)

// Section heading + body. Returns nothing when the body is empty.
#let section(title, body) = {
  if body == none { return }
  v(4pt)
  block(breakable: false, below: 6pt, grid(
    columns: (auto, 1fr), column-gutter: 8pt, align: horizon,
    text(size: 8.5pt, weight: 500, tracking: 0.14em, fill: accent-deep, upper(title)),
    fade-rule(),
  ))
  body
  v(6pt)
}

// Entry with a right-aligned date (education, projects, experience).
#let entry(title, meta: "", date: "", body) = block(breakable: false, {
  grid(
    columns: (1fr, auto), column-gutter: 12pt,
    [#text(weight: 500, title)#if opt(meta) [ #text(fill: muted)[· #meta]]],
    text(fill: muted, date),
  )
  if body != none { v(2pt); body }
})

// Two-column label/value list.
#let kv(pairs) = grid(
  columns: (auto, 1fr), column-gutter: 14pt, row-gutter: 4pt,
  ..pairs.map(((k, v)) => (text(fill: muted, weight: 500, k), v)).flatten()
)

#let bullets(items) = if items.len() > 0 { list(..items) }

// Stacks entries with a small gap between them.
#let stack-entries(items, render-one) = {
  for (i, item) in items.enumerate() {
    if i > 0 { v(6pt) }
    render-one(item)
  }
}

// ---------- Section macros (one per section) ----------

#let header(h) = {
  let line1 = join-present((h.location, h.phone), " · ")
  let line2 = if opt(h.email) { mailto-or-text(h.email) } else { none }
  let links = ()
  if opt(h.github) { links.push(link(as-url(h.github))[#url-label(h.github)]) }
  if opt(h.linkedin) { links.push(link(as-url(h.linkedin))[#url-label(h.linkedin)]) }
  if opt(h.website) { links.push(link(as-url(h.website))[#url-label(h.website)]) }
  let contact-lines = ()
  if opt(line1) { contact-lines.push(line1) }
  if line2 != none { contact-lines.push(line2) }
  if links.len() > 0 { contact-lines.push(links.join(" · ")) }

  grid(
    columns: (1fr, auto), column-gutter: 16pt, align: bottom,
    [
      #text(size: 24pt, weight: 500, tracking: -0.01em)[#h.name] \
      #v(-2pt)
      #if opt(h.tagline) { text(fill: muted)[#h.tagline] }
    ],
    align(right, text(size: 9.5pt, fill: soft, contact-lines.join(linebreak()))),
  )
  v(9pt)
  box(width: 100%, height: 1pt, fill: gradient.linear(
    (accent, 0%), (accent, 60%), (accent.transparentize(100%), 100%), angle: 0deg))
  v(8pt)
}

#let summary(s) = if opt(s) { par(s) }

#let education(items) = if items.len() > 0 {
  stack-entries(items, e => {
    let facts = join-present((
      if opt(e.gpa) { "GPA " + e.gpa } else { "" },
      if opt(e.minor) { "Minor in " + e.minor } else { "" },
    ), " · ")
    let title = join-present((e.institution, e.title), " — ")
    entry(title, date: e.date, {
      if opt(facts) or opt(e.details) {
        text(fill: muted)[
          #if opt(facts) [#facts #if opt(e.details) [\ ]]
          #if opt(e.details) [#e.details]
        ]
      }
    })
  })
}

#let skills(items) = if items.len() > 0 {
  kv(items.map(i => (i.label, i.value)))
}

#let projects(items) = if items.len() > 0 {
  stack-entries(items, p => {
    let title = if opt(p.link) { link(as-url(p.link))[#p.title] } else { p.title }
    entry(title, meta: p.stack, date: p.date, bullets(p.bullets))
  })
}

#let experience(items) = if items.len() > 0 {
  stack-entries(items, x => entry(x.title, meta: x.company, date: x.date, bullets(x.bullets)))
}

#let certifications(items) = if items.len() > 0 {
  block(breakable: false, grid(
    columns: (1fr, auto), column-gutter: 12pt, row-gutter: 4pt,
    ..items.map(c => (
      [#c.name#if opt(c.issuer) [ #text(fill: muted)[· #c.issuer]]],
      text(fill: muted, c.year),
    )).flatten()
  ))
}

// ---------- Entry point ----------
#let render(data) = {
  set page(paper: "a4", margin: 16mm)
  set text(font: ("Inter", "Helvetica", "Arial"), size: 10.5pt, fill: ink)
  set par(leading: 0.55em, justify: false)
  show link: set text(fill: accent-deep)
  set list(indent: 4pt, body-indent: 6pt, marker: text(fill: muted)[•])

  header(data.header)
  section("Summary", summary(data.summary))
  section("Education", education(data.education))
  section("Skills", skills(data.skills))
  section("Projects", projects(data.projects))
  section("Experience", experience(data.experience))
  section("Certifications", certifications(data.certifications))
}
