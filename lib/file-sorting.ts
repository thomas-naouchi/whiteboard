import OpenAI from "openai";

export const SORTABLE_FILE_LIMIT = 20;
const SORTING_INTENT_MODEL = process.env.OPENAI_SORTING_MODEL ?? "gpt-4.1-mini";

const GENERIC_TAGS = new Set([
  "pdf",
  "pptx",
  "presentation",
  "text",
  "txt",
  "file",
  "files",
  "document",
  "documents",
  "slide",
  "slides",
  "page",
  "pages",
  "section",
  "summary",
  "notes",
]);

const STRUCTURAL_TOPIC_NOISE = new Set([
  "week",
  "intro",
  "introduction",
  "lesson",
  "unit",
  "module",
  "part",
  "draft",
  "final",
  "copy",
  "version",
  "lecture",
]);

const KNOWN_CONCEPT_FAMILIES: Record<string, string[]> = {
  "deep learning": [
    "deep learning",
    "machine learning",
    "neural network",
    "neural networks",
    "language model",
    "language models",
    "nlp",
    "natural language processing",
    "n-gram",
    "ngrams",
    "tokens",
    "transformer",
  ],
  "machine learning": [
    "machine learning",
    "deep learning",
    "neural network",
    "neural networks",
    "language model",
    "language models",
    "nlp",
    "n-gram",
    "tokens",
  ],
  "language models": [
    "language model",
    "language models",
    "n-gram",
    "tokens",
    "nlp",
    "deep learning",
    "machine learning",
  ],
  "cvs / resumes": [
    "cv",
    "cvs",
    "resume",
    "resumes",
    "curriculum vitae",
    "experience",
    "education",
    "skills",
    "intern",
  ],
  "cvs": [
    "cv",
    "cvs",
    "resume",
    "resumes",
    "curriculum vitae",
  ],
  "resume": [
    "cv",
    "resume",
    "resumes",
    "curriculum vitae",
  ],
  "presentations": [
    "presentation",
    "presentations",
    "slides",
    "deck",
    "powerpoint",
  ],
  "coursework": [
    "assignment",
    "course",
    "coursework",
    "lecture",
    "chapter",
    "university",
    "quiz",
    "student",
  ],
};

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "out",
  "so",
  "than",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "to",
  "up",
  "we",
  "what",
  "when",
  "where",
  "which",
  "with",
  "you",
  "your",
]);

export type SortScope = "selected" | "session";

export interface SortableFileRecord {
  id: string;
  fileName: string;
  storagePath: string;
  contentType: string | null;
  byteSize: number;
  createdAt: string | null;
  tags: string[];
  summaryExcerpt: string | null;
  searchText: string | null;
}

export interface SortingViewFile {
  id: string;
  fileName: string;
  sizeLabel: string;
  reason: string;
  badge: string;
}

export interface SortingViewFolder {
  name: string;
  rationale: string;
  fileCount: number;
  files: SortingViewFile[];
}

export interface SortingView {
  id: "type" | "date" | "content";
  title: string;
  description: string;
  rootFolder: string;
  folders: SortingViewFolder[];
}

export interface SortingPlan {
  totalFiles: number;
  limit: number;
  scopeLabel: string;
  exportName: string;
  instructions: string;
  activity: Array<{ label: string; detail: string }>;
  views: SortingView[];
}

interface IntentRule {
  folder: string;
  badge: string;
  rationale: string;
  reason: string;
  isFallback?: boolean;
  match: (file: SortableFileRecord) => boolean;
}

interface ParsedIntentBucket {
  folder: string;
  concepts: string[];
  fileClass:
    | "resume"
    | "presentation"
    | "coursework"
    | "generic"
    | "fallback";
  isolate: boolean;
}

interface ResolvedSortingIntent {
  source: "llm" | "heuristic" | "none";
  buckets: ParsedIntentBucket[];
}

