# Judge Eval System: Design Spec

**Date:** 2026-06-11
**Status:** Approved
**Scope:** `scripts/eval/` -- offline developer tool, no running server required

## Goal

Measure PolicyPilot RAG quality across 5 dimensions and iteratively improve the pipeline until the run-level mean score exceeds **4.8 / 5.0**.

---

## Directory Layout

```
scripts/eval/
  fixtures/
    golden.json           <- generated Q&A pairs (committed to repo)
    results-latest.json   <- raw pipeline outputs (gitignored)
    scores-latest.json    <- judged scores (gitignored)
    recommendations.json  <- improvement loop output (gitignored)
  lib/
    types.ts              <- shared interfaces
    db.ts                 <- direct pgvector client (no Express)
    embed.ts              <- wraps OpenAI embedding call
  generate-golden.ts      <- step 1: Haiku + Sonnet -> golden.json
  run-eval.ts             <- step 2: questions -> pipeline -> results
  judge.ts                <- step 3: results -> Opus scores
  improve.ts              <- step 4: scores -> tune -> repeat
  report.ts               <- step 5: scores -> console summary
```

---

## Data Model

```ts
interface GoldenCase {
  id: string;
  collection: 'valve' | 'gitlab';
  question: string;
  referenceAnswer: string;
  generatorModel: string; // 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6'
}

interface EvalResult extends GoldenCase {
  retrievedChunks: CitedChunk[];
  answer: string;
  topK: number;
  promptVariant: string;
}

interface ScoredResult extends EvalResult {
  scores: {
    faithfulness: number;
    answerRelevance: number;
    citationAccuracy: number;
    completeness: number;
    contextRecall: number;
  };
  meanScore: number;
  judgeReasoning: string;
}

interface RunConfig {
  topK: number;
  promptVariant: string;
  variantLabel: string;
  collectionIds: { valve: string; gitlab: string };
}
```

---

## Step 1: Golden Set Generation (`generate-golden.ts`)

**Input:** Handbook chunks from DB (Valve + GitLab demo collections)
**Output:** `fixtures/golden.json` (committed; regeneration is explicit)
**Target:** 40-60 cases, balanced between collections and models

### Generation prompt (identical for both models)

```
You are generating evaluation test cases for a RAG system built on policy documents.

Given this chunk from a policy document, generate 2 questions that:
- Can be answered directly from this chunk alone
- Are specific (not "what does this document cover?")
- Vary in complexity: one factual lookup, one requiring inference

For each question, provide the ideal reference answer using ONLY information in this chunk.

Respond with JSON: [{ "question": "...", "referenceAnswer": "..." }, ...]

Chunk (from "${filename}", chunk ${index}):
${content}
```

### Filtering

- Skip chunks with `tokenCount < 80` (headers, boilerplate)
- Use Haiku to quality-score each generated pair 1-5; drop pairs below 3
- Deduplicate near-identical questions across models (string similarity > 0.85)

### Model differentiation

Both Haiku (`claude-haiku-4-5-20251001`) and Sonnet (`claude-sonnet-4-6`) generate pairs from the same chunks. Each `GoldenCase` records `generatorModel`. This avoids circular evaluation: the judge (Opus) does not score outputs against its own prior generations.

---

## Step 2: Eval Runner (`run-eval.ts`)

**Input:** `fixtures/golden.json` + `RunConfig`
**Output:** `fixtures/results-latest.json`

Replicates the production pipeline without the Express server:

1. Embed the question via `generateEmbedding()` (OpenAI `text-embedding-3-small`, 1536d)
2. Query pgvector with configured `topK` using cosine similarity, scoped to collection
3. Call Claude Sonnet (non-streaming) with the current `promptVariant` and assembled context

Processes cases in batches of 5 to respect rate limits. Partial results are written incrementally; a mid-run failure produces valid partial input for `judge.ts`.

---

## Step 3: Judge (`judge.ts`)

**Input:** `fixtures/results-latest.json`
**Output:** `fixtures/scores-latest.json`
**Model:** Claude Opus (`claude-opus-4-8`)

One API call per case, covering all 5 dimensions simultaneously.

### Judge prompt

