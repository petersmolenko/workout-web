import type { WorkoutSet, WorkoutExercise, Workout } from "./types";

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

const UNIT_LABEL: Record<string, (v: string) => string> = {
  kg: v => `${v} кг`,
  kg_per_side: v => `${v} кг/стор`,
  plates: v => `${v} плит.`,
  discs: v => `${v} блин.`,
  seconds: v => `${v} с`,
  bodyweight: () => `свой вес`,
};

export function fmtWeight(s: WorkoutSet): string {
  const w = s.weight;
  if (!w) return "—";
  if (w.value == null) return w.unit === "bodyweight" ? "свой вес" : (w.raw ?? "?");
  const v = w.valueMax != null ? `${w.value}–${w.valueMax}` : `${w.value}`;
  return (UNIT_LABEL[w.unit] ?? ((x: string) => x))(v);
}

export function fmtReps(s: WorkoutSet): string {
  const parts: string[] = [];
  if (s.reps?.min != null) {
    parts.push(s.reps.max !== s.reps.min ? `×${s.reps.min}-${s.reps.max}` : `×${s.reps.min}`);
  }
  if (s.toFailure) parts.push("отказ");
  if (s.warmup) parts.push("разминка");
  if (s.comment) parts.push(s.comment);
  return parts.join(" · ");
}

/** Экранирует строку и подсвечивает вхождение query тегом <mark>. */
export function highlight(name: string, query: string): string {
  const q = query.trim().toLowerCase();
  if (!q) return esc(name);
  const i = name.toLowerCase().indexOf(q);
  if (i < 0) return esc(name);
  return (
    esc(name.slice(0, i)) +
    "<mark>" + esc(name.slice(i, i + q.length)) + "</mark>" +
    esc(name.slice(i + q.length))
  );
}

export function allExercises(w: Workout): WorkoutExercise[] {
  return w.blocks.flatMap(b => b.exercises);
}

export function matchQuery(e: WorkoutExercise, q: string): boolean {
  return (
    e.rawName.toLowerCase().includes(q) ||
    (e.exerciseName ?? "").toLowerCase().includes(q)
  );
}
