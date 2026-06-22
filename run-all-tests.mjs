import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
🎓 Graduation Project - Master Test Suite 🎓
=================================================
This script runs the entire testing infrastructure 
for both the Backend and Frontend to ensure your 
project is bug-free before merging or presenting.

Usage: 
  node run-all-tests.mjs [options]

Options:
  --help, -h        Show this help message
  --backend         Run only backend tests
  --frontend-qa     Run frontend QA (Lint, Types, Unit, Build, A11y)

If no options are provided, ALL tests will run sequentially!
=================================================
  `);
  process.exit(0);
}

const runCommand = (name, command, args, cwd) => {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Starting: ${name}...`);
    console.log(`-------------------------------------------------`);
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: isWindows
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`\n❌ [FAILED] ${name} exited with code ${code}`);
        reject(new Error(`${name} failed`));
      } else {
        console.log(`\n✅ [SUCCESS] ${name} completed successfully!`);
        resolve();
      }
    });
  });
};

async function main() {
  const runAll = args.length === 0;

  try {
    if (runAll || args.includes("--backend")) {
      await runCommand(
        "Backend Tests (Schemas & Logic)", 
        npmCmd, 
        ["run", "test"], 
        path.join(__dirname, "GraduationProjectBackend")
      );
    }

    if (runAll || args.includes("--frontend-qa")) {
      await runCommand(
        "Frontend Full QA Suite (Lint, Types, Unit, Build, E2E Accessibility)", 
        npmCmd, 
        ["run", "test:qa"], 
        path.join(__dirname, "GraduationProjectFrontend")
      );
    }
    
    console.log(`\n🎉🎉 ALL REQUESTED TESTS PASSED SUCCESSFULLY! Your project is stable! 🎉🎉\n`);
  } catch (error) {
    console.error(`\n🚨🚨 SOME TESTS FAILED. Please review the errors above and fix them before proceeding. 🚨🚨\n`);
    process.exit(1);
  }
}

main();
