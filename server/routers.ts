import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── ML prediction helper ────────────────────────────────────────────────────
function runPrediction(strength: number, age: number): Promise<PredictResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "ml", "predict.py");
    const proc = spawn("python3.11", [scriptPath]);
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
