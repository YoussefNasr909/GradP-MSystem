import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const npxCommand = isWindows ? "npx.cmd" : "npx";
const rootDir = fileURLToPath(new URL("..", import.meta.url));
const frontendDir = rootDir;
const backendDir = fileURLToPath(new URL("../../GraduationProjectBackend/", import.meta.url));
const requestedPlaywrightArgs = process.argv.slice(2);
const runnerTimeoutMs = Number(process.env.PLAYWRIGHT_RUNNER_TIMEOUT_MS ?? 900_000);

const spawned = [];

function killProcessTree(pid) {
  return new Promise((resolve) => {
    if (!pid) {
      resolve();
      return;
    }

    if (isWindows) {
      const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.on("exit", resolve);
      killer.on("error", resolve);
      setTimeout(resolve, 5_000);
      return;
    }

    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Already gone.
    }
    setTimeout(resolve, 1_000);
  });
}

async function isReady(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await isReady(url)) return;
    await delay(1_000);
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

function spawnService(label, command, args, cwd, env = {}) {
  const spawnCommand = isWindows ? "cmd.exe" : command;
  const spawnArgs = isWindows ? ["/d", "/s", "/c", command, ...args] : args;
  const child = spawn(spawnCommand, spawnArgs, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.on("exit", (code, signal) => {
    if (code !== null && code !== 0) {
      process.stderr.write(`[${label}] exited with code ${code}\n`);
    }
    if (signal) {
      process.stderr.write(`[${label}] exited with signal ${signal}\n`);
    }
  });

  spawned.push(child);
  return child;
}

async function stopSpawned() {
  await Promise.all(
    spawned.map(
      (child) =>
        new Promise((resolve) => {
          if (child.exitCode !== null || child.killed) {
            resolve();
            return;
          }

          if (isWindows) {
            killProcessTree(child.pid).then(resolve);
            return;
          }

          child.once("exit", resolve);
          child.kill("SIGTERM");
          setTimeout(resolve, 5_000);
        }),
    ),
  );
}

async function main() {
  let exitCode = 1;

  try {
    const backendReady = await isReady("http://127.0.0.1:4000/health");
    const frontendReady = await isReady("http://127.0.0.1:3000");

    if (!backendReady) {
      spawnService("backend", npmCommand, ["run", "start"], backendDir, {
        SMTP_HOST: "",
        SMTP_PORT: "0",
        SMTP_USER: "",
        SMTP_PASS: "",
      });
    }

    if (!frontendReady) {
      spawnService("frontend", npmCommand, ["run", "dev"], frontendDir, {
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1",
        BACKEND_URL: process.env.BACKEND_URL ?? "http://127.0.0.1:4000",
        GOOGLE_GENERATIVE_AI_API_KEY: "",
        GOOGLE_API_KEY: "",
        OPENAI_API_KEY: "",
      });
    }

    await waitFor("http://127.0.0.1:4000/health", "Backend");
    await waitFor("http://127.0.0.1:3000", "Frontend");

    const result = await new Promise((resolve) => {
      let output = "";
      let settled = false;

      const finish = async (code) => {
        if (settled) return;
        settled = true;
        await killProcessTree(child.pid);
        resolve(code);
      };

      const defaultPlaywrightArgs = [
        "e2e/accessibility.spec.ts",
        "--project=chromium",
        "--reporter=line",
      ];
      const userPlaywrightArgs = requestedPlaywrightArgs.length > 0 ? requestedPlaywrightArgs : defaultPlaywrightArgs;
      const hasConfigArg = userPlaywrightArgs.some((arg) => arg === "--config" || arg.startsWith("--config="));
      const playwrightArgs = [
          "playwright",
          "test",
          ...userPlaywrightArgs,
          ...(hasConfigArg ? [] : ["--config=playwright.no-webserver.config.ts"]),
        ];
      const child = spawn(
        isWindows ? "cmd.exe" : npxCommand,
        isWindows ? ["/d", "/s", "/c", npxCommand, ...playwrightArgs] : playwrightArgs,
        {
          cwd: rootDir,
          env: { ...process.env },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );

      const handleOutput = (chunk, writer) => {
        const text = String(chunk);
        output += text;
        writer.write(text);
      };

      child.stdout.on("data", (chunk) => handleOutput(chunk, process.stdout));
      child.stderr.on("data", (chunk) => handleOutput(chunk, process.stderr));
      child.on("exit", (code) => {
        if (!settled) resolve(code ?? 1);
      });
      child.on("error", (error) => {
        console.error(error);
        if (!settled) resolve(1);
      });
      setTimeout(() => {
        if (settled) return;
        void finish(1);
      }, Number.isFinite(runnerTimeoutMs) && runnerTimeoutMs > 0 ? runnerTimeoutMs : 900_000);
    });

    exitCode = Number(result);
  } finally {
    await stopSpawned();
    process.exit(exitCode);
  }
}

main().catch(async (error) => {
  console.error(error);
  await stopSpawned();
  process.exit(1);
});
