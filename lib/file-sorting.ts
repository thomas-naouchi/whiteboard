export const SORTABLE_FILE_LIMIT = 20;

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
        part.length >= 3 && !STOP_WORDS.has(part) && !GENERIC_TAGS.has(part),
    );
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function contentCandidates(file: SortableFileRecord) {
  const score = new Map<string, number>();
  const tagList = file.tags.map((tag) => normalizeToken(tag)).filter(Boolean);

  tagList.forEach((tag, index) => {
    if (!GENERIC_TAGS.has(tag)) {
      score.set(tag, (score.get(tag) ?? 0) + Math.max(3, 10 - index));
    }
  });

  const summaryTokens = tokenize(file.summaryExcerpt ?? "").slice(0, 8);
  summaryTokens.forEach((token, index) => {
    score.set(token, (score.get(token) ?? 0) + Math.max(1, 4 - index));
  });

  const nameTokens = tokenize(file.fileName.replace(/\.[^.]+$/, ""));
  nameTokens.forEach((token, index) => {
    score.set(token, (score.get(token) ?? 0) + Math.max(2, 6 - index));
  });

  return Array.from(score.entries()).sort((a, b) => b[1] - a[1]);
}

function pickContentFolder(
  file: SortableFileRecord,
  intent: string,
) {
  const candidates = contentCandidates(file);
  const intentTokens = tokenize(intent);

  if (intentTokens.length > 0) {
    for (const [candidate] of candidates) {
      if (
        intentTokens.some(
          (token) => candidate.includes(token) || token.includes(candidate),
        )
      ) {
        return {
          folder: titleCase(candidate),
          rationale: `Biased toward your sorting instruction: "${intent.trim()}".`,
          badge: "Instruction fit",
          reason: `Grouped here because "${candidate}" overlaps with the sorting goal.`,
        };
      }
    }
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
}) {
  const instruction = params.instruction?.trim() ?? "";
  const typeFolders = new Map<string, SortingViewFolder>();
  const dateFolders = new Map<string, SortingViewFolder>();
  const contentFolders = new Map<string, SortingViewFolder>();

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

    const contentGrouping = pickContentFolder(file, instruction);
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
            ? "Used tags, summaries, and your instruction to bias content folders."
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