```
You are evaluating a RAG system's answer quality. Score each dimension 1-5 (5 = perfect).

QUESTION: ${question}
REFERENCE ANSWER: ${referenceAnswer}
RETRIEVED CHUNKS: ${chunks as [1] filename: content...}
SYSTEM ANSWER: ${answer}

Score these dimensions:
- faithfulness: Does every claim come from the retrieved chunks? No hallucination?
- answerRelevance: Does the answer directly address the question?
- citationAccuracy: Are [n] markers used correctly and matched to the right chunks?
- completeness: Does the answer cover all relevant info present in the chunks?
- contextRecall: Did the retrieved chunks actually contain what was needed to answer?

Respond with JSON only:
{
  "scores": { "faithfulness": n, "answerRelevance": n, "citationAccuracy": n,
              "completeness": n, "contextRecall": n },
  "reasoning": "one sentence per dimension explaining the score"
}
```

### Scoring

- `meanScore` per case: unweighted average of 5 dimensions
- Run-level mean: mean of all `meanScore` values
- **4.8 target applies to the run-level mean**
- Dimension means are reported separately for the improvement loop

---

## Step 4: Improvement Loop (`improve.ts`)

**Input:** `fixtures/scores-latest.json`
**Output:** `scripts/eval/recommendations.json`
**Max iterations:** 10

Each round targets the lowest-scoring dimension using the appropriate lever:

| Failing dimension                                    | Lever                          |
| ---------------------------------------------------- | ------------------------------ |
| `faithfulness` / `citationAccuracy` / `completeness` | Prompt variant                 |
| `answerRelevance`                                    | Prompt variant + topK increase |
| `contextRecall`                                      | topK increase                  |

### Prompt tuning

When a prompt change is warranted, Opus generates 2 candidate variants targeting the failing dimension, given the current prompt and a summary of failing cases. Both are tested; the higher scorer is kept.

### TopK search

Tries `[4, 6, 8, 10, 12]` sequentially when `contextRecall` is the bottleneck. Stops at the first value that improves the score.

### Output

```json
{
  "finalMeanScore": 4.83,
  "bestTopK": 8,
  "bestPrompt": "...",
  "iterationsRun": 4,
  "dimensionScores": {
    "faithfulness": 4.9,
    "answerRelevance": 4.8,
    "citationAccuracy": 4.85,
    "completeness": 4.8,
    "contextRecall": 4.82
  },
  "changeLog": [
    { "round": 1, "change": "topK 6->8", "scoreDelta": 0.07 },
    {
      "round": 2,
      "change": "prompt: explicit citation grounding",
      "scoreDelta": 0.06
    }
  ]
}
```

The developer manually applies `bestPrompt` to `apps/server/src/prompts/qa-system.ts` and `bestTopK` to `apps/server/src/services/retrieval.service.ts`. The loop never modifies source files.

---

## Step 5: Reporter (`report.ts`)

**Input:** `fixtures/scores-latest.json`
**Flags:** `--compare <path>` diffs two score files side by side

```
PolicyPilot Eval Report
-----------------------------------------
Run: baseline | topK: 6 | Cases: 52

Dimension Scores (mean across all cases):
  Faithfulness       4.7  ##################..
  Answer Relevance   4.9  ####################
  Citation Accuracy  4.6  #################...
  Completeness       4.8  ####################
  Context Recall     4.5  #################...

Overall Mean: 4.70  [TARGET: 4.80 - NOT MET]

Lowest performers (bottom 5 cases by mean score):
  [valve/q12] "What happens if you disagree with a peer review?"  3.8
  [gitlab/q07] "How does GitLab handle expense reimbursement?"    4.1

Distribution: 1(0) 2(0) 3(2) 4(18) 5(32)
-----------------------------------------
```

---

## Execution Order

```bash
npx tsx scripts/eval/generate-golden.ts   # once, or when handbooks change
npx tsx scripts/eval/run-eval.ts          # runs pipeline, writes results
npx tsx scripts/eval/judge.ts             # scores results with Opus
npx tsx scripts/eval/report.ts            # prints summary
npx tsx scripts/eval/improve.ts           # iterates until 4.8 or 10 rounds
```

---

## Out of Scope

- Modifying source files (all recommendations are manual apply)
- Testing the upload/processing pipeline (eval scope is retrieval + generation only)
- OpenAI models for golden generation (future improvement: add GPT-4o as third generator)
- Automatic CI runs (future improvement: add as a nightly workflow)

---

## Future Improvements

- Add OpenAI GPT-4o as a third golden-set generator for cross-provider differentiation
- CI nightly run with score regression alerting
- Per-chunk retrieval quality heatmap (which chunks are never retrieved vs. over-retrieved)