interface BucketProfile {
  folder: string;
  badge: string;
  rationale: string;
  reasonPrefix: string;
  fileClass: ParsedIntentBucket["fileClass"];
  familyTerms: string[];
  isFallback: boolean;
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

function bytesLabel(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function extensionOf(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() ?? "file" : "file";
}

function fileTypeFolder(file: SortableFileRecord) {
  const extension = extensionOf(file.fileName);

  if (extension === "pdf") {
    return {
      folder: "PDF files",
      rationale: "Stable grouping by file extension for document review.",
      badge: "PDF",
    };
  }

  if (extension === "pptx") {
    return {
      folder: "Presentations",
      rationale: "Slides and decks grouped together for quick scanability.",
      badge: "PPTX",
    };
  }

  if (extension === "txt") {
    return {
      folder: "Text files",
      rationale: "Plain text material isolated for lightweight reference.",
      badge: "TXT",
    };
  }

  return {
    folder: "Other files",
    rationale: "Anything outside the core supported formats.",
    badge: extension.toUpperCase(),
  };
}

function createdMonthFolder(value: string | null) {
  if (!value) {
    return {
      folder: "Undated imports",
      rationale: "No reliable upload timestamp was available for these files.",
      badge: "No date",
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      folder: "Undated imports",
      rationale: "No reliable upload timestamp was available for these files.",
      badge: "No date",
    };
  }

  const folder = date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    folder,
    rationale: "Chronological grouping based on when the file entered this session.",
    badge: date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
    }),
  };
}

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeToken(value)
    .split(" ")
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length >= 3 &&
        !STOP_WORDS.has(part) &&
        !GENERIC_TAGS.has(part) &&
        !STRUCTURAL_TOPIC_NOISE.has(part),
    );
}

function phraseTokens(value: string) {
  const tokens = tokenize(value);
  const phrases: string[] = [];

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const current = tokens[index];
    const next = tokens[index + 1];
    phrases.push(`${current} ${next}`);
  }

  return phrases;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function contentCandidates(file: SortableFileRecord) {
  const score = new Map<string, number>();
  const tagList = file.tags.map((tag) => normalizeToken(tag)).filter(Boolean);

  tagList.forEach((tag, index) => {
    if (!GENERIC_TAGS.has(tag) && !STRUCTURAL_TOPIC_NOISE.has(tag)) {
      score.set(tag, (score.get(tag) ?? 0) + Math.max(3, 10 - index));
    }
  });

  const summaryPhrases = phraseTokens(file.summaryExcerpt ?? "").slice(0, 6);
  summaryPhrases.forEach((phrase, index) => {
    score.set(phrase, (score.get(phrase) ?? 0) + Math.max(4, 9 - index));
  });

  const summaryTokens = tokenize(file.summaryExcerpt ?? "").slice(0, 8);
  summaryTokens.forEach((token, index) => {
    score.set(token, (score.get(token) ?? 0) + Math.max(1, 4 - index));
  });

  const namePhrases = phraseTokens(file.fileName.replace(/\.[^.]+$/, "")).slice(0, 4);
  namePhrases.forEach((phrase, index) => {
    score.set(phrase, (score.get(phrase) ?? 0) + Math.max(2, 5 - index));
  });

  const nameTokens = tokenize(file.fileName.replace(/\.[^.]+$/, ""));
  nameTokens.forEach((token, index) => {
    score.set(token, (score.get(token) ?? 0) + Math.max(1, 3 - index));
  });

  return Array.from(score.entries()).sort((a, b) => b[1] - a[1]);
}

