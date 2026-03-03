import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readFile(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasTableEmptyStateInTbody(source) {
  const tbodyMatches = [...source.matchAll(/<tbody[\s\S]*?<\/tbody>/g)];
  return tbodyMatches.some((match) => match[0].includes("TableEmptyState"));
}

function run() {
  const checks = [
    {
      file: "src/app/(main)/projects/projects-table.tsx",
      validate(source) {
        assert(
          hasTableEmptyStateInTbody(source),
          "projects-table: TableEmptyState must be rendered inside <tbody>."
        );
      },
    },
    {
      file: "src/app/(main)/project/[id]/page.tsx",
      validate(source) {
        assert(
          hasTableEmptyStateInTbody(source),
          "project/[id]: TableEmptyState must be rendered inside <tbody>."
        );
        assert(
          !/mb-\d+\s+flex items-start justify-between/.test(source),
          "project/[id]: header-to-table spacing must not use custom mb-* gap."
        );
        assert(
          !/mt-\d+\s+px-6\s+pb-10/.test(source),
          "project/[id]: do not wrap table section with custom top margin + horizontal padding."
        );
        assert(
          /flex items-start justify-between px-6 py-6/.test(source),
          "project/[id]: section header should use the same px-6 py-6 pattern as /projects."
        );
      },
    },
    {
      file: "src/app/(main)/projects/[id]/templates/page.tsx",
      validate(source) {
        assert(
          hasTableEmptyStateInTbody(source),
          "projects/[id]/templates: TableEmptyState must be rendered inside <tbody>."
        );
        assert(
          !/mb-\d+\s+flex items-start justify-between/.test(source),
          "projects/[id]/templates: header-to-table spacing must not use custom mb-* gap."
        );
      },
    },
  ];

  const failures = [];

  for (const check of checks) {
    try {
      const source = readFile(check.file);
      check.validate(source);
      console.log(`✓ ${check.file}`);
    } catch (error) {
      failures.push(`✗ ${check.file}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    console.error("\nUI pattern check failed:");
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("\nUI pattern check passed.");
}

run();
