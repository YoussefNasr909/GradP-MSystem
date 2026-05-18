import assert from "node:assert/strict";
import test from "node:test";
import { classifyPullRequestEvidence } from "./github.service.js";

test("classifyPullRequestEvidence marks tiny diffs as trivial", () => {
  const result = classifyPullRequestEvidence({
    additions: 3,
    deletions: 2,
    changed_files: 1,
    commits: 1,
  });

  assert.equal(result.level, "trivialDiff");
  assert.deepEqual(result.stats, {
    additions: 3,
    deletions: 2,
    changedFiles: 1,
    commits: 1,
    totalChangedLines: 5,
    generatedFiles: 0,
    vendorFiles: 0,
    lockfiles: 0,
    whitespaceOnlyFiles: 0,
  });
});

test("classifyPullRequestEvidence marks broad diffs as high value", () => {
  assert.equal(
    classifyPullRequestEvidence({
      additions: 80,
      deletions: 40,
      changed_files: 9,
      commits: 2,
    }).level,
    "highValueDiff",
  );

  assert.equal(
    classifyPullRequestEvidence({
      additions: 150,
      deletions: 180,
      changed_files: 3,
      commits: 2,
    }).level,
    "highValueDiff",
  );
});

test("classifyPullRequestEvidence defaults ordinary diffs to normal", () => {
  assert.equal(
    classifyPullRequestEvidence({
      additions: 35,
      deletions: 12,
      changed_files: 3,
      commits: 2,
    }).level,
    "normalDiff",
  );
});

test("classifyPullRequestEvidence marks generated-only diffs as trivial", () => {
  const result = classifyPullRequestEvidence({
    additions: 600,
    deletions: 0,
    changed_files: 2,
    commits: 1,
    files: [
      { filename: "src/__generated__/schema.generated.ts", additions: 400, deletions: 0 },
      { filename: "public/app.min.js", additions: 200, deletions: 0 },
    ],
  });

  assert.equal(result.level, "trivialDiff");
  assert.equal(result.stats.generatedFiles, 2);
  assert.deepEqual(result.signals, [{ type: "GENERATED_FILES", count: 2 }]);
});

test("classifyPullRequestEvidence marks vendor and lockfile-only diffs as trivial", () => {
  const result = classifyPullRequestEvidence({
    additions: 300,
    deletions: 120,
    changed_files: 2,
    commits: 1,
    files: [
      { filename: "vendor/library.js", additions: 200, deletions: 100 },
      { filename: "package-lock.json", additions: 100, deletions: 20 },
    ],
  });

  assert.equal(result.level, "trivialDiff");
  assert.equal(result.stats.vendorFiles, 1);
  assert.equal(result.stats.lockfiles, 1);
});

test("classifyPullRequestEvidence marks whitespace-only diffs as trivial", () => {
  const result = classifyPullRequestEvidence({
    additions: 3,
    deletions: 3,
    changed_files: 1,
    commits: 1,
    files: [
      {
        filename: "src/service.js",
        additions: 3,
        deletions: 3,
        patch: [
          "@@ -1,3 +1,3 @@",
          "-function run() {",
          "-return true",
          "-}",
          "+function run() {",
          "+  return true",
          "+}",
        ].join("\n"),
      },
    ],
  });

  assert.equal(result.level, "trivialDiff");
  assert.equal(result.stats.whitespaceOnlyFiles, 1);
});

test("classifyPullRequestEvidence keeps mixed source and lockfile diffs eligible", () => {
  const result = classifyPullRequestEvidence({
    additions: 200,
    deletions: 120,
    changed_files: 2,
    commits: 2,
    files: [
      { filename: "src/features/gamification.js", additions: 80, deletions: 30 },
      { filename: "package-lock.json", additions: 120, deletions: 90 },
    ],
  });

  assert.equal(result.level, "highValueDiff");
  assert.equal(result.stats.lockfiles, 1);
});
