# Fix: render markdown in chat answers

## Summary

Assistant answers in the chat and demo surfaces displayed raw markdown
syntax (literal `##`, `**`, `-`) instead of rendered headings, bold text, and
lists. Answers are now rendered as formatted markdown via `react-markdown`,
matching the Doppelscript chat implementation, while preserving PolicyPilot's
inline `[N]` citation badges.

## What changed

- Added `react-markdown@^10.1.0` to `apps/client/web` (same version Doppelscript
  uses).
- New `ChatAnswer` component (`src/components/ChatAnswer/`) that renders an
  assistant answer as markdown and turns `[N]` markers into clickable citation
  badges.
- New `remarkCitations` remark plugin that splits `[N]` markers out of markdown
  text nodes into `<cite>` nodes, which `ChatAnswer` maps to badge buttons.
- Chat page and demo page now render assistant messages through `ChatAnswer`;
  user questions still render as plain text (Doppelscript convention).
- Removed the duplicated inline `renderContent` string-splitter from both pages
  and the now-unused `.citationBadge` rule from both page stylesheets (moved to
  the component's own module).

## Architectural decisions

- **Citations via a remark plugin, not string splitting (chosen).** The old code
  split the raw answer string on `/(\[\d+\])/` and wrapped it in a single `<p>`,
  which is incompatible with block-level markdown. A remark plugin operates on
  the parsed mdast tree, so citations survive inside headings, list items, and
  bold runs. _Alternative:_ post-process react-markdown's rendered output, or
  regex the string before parsing. Rejected: both reintroduce the fragility that
  caused the bug and break when a citation sits inside other markup.
- **Shared `ChatAnswer` component (chosen).** The chat and demo pages had a
  byte-identical `renderContent`. Extracting one component removes the
  duplication and gives the markdown styles a single home (R-234 reuse).
- **No `remark-gfm` (chosen).** Doppelscript renders with stock react-markdown;
  the broken cases in the report (`##`, `**`, `-`) are all CommonMark core, so
  GFM is unnecessary. Kept the dependency surface minimal.
- **Read the citation index from the badge's text child.** Avoids threading a
  data attribute through mdast -> hast -> react-markdown props; the badge label
  is the number anyway.

## Testing

- New `ChatAnswer.test.tsx` (6 cases): heading/bold/list render as elements not
  literal syntax; `[N]` becomes a clickable badge that reports the citation;
  markdown + citation together; unmatched `[N]` stays literal text.
- New page-level case in `chat-collection.test.tsx`: a streamed markdown answer
  renders a heading and list item, with no literal `##` in the DOM.
- Full web suite: 137 passed. `pnpm lint` 0 errors, `tsc --noEmit` clean,
  `pnpm build` succeeds.

## Reflection

What I understand now: the bug wasn't "no markdown library," it was that the
answer was rendered as one plain `<p>`, so any markdown library bolted on top of
the old string-splitter would still fight the citation logic. The clean fix puts
citations _inside_ the markdown pipeline rather than around it.

What I got wrong first: I considered keeping the regex split and only wrapping
the non-citation segments in `<Markdown>`. That would have re-broken
block-level markdown (a heading split across segments) and produced invalid
nesting. Moving citation handling into a remark plugin was the right altitude.
