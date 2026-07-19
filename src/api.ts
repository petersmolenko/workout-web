/**
 * api.ts — клиент к Workout API (server/).
 *
 * Все запросы идут через одну функцию req(): она добавляет базовый URL,
 * заголовки и превращает не-2xx ответы в исключения с текстом ошибки
 * из поля detail (его отдаёт FastAPI).
 */
import type { Workout } from "./types";

/** Адрес API. Можно переопределить при сборке: VITE_API_BASE=... npm run build */
export const API_BASE: string =
  (import.meta as any).env?.VITE_API_BASE ?? "http://127.0.0.1:8000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    // FastAPI кладёт описание ошибки в {"detail": ...}
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) detail = typeof body.detail === "string"
        ? body.detail
        : JSON.stringify(body.detail);
    } catch { /* тело не JSON — оставляем HTTP-код */ }
    throw new Error(detail);
  }
  // 204 No Content — тела нет
  return res.status === 204 ? (undefined as T) : res.json();
}

/** Жив ли сервер. Таймаут 1500 мс, чтобы приложение не «висело» без API. */
export async function checkApi(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    await req("/health", { signal: ctrl.signal });
    clearTimeout(t);
    return true;
  } catch {
    return false;
  }
}

// ---- типы ответов списка (зеркало server/schemas.py) ----
export interface WorkoutSummary {
  id: string; date: string; title: string;
  muscleGroups: string[]; status: string; source: string;
  exerciseCount: number;
}
export interface WorkoutList { total: number; items: WorkoutSummary[] }

export function listWorkouts(p: {
  year?: string; group?: string; q?: string; limit?: number; offset?: number;
}): Promise<WorkoutList> {
  const qs = new URLSearchParams();
  if (p.year) qs.set("year", p.year);
  if (p.group) qs.set("group", p.group);
  if (p.q) qs.set("q", p.q);
  qs.set("limit", String(p.limit ?? 500));
  qs.set("offset", String(p.offset ?? 0));
  return req(`/workouts?${qs}`);
}

export const getWorkout = (id: string) => req<Workout>(`/workouts/${id}`);
export const getExercises = () => req<any[]>(`/exercises`);
export const createWorkout = (body: unknown) =>
  req<Workout>(`/workouts`, { method: "POST", body: JSON.stringify(body) });
export const reportFact = (id: string, body: unknown) =>
  req<Workout>(`/workouts/${id}/fact`, { method: "POST", body: JSON.stringify(body) });

/** Генерация тренировки через Claude (займёт 10–30 с). */
export const generate = (body: { wish: string; date?: string; save?: boolean }) =>
  req<{ draft: unknown; workoutId: string | null }>(`/generate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
