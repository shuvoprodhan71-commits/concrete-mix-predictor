import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { Download, FlaskConical, Loader2, TriangleAlert, CheckCircle2, ChevronRight } from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────
const AGE_OPTIONS = [1, 3, 7, 14, 28, 56, 90, 180, 270, 365];
const GRADES = [
  { label: "C20", value: 20 },
  { label: "C25", value: 25 },
  { label: "C30", value: 30 },
  { label: "C35", value: 35 },
  { label: "C40", value: 40 },
  { label: "C50", value: 50 },
  { label: "C60", value: 60 },
  { label: "C70", value: 70 },
];

const CHART_COLORS = [
  "#4ade80", "#22d3ee", "#a78bfa", "#fb923c", "#f472b6", "#facc15", "#60a5fa"
];

// Short display names for charts
const SHORT_NAMES: Record<string, string> = {
  "Cement (kg/m3)": "Cement",
  "Blast Furnace Slag (kg/m3)": "BF Slag",
  "Fly Ash (kg/m3)": "Fly Ash",
  "Water (kg/m3)": "Water",
  "Superplasticizer (kg/m3)": "SP",
  "Coarse Aggregate (kg/m3)": "Coarse Agg.",
  "Fine Aggregate (kg/m3)": "Fine Agg.",
};

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

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportToCSV(result: PredictResult, age: number) {
  const rows = [
    ["Concrete Mix Design Prediction Report"],
    ["Target Strength (MPa)", result.target],
    ["Curing Age (days)", age],
    ["Verified Strength (MPa)", result.verified],
    ["Error (MPa)", result.error],
    ["Error (%)", result.errorPct],
    [""],
    ["Component", "Predicted (kg/m³)", "Min (kg/m³)", "Max (kg/m³)", "Status"],
    ...result.components.map(c => [
      SHORT_NAMES[c.name] ?? c.name,
      c.value,
      c.min,
      c.max,
      c.status,
    ]),
    [""],
    ["Dataset", result.meta.dataset],
    ["Algorithm", result.meta.algorithm],
    ["Generated", new Date().toISOString()],
  ];
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `concrete_mix_C${result.target}_${age}days.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  const [strength, setStrength] = useState<number>(30);
  const [strengthInput, setStrengthInput] = useState<string>("30");
  const [age, setAge] = useState<number>(28);
  const [activeGrade, setActiveGrade] = useState<number | null>(30);
  const [result, setResult] = useState<PredictResult | null>(null);

  const predictMutation = trpc.concrete.predict.useMutation({
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (err) => {
      toast.error("Prediction failed: " + err.message);
    },
  });

  const handleStrengthChange = useCallback((val: number) => {
    const clamped = Math.min(83, Math.max(2, val));
    setStrength(clamped);
    setStrengthInput(String(clamped));
    setActiveGrade(null);
  }, []);

  const handleGradeSelect = useCallback((gradeVal: number) => {
    setStrength(gradeVal);
    setStrengthInput(String(gradeVal));
    setActiveGrade(gradeVal);
  }, []);

  const handlePredict = () => {
    predictMutation.mutate({ strength, age });
  };

  const sliderPct = ((strength - 2) / (83 - 2)) * 100;

  // Chart data
  const barData = result
    ? result.components.map((c, i) => ({
        name: SHORT_NAMES[c.name] ?? c.name,
        value: c.value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
    : [];

  const pieData = result
    ? result.components.map((c, i) => ({
        name: SHORT_NAMES[c.name] ?? c.name,
        value: c.value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
    : [];

  const verifyColor =
    result && result.errorPct <= 5
      ? "text-green-400"
      : result && result.errorPct <= 15
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="text-primary w-6 h-6" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Concrete Mix Design Predictor
            </h1>
            <p className="text-xs text-muted-foreground">
              ML-powered · UCI Dataset · Prof. I-Cheng Yeh (1998)
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground hidden sm:block">
          Random Forest + kNN Hybrid · 1,030 samples
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel: Inputs ── */}
        <aside className="w-72 min-w-[17rem] border-r border-border bg-card flex flex-col gap-0 overflow-y-auto">
          <div className="p-5 flex flex-col gap-5">
            {/* Section: Strength */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Input Parameters
              </p>
              <label className="block text-sm font-medium text-foreground mb-2">
                Target Compressive Strength
              </label>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  min={2}
                  max={83}
                  step={0.5}
                  value={strengthInput}
                  onChange={(e) => {
                    setStrengthInput(e.target.value);
                    const n = parseFloat(e.target.value);
                    if (!isNaN(n)) handleStrengthChange(n);
                  }}
                  onBlur={() => {
                    const n = parseFloat(strengthInput);
                    if (isNaN(n)) {
                      setStrengthInput(String(strength));
                    } else {
                      handleStrengthChange(n);
                    }
                  }}
                  className="w-24 bg-input border border-border rounded px-3 py-1.5 text-sm text-foreground tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-sm text-muted-foreground font-medium">MPa</span>
              </div>
              <input
                type="range"
                min={2}
                max={83}
                step={0.5}
                value={strength}
                onChange={(e) => handleStrengthChange(parseFloat(e.target.value))}
                style={{
                  background: `linear-gradient(to right, oklch(0.72 0.17 165) ${sliderPct}%, oklch(0.28 0.01 240) ${sliderPct}%)`,
                }}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>2 MPa</span>
                <span>83 MPa</span>
              </div>
            </div>

            {/* Section: Curing Age */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Curing Age
              </label>
              <Select
                value={String(age)}
                onValueChange={(v) => setAge(parseInt(v))}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  {AGE_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} {d === 1 ? "day" : "days"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section: Grade Quick Select */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Quick Select — Concrete Grade
              </p>
              <div className="grid grid-cols-2 gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g.label}
                    onClick={() => handleGradeSelect(g.value)}
                    className={`px-3 py-2 rounded text-sm font-medium border transition-all
                      ${activeGrade === g.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-secondary-foreground border-border hover:border-primary hover:text-primary"
                      }`}
                  >
                    {g.label}
                    <span className="text-xs opacity-70 ml-1">({g.value})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Predict Button */}
            <Button
              onClick={handlePredict}
              disabled={predictMutation.isPending}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              {predictMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Predicting…
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Predict Mix Design
                </>
              )}
            </Button>

            {/* Export Button */}
            <Button
              variant="outline"
              onClick={() => result && exportToCSV(result, age)}
              disabled={!result}
              className="w-full border-border text-foreground hover:border-primary hover:text-primary"
            >
              <Download className="w-4 h-4 mr-2" />
              Export to CSV
            </Button>
          </div>

          {/* Model Info */}
          <div className="mt-auto border-t border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Model Information
            </p>
            <div className="space-y-1 text-xs text-muted-foreground font-mono">
              <div className="flex justify-between">
                <span>Algorithm</span>
                <span className="text-foreground">RF + kNN Blend</span>
              </div>
              <div className="flex justify-between">
                <span>Dataset</span>
                <span className="text-foreground">1,030 samples</span>
              </div>
              <div className="flex justify-between">
                <span>Forward R²</span>
                <span className="text-foreground">0.876</span>
              </div>
              <div className="flex justify-between">
                <span>Strategy</span>
                <span className="text-foreground">kNN 60% + RF 40%</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Right Panel: Results ── */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Results Table */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Predicted Mix Design
              </p>
              {result && (
                <span className="text-xs text-muted-foreground">
                  Target: <span className="text-primary font-semibold">{result.target} MPa</span>
                  {" · "}Age: <span className="text-primary font-semibold">{age} days</span>
                </span>
              )}
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-semibold">Component</th>
                    <th className="text-right px-4 py-3 font-semibold">Predicted (kg/m³)</th>
                    <th className="text-right px-4 py-3 font-semibold">Min</th>
                    <th className="text-right px-4 py-3 font-semibold">Max</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result
                    ? result.components.map((c, i) => (
                        <tr
                          key={c.name}
                          className={`border-t border-border transition-colors ${i % 2 === 0 ? "bg-card" : "bg-background"}`}
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {SHORT_NAMES[c.name] ?? c.name}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">
                            {c.value.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {c.min.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {c.max.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {c.status === "OK" ? (
                              <span className="inline-flex items-center gap-1 text-green-400 text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-yellow-400 text-xs font-semibold">
                                <TriangleAlert className="w-3.5 h-3.5" /> Warning
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    : Array.from({ length: 7 }).map((_, i) => (
                        <tr key={i} className={`border-t border-border ${i % 2 === 0 ? "bg-card" : "bg-background"}`}>
                          <td className="px-4 py-3 text-muted-foreground text-xs italic" colSpan={5}>
                            {i === 3 ? "Run a prediction to see results" : ""}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>

              {/* Verification Row */}
              <div className={`border-t-2 border-border px-4 py-3 flex items-center gap-3 ${result ? "bg-secondary/50" : "bg-secondary/20"}`}>
                <span className="text-sm font-semibold text-foreground">
                  Forward Model Verification:
                </span>
                {result ? (
                  <span className={`text-sm font-bold tabular-nums ${verifyColor}`}>
                    {result.verified.toFixed(2)} MPa
                    <span className="text-muted-foreground font-normal ml-2">
                      (target: {result.target} MPa)
                    </span>
                    <span className="ml-3 text-xs">
                      Δ = {result.error.toFixed(2)} MPa ({result.errorPct.toFixed(1)}%)
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </div>
            </div>
          </section>

          {/* Charts */}
          {result ? (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  Mix Proportions — Bar Chart
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.01 240)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 11 }}
                      angle={-40}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 11 }}
                      label={{ value: "kg/m³", angle: -90, position: "insideLeft", fill: "oklch(0.55 0.01 240)", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.17 0.01 240)",
                        border: "1px solid oklch(0.28 0.01 240)",
                        borderRadius: "6px",
                        color: "oklch(0.92 0.01 240)",
                        fontSize: "12px",
                      }}
                      formatter={(val: number) => [`${val.toFixed(2)} kg/m³`, ""]}
                    />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  Mix Proportions — Percentage Breakdown
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(1)}%`
                      }
                      labelLine={{ stroke: "oklch(0.55 0.01 240)" }}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.17 0.01 240)",
                        border: "1px solid oklch(0.28 0.01 240)",
                        borderRadius: "6px",
                        color: "oklch(0.92 0.01 240)",
                        fontSize: "12px",
                      }}
                      formatter={(val: number) => [`${val.toFixed(2)} kg/m³`, ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : (
            <div className="flex-1 rounded-lg border border-border bg-card flex items-center justify-center min-h-[260px]">
              <div className="text-center text-muted-foreground">
                <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Enter a target strength and click <strong className="text-foreground">Predict Mix Design</strong></p>
                <p className="text-xs mt-1 opacity-60">Charts will appear here after prediction</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Status Bar ── */}
      <footer className="border-t border-border bg-card px-6 py-2 flex items-center gap-4 text-xs text-muted-foreground">
        {predictMutation.isPending ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span>Running ML prediction…</span>
          </>
        ) : result ? (
          <>
            <CheckCircle2 className="w-3 h-3 text-green-400" />
            <span>
              Prediction complete · Target: {result.target} MPa · Verified: {result.verified.toFixed(2)} MPa · Age: {age} days
            </span>
          </>
        ) : (
          <span>Ready · Enter a target compressive strength and click Predict.</span>
        )}
      </footer>
    </div>
  );
}
