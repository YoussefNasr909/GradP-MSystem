import "dotenv/config";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(`\nE2E prepare aborted: ${message}\n`);
  process.exit(1);
}

function getDatabaseName(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    return parsed.pathname.replace(/^\/+/, "");
  } catch {
    return "";
  }
}

function assertSafeDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail("DATABASE_URL is not set.");
  }

  const databaseName = getDatabaseName(databaseUrl);
  const loweredUrl = databaseUrl.toLowerCase();
  const loweredName = databaseName.toLowerCase();
  const looksSafe = loweredName.includes("test") || loweredName.includes("e2e") || loweredUrl.includes("test") || loweredUrl.includes("e2e");
  const explicitlyConfirmed =
    process.env.E2E_ALLOW_DB_RESET === "true" &&
    process.env.E2E_CONFIRM_DB_RESET &&
    process.env.E2E_CONFIRM_DB_RESET === databaseName;

  if (!looksSafe && !explicitlyConfirmed) {
    fail(
      [
        `Refusing to reset database "${databaseName || "(unknown)"}".`,
        "Use a database name containing test/e2e, or explicitly set:",
        `E2E_ALLOW_DB_RESET=true E2E_CONFIRM_DB_RESET=${databaseName}`,
      ].join("\n")
    );
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "test",
      E2E_RESET_DB: "true",
    },
  });

  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}.`);
  }
}

assertSafeDatabase();

console.log("Resetting and reseeding the guarded E2E database...");
run("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"]);
run("npm", ["run", "db:huge-seed"]);
console.log("E2E database is ready.");
