import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Resolve ML directory (works in both dev and production) ─────────────────
// In dev:  __dirname = .../server/       → server/ml
// In prod: __dirname = .../dist/         → ../server/ml  OR  process.cwd()/server/ml
function resolveMLDir(): string {
  // Try __dirname/ml first (dev mode)
  const devPath = path.join(__dirname, "ml");
  if (fs.existsSync(path.join(devPath, "predict.py"))) return devPath;
  // Try one level up from __dirname (e.g. dist/../server/ml)
  const upPath = path.join(__dirname, "..", "server", "ml");
  if (fs.existsSync(path.join(upPath, "predict.py"))) return upPath;
  // Try from process.cwd() (Railway/Docker: /app/server/ml)
  const cwdPath = path.join(process.cwd(), "server", "ml");
  if (fs.existsSync(path.join(cwdPath, "predict.py"))) return cwdPath;
  // Fallback
  return devPath;
}

const ML_DIR = resolveMLDir();

// ─── Resolve the best available Python interpreter ───────────────────────────
function resolvePython(): string {
  const mlDir = ML_DIR;
  const candidates = [
    path.join(mlDir, ".venv313", "bin", "python"),   // venv with all packages
    path.join(mlDir, ".venv313", "bin", "python3"),
    "/usr/bin/python3.11",
    "/usr/bin/python3",
    "python3.11",
    "python3",
  ];
  for (const c of candidates) {
    if (c.startsWith("/")) {
      if (fs.existsSync(c)) return c;
    } else {
      return c; // PATH-based, let OS resolve
    }
  }
  return "python3";
}

const PYTHON_BIN = resolvePython();

// ─── ML prediction helper ────────────────────────────────────────────────────
function runPrediction(strength: number, age: number): Promise<PredictResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(ML_DIR, "predict.py");
    const proc = spawn(PYTHON_BIN, [scriptPath]);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python exited ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (e) {
        reject(new Error(`JSON parse error: ${stdout}`));
      }
    });
    proc.stdin.write(JSON.stringify({ strength, age }));
    proc.stdin.end();
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Component {
  name: string;
  value: number;
  min: number;
  max: number;
  status: "OK" | "Warning";
}

interface PredictResult {
  components: Component[];
  verified: number;
  target: number;
  error: number;
  errorPct: number;
  meta: {
    strengthMin: number;
    strengthMax: number;
    ageOptions: number[];
    dataset: string;
    algorithm: string;
  };
}

// ─── Router ──────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  concrete: router({
    predict: publicProcedure
      .input(
        z.object({
          strength: z.number().min(2).max(83),
          age: z.number().int().min(1).max(365),
        })
      )
      .mutation(async ({ input }) => {
        const result = await runPrediction(input.strength, input.age);
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