function combinedText(file: SortableFileRecord) {
  return normalizeToken(
    [
      file.fileName,
      file.summaryExcerpt ?? "",
      file.searchText ?? "",
      file.tags.join(" "),
    ].join(" "),
  );
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function uniqueTerms(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function familyMapTerms(term: string) {
  const normalized = normalizeToken(term);
  const matches = Object.entries(KNOWN_CONCEPT_FAMILIES)
    .filter(
      ([key]) =>
        normalized === key ||
        normalized.includes(key) ||
        key.includes(normalized),
    )
    .flatMap(([, aliases]) => aliases);

  return uniqueTerms(matches.map((value) => normalizeToken(value)));
}

function lexicalVariants(term: string) {
  const normalized = normalizeToken(term);

  if (!normalized) {
    return [];
  }

  const variants = [normalized];

  if (!normalized.endsWith("s")) {
    variants.push(`${normalized}s`);
  }

  if (normalized.endsWith("s")) {
    variants.push(normalized.slice(0, -1));
  }

  return uniqueTerms(variants);
}

function isResumeLike(file: SortableFileRecord) {
  const text = combinedText(file);
  return hasAny(text, [
    "cv",
    "resume",
    "curriculum vitae",
    "intern",
    "experience",
    "education",
    "skills",
    "linkedin",
  ]);
}

function isPresentationLike(file: SortableFileRecord) {
  const extension = extensionOf(file.fileName);
  const text = combinedText(file);
  return extension === "pptx" || hasAny(text, ["presentation", "slides", "deck"]);
}

function isCourseworkLike(file: SortableFileRecord) {
  const text = combinedText(file);
  return hasAny(text, [
    "assignment",
    "course",
    "chapter",
    "lecture",
    "university",
    "student",
    "homework",
    "quiz",
  ]);
}

function fileMatchesBucketClass(
  file: SortableFileRecord,
  fileClass: ParsedIntentBucket["fileClass"],
) {
  if (fileClass === "resume") return isResumeLike(file);
  if (fileClass === "presentation") return isPresentationLike(file);
  if (fileClass === "coursework") return isCourseworkLike(file);
  if (fileClass === "fallback") return true;
  return false;
}

function conceptAliases(concept: string) {
  const aliases = [concept, ...familyMapTerms(concept), ...lexicalVariants(concept)];

  if (concept.includes("deep learning")) {
    aliases.push("machine learning", "neural network", "neural networks");
  }

  if (concept.includes("machine learning")) {
    aliases.push("deep learning", "neural network", "neural networks");
  }

  if (concept.includes("language model")) {
    aliases.push("language models", "llm", "llms", "transformer");
  }

  return uniqueTerms(aliases.map((value) => normalizeToken(value)));
}

function extractFreeformConcepts(intent: string) {
  const normalized = normalizeToken(intent);

  return normalized
    .split(",")
    .flatMap((segment) => segment.split(" and "))
    .map((clause) =>
      clause
        .replace(/\b(sort|group|keep|put|make|place|isolate|separate)\b/g, " ")
        .replace(/\b(files|file|related|alone|together|rest|other|others)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((clause) => clause.length >= 4)
    .filter(
      (clause) =>
        !hasAny(clause, [
          "cv",
          "cvs",
          "resume",
          "resumes",
          "presentation",
          "presentations",
          "slides",
          "deck",
          "course",
          "coursework",
          "study",
          "university",
          "assignment",
        ]),
    );
}

function normalizeBucket(bucket: ParsedIntentBucket): ParsedIntentBucket {
  const folder = bucket.folder.trim() || "Requested group";
  const concepts = uniqueTerms(
    bucket.concepts
      .map((concept) => normalizeToken(concept))
      .filter((concept) => concept.length >= 2),
  );

  return {
    folder,
    concepts,
    fileClass: bucket.fileClass,
    isolate: Boolean(bucket.isolate),
  };
}

async function resolveSortingIntentWithLLM(intent: string) {
  const client = getOpenAIClient();

  if (!client || !intent.trim()) {
    return null;
  }

  const response = await client.chat.completions.create({
    model: SORTING_INTENT_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You convert a file-sorting request into a small JSON plan. Return only valid JSON. Extract explicit buckets the user wants, keeping labels short and practical. Use fileClass only when the user clearly refers to a known class: resume, presentation, coursework, generic, fallback. Use concepts for topical intent terms like deep learning or cybersecurity. If the user asks for 'the rest' or remaining files separately, include one fallback bucket.",
      },
      {
        role: "user",
        content: JSON.stringify({
          request: intent,
          output_schema: {
            buckets: [
              {
                folder: "string",
                concepts: ["string"],
                fileClass:
                  "resume | presentation | coursework | generic | fallback",
                isolate: true,
              },
            ],
          },
          examples: [
            {
              request: "cv's alone, deep learning alone, and the rest",
              buckets: [
                {
                  folder: "CVs / Resumes",
                  concepts: [],
                  fileClass: "resume",
                  isolate: true,
                },
                {
                  folder: "Deep Learning",
                  concepts: ["deep learning", "machine learning"],
                  fileClass: "generic",
                  isolate: true,
                },
                {
                  folder: "Everything else",
                  concepts: [],
                  fileClass: "fallback",
                  isolate: true,
                },
              ],
            },
          ],
        }),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    return null;
  }

  const parsed = JSON.parse(content) as {
    buckets?: Array<{
      folder?: unknown;
      concepts?: unknown;
      fileClass?: unknown;
      isolate?: unknown;
    }>;
  };

  if (!Array.isArray(parsed.buckets)) {
    return null;
  }

  return parsed.buckets
    .map((bucket) => {
      const fileClass =
        bucket.fileClass === "resume" ||
        bucket.fileClass === "presentation" ||
        bucket.fileClass === "coursework" ||
        bucket.fileClass === "generic" ||
        bucket.fileClass === "fallback"
          ? bucket.fileClass
          : "generic";

      return normalizeBucket({
        folder: typeof bucket.folder === "string" ? bucket.folder : "Requested group",
        concepts: Array.isArray(bucket.concepts)
          ? bucket.concepts.filter(
              (concept): concept is string => typeof concept === "string",
            )
          : [],
        fileClass,
        isolate: Boolean(bucket.isolate),
      });
    })
    .filter((bucket) => bucket.folder.length > 0);
}

function fileMatchesConcept(file: SortableFileRecord, concept: string) {
  const text = combinedText(file);
  const aliases = conceptAliases(concept);

  if (aliases.some((alias) => text.includes(alias))) {
    return true;
  }

  const conceptTokens = tokenize(concept);
  if (conceptTokens.length === 0) {
    return false;
  }

  const matchedCount = conceptTokens.filter((token) => text.includes(token)).length;
  return matchedCount >= Math.min(2, conceptTokens.length);
}

function scoreFileAgainstConcept(file: SortableFileRecord, concept: string) {
  const text = combinedText(file);
  const aliases = conceptAliases(concept);
  let score = 0;

  for (const alias of aliases) {
    if (!alias) continue;

    if (text.includes(alias)) {
      score += alias.includes(" ") ? 16 : 8;
    } else {
      const aliasTokens = tokenize(alias);
      const matchedTokens = aliasTokens.filter((token) => text.includes(token)).length;
      if (matchedTokens >= 2) {
        score += matchedTokens * 3;
      }
    }
  }

  return score;
}

function buildHeuristicBuckets(intent: string) {
  const normalizedIntent = normalizeToken(intent);

  if (!normalizedIntent) {
    return [] as ParsedIntentBucket[];
  }

  const buckets: ParsedIntentBucket[] = [];
  const wantsSeparation =
    hasAny(normalizedIntent, ["alone", "separate", "apart", "isolated"]) ||
    normalizedIntent.includes("rest");

  if (hasAny(normalizedIntent, ["cv", "cvs", "resume", "resumes"])) {
    buckets.push(
      normalizeBucket({
        folder: "CVs / Resumes",
        concepts: [],
        fileClass: "resume",
        isolate: true,
      }),
    );
  }

  if (hasAny(normalizedIntent, ["presentation", "presentations", "slides", "deck"])) {
    buckets.push(
      normalizeBucket({
        folder: "Presentations",
        concepts: [],
        fileClass: "presentation",
        isolate: true,
      }),
    );
  }

  if (hasAny(normalizedIntent, ["course", "coursework", "study", "university", "assignment"])) {
    buckets.push(
      normalizeBucket({
        folder: "Coursework",
        concepts: [],
        fileClass: "coursework",
        isolate: true,
      }),
    );
  }

  for (const concept of extractFreeformConcepts(intent)) {
    buckets.push(
      normalizeBucket({
        folder: titleCase(concept),
        concepts: [concept],
        fileClass: "generic",
        isolate: true,
      }),
    );
  }

  if (wantsSeparation && buckets.length > 0) {
    buckets.push(
      normalizeBucket({
        folder: "Everything else",
        concepts: [],
        fileClass: "fallback",
        isolate: true,
      }),
    );
  }

  return buckets;
}

export async function resolveSortingIntent(intent: string): Promise<ResolvedSortingIntent> {
  const trimmed = intent.trim();

  if (!trimmed) {
    return {
      source: "none",
      buckets: [],
    };
  }

  try {
    const llmBuckets = await resolveSortingIntentWithLLM(trimmed);

    if (llmBuckets && llmBuckets.length > 0) {
      return {
        source: "llm",
        buckets: llmBuckets,
      };
    }
  } catch (error) {
    console.error("Sorting intent LLM parse failed:", error);
  }

  return {
    source: "heuristic",
    buckets: buildHeuristicBuckets(trimmed),
  };
}

function buildIntentRules(intent: string, resolvedIntent?: ResolvedSortingIntent) {
  const buckets = resolvedIntent?.buckets ?? buildHeuristicBuckets(intent);
  const sourceLabel =
    resolvedIntent?.source === "llm"
      ? "LLM-parsed sorting instruction"
      : `Structured from your instruction: "${intent.trim()}".`;

  return buckets.map((bucket): BucketProfile => {
    if (bucket.fileClass === "fallback") {
      return {
        folder: bucket.folder,
        badge: "Fallback",
        rationale: "The instruction asked Whiteboard to keep the remaining files separate.",
        reasonPrefix: "Grouped here because it did not match any of the requested intent groups.",
        fileClass: bucket.fileClass,
        familyTerms: [],
        isFallback: true,
      };
    }

    const seeds = uniqueTerms([
      bucket.folder,
      ...bucket.concepts,
      ...familyMapTerms(bucket.folder),
      ...bucket.concepts.flatMap((concept) => familyMapTerms(concept)),
    ].map((value) => normalizeToken(value)));

    return {
      folder: bucket.folder,
      badge: resolvedIntent?.source === "llm" ? "LLM intent" : "Intent rule",
      rationale: sourceLabel,
      reasonPrefix:
        bucket.fileClass === "resume"
          ? "Grouped here because the sorter detected this file as a CV or resume."
          : bucket.fileClass === "presentation"
            ? "Grouped here because the sorter detected slide-deck style content."
            : bucket.fileClass === "coursework"
              ? "Grouped here because the sorter detected academic or coursework signals."
              : seeds.length > 0
                ? `Grouped here because the sorter matched the requested concept family around "${seeds[0]}".`
                : `Grouped here because it matched the requested bucket "${bucket.folder}".`,
      fileClass: bucket.fileClass,
      familyTerms: seeds,
      isFallback: false,
    };
  });
}

function collectSessionEvidence(
  files: SortableFileRecord[],
  profile: BucketProfile,
) {
  if (profile.isFallback) {
    return [];
  }

  const evidence = new Set<string>();

  for (const file of files) {
    const classMatch =
      profile.fileClass !== "generic" &&
      fileMatchesBucketClass(file, profile.fileClass);
    const conceptMatch = profile.familyTerms.some((term) =>
      scoreFileAgainstConcept(file, term) >= 12,
    );

    if (!classMatch && !conceptMatch) {
      continue;
    }

    for (const [candidate, score] of contentCandidates(file).slice(0, 8)) {
      if (score >= 4) {
        evidence.add(candidate);
      }
    }
  }

  return Array.from(evidence);
}

function buildBucketProfiles(
  files: SortableFileRecord[],
  intent: string,
  resolvedIntent?: ResolvedSortingIntent,
) {
  const baseProfiles = buildIntentRules(intent, resolvedIntent);

  return baseProfiles.map((profile) => {
    if (profile.isFallback) {
      return profile;
    }

    return {
      ...profile,
      familyTerms: uniqueTerms([
        ...profile.familyTerms,
        ...collectSessionEvidence(files, profile),
      ]),
    };
  });
}

function bestIntentCandidate(intent: string, candidates: Array<[string, number]>) {
  const normalizedIntent = normalizeToken(intent);
  const intentPhrases = phraseTokens(normalizedIntent);
  const intentTerms = [...intentPhrases, ...tokenize(normalizedIntent)];

  for (const term of intentTerms) {
    const exact = candidates.find(([candidate]) => candidate === term);
    if (exact) {
      return exact[0];
    }
  }

  for (const term of intentTerms) {
    const overlap = candidates.find(([candidate]) =>
      candidate.includes(term) || term.includes(candidate),
    );

    if (overlap) {
      return overlap[0];
    }
  }

  return null;
}

function pickContentFolder(
  file: SortableFileRecord,
  intent: string,
  profiles: BucketProfile[],
) {
  const primaryProfiles = profiles.filter((profile) => !profile.isFallback);
  const fallbackProfile = profiles.find((profile) => profile.isFallback);
  let bestProfile: BucketProfile | null = null;
  let bestScore = 0;

  for (const profile of primaryProfiles) {
    let score = 0;

    if (profile.fileClass !== "generic" && fileMatchesBucketClass(file, profile.fileClass)) {
      score += 24;
    }

    for (const term of profile.familyTerms) {
      score += scoreFileAgainstConcept(file, term);
    }

    if (score > bestScore) {
      bestScore = score;
      bestProfile = profile;
    }
  }

  if (bestProfile && bestScore >= 12) {
    return {
      folder: bestProfile.folder,
      rationale: bestProfile.rationale,
      badge: bestProfile.badge,
      reason: `${bestProfile.reasonPrefix} Score ${bestScore}.`,
    };
  }

  if (fallbackProfile) {
    return {
      folder: fallbackProfile.folder,
      rationale: fallbackProfile.rationale,
      badge: fallbackProfile.badge,
      reason: fallbackProfile.reasonPrefix,
    };
  }

  const candidates = contentCandidates(file);
  const chosenIntentCandidate = bestIntentCandidate(intent, candidates);

  if (chosenIntentCandidate) {
    return {
      folder: titleCase(chosenIntentCandidate),
      rationale: `Biased toward your sorting instruction: "${intent.trim()}".`,
      badge: "Instruction fit",
      reason: `Grouped here because "${chosenIntentCandidate}" is the strongest semantic overlap with the sorting goal.`,
    };
  }

  const [best] = candidates;

  if (best) {
    const tagPreview = file.tags.slice(0, 3).join(", ");
    return {
      folder: titleCase(best[0]),
      rationale: "Primary topic grouping inferred from generated tags and summary text.",
      badge: "Topic",
      reason:
        tagPreview.length > 0
          ? `Placed here from content tags: ${tagPreview}.`
          : `Placed here because "${best[0]}" was the strongest topic signal.`,
    };
  }

  return {
    folder: "General",
    rationale: "No strong topical signal was detected, so Whiteboard kept it in a safe catch-all bucket.",
    badge: "General",
    reason: "This file did not expose strong content tags yet.",
  };
}

function insertIntoFolders(
  folderMap: Map<string, SortingViewFolder>,
  folderName: string,
  rationale: string,
  file: SortingViewFile,
) {
  const existing = folderMap.get(folderName);

  if (existing) {
    existing.files.push(file);
    existing.fileCount += 1;
    return;
  }

  folderMap.set(folderName, {
    name: folderName,
    rationale,
    fileCount: 1,
    files: [file],
  });
}

function sortFolders(folderMap: Map<string, SortingViewFolder>) {
  return Array.from(folderMap.values())
    .map((folder) => ({
      ...folder,
      files: folder.files.sort((a, b) => a.fileName.localeCompare(b.fileName)),
    }))
    .sort((a, b) => {
      if (b.fileCount !== a.fileCount) {
        return b.fileCount - a.fileCount;
      }

      return a.name.localeCompare(b.name);
    });
}

function makeViewFile(
  file: SortableFileRecord,
  reason: string,
  badge: string,
): SortingViewFile {
  return {
    id: file.id,
    fileName: file.fileName,
    sizeLabel: bytesLabel(file.byteSize),
    reason,
    badge,
  };
}

export function buildSortingPlan(params: {
  files: SortableFileRecord[];
  scope: SortScope;
  instruction?: string | null;
  resolvedIntent?: ResolvedSortingIntent;
}) {
  const instruction = params.instruction?.trim() ?? "";
  const typeFolders = new Map<string, SortingViewFolder>();
  const dateFolders = new Map<string, SortingViewFolder>();
  const contentFolders = new Map<string, SortingViewFolder>();
  const bucketProfiles = buildBucketProfiles(
    params.files,
    instruction,
    params.resolvedIntent,
  );

  for (const file of params.files) {
    const typeGrouping = fileTypeFolder(file);
    insertIntoFolders(
      typeFolders,
      typeGrouping.folder,
      typeGrouping.rationale,
      makeViewFile(
        file,
        `Sorted by extension as ${typeGrouping.badge}.`,
        typeGrouping.badge,
      ),
    );

    const dateGrouping = createdMonthFolder(file.createdAt);
    insertIntoFolders(
      dateFolders,
      dateGrouping.folder,
      dateGrouping.rationale,
      makeViewFile(
        file,
        `Grouped by upload timing: ${dateGrouping.badge}.`,
        dateGrouping.badge,
      ),
    );

    const contentGrouping = pickContentFolder(
      file,
      instruction,
      bucketProfiles,
    );
    insertIntoFolders(
      contentFolders,
      contentGrouping.folder,
      contentGrouping.rationale,
      makeViewFile(file, contentGrouping.reason, contentGrouping.badge),
    );
  }

  const scopeLabel =
    params.scope === "selected" ? "selected files" : "full session files";
  const date = new Date();
  const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  return {
    totalFiles: params.files.length,
    limit: SORTABLE_FILE_LIMIT,
    scopeLabel,
    exportName: `whiteboard-sorting-${timestamp}`,
    instructions:
      instruction.length > 0
        ? `Sorter bias applied: ${instruction}`
        : "No extra sorting instruction was provided. Whiteboard used deterministic metadata only.",
    activity: [
      {
        label: "Read session metadata",
        detail: `Loaded ${params.files.length} ${scopeLabel} for sorting.`,
      },
      {
        label: "Built stable folders",
        detail: "Created file-type and date hierarchies without using the LLM.",
      },
      {
        label: "Inferred topical grouping",
        detail:
          instruction.length > 0
            ? params.resolvedIntent?.source === "llm"
              ? "Used an LLM to extract sorting buckets, then matched files deterministically."
              : "Used tags, summaries, and your instruction to bias content folders."
            : "Used tags and summaries to infer primary content folders.",
      },
      {
        label: "Prepared export package",
        detail: "The hierarchy is ready to download as a sorted archive.",
      },
    ],
    views: [
      {
        id: "type",
        title: "By file type",
        description: "A reliable technical split by extension so you can scan the session fast.",
        rootFolder: "by-type",
        folders: sortFolders(typeFolders),
      },
      {
        id: "date",
        title: "By upload date",
        description: "A chronological folder tree based on when the file entered the session.",
        rootFolder: "by-date",
        folders: sortFolders(dateFolders),
      },
      {
        id: "content",
        title: "By content",
        description: "A topical hierarchy inferred from generated tags and extracted summaries.",
        rootFolder: "by-content",
        folders: sortFolders(contentFolders),
      },
    ],
  } satisfies SortingPlan;
}

export function sanitizeSortPathSegment(value: string) {
  const sanitized = value.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return sanitized.length > 0 ? sanitized : "untitled";
}
