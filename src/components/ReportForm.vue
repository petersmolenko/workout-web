<script setup lang="ts">
/**
 * ReportForm — отчёт «что сделал по факту» для одной тренировки.
 *
 * Для каждого планового подхода строится строка с чекбоксом «выполнен»,
 * весом и повторениями, предзаполненными из плана — обычно достаточно
 * поправить пару цифр. Невыполненные подходы просто снимаются галочкой.
 * Отправка: POST /workouts/{id}/fact (повторная отправка перезаписывает).
 */
import { ref } from "vue";
import type { Workout, WorkoutExercise } from "../types";
import { fmtWeight } from "../utils";
import * as api from "../api";

const props = defineProps<{ workout: Workout }>();
const emit = defineEmits<{ saved: [w: Workout] }>();

interface SetRow { done: boolean; weight: number | null; unit: string; reps: number | null; toFailure: boolean }
interface ExRow { order: number; name: string; skipped: boolean; comment: string; sets: SetRow[]; planLabels: string[] }

/** Плоский список упражнений (блоки для отчёта не важны). */
function flat(w: Workout): WorkoutExercise[] {
  return w.blocks.flatMap(b => b.exercises);
}

/** Предзаполнение из плана (или из прежнего факта, если отчёт правится). */
function initRows(): ExRow[] {
  return flat(props.workout).map(e => {
    const src = e.fact?.sets.length ? e.fact.sets : e.plan.sets;
    const sets: SetRow[] = src.map(s => ({
      done: true,
      weight: s.weight?.value ?? null,
      unit: s.weight?.unit ?? "kg",
      reps: s.reps?.max ?? s.reps?.min ?? null,
      toFailure: !!s.toFailure,
    }));
    return {
      order: e.order,
      name: e.exerciseName ?? e.rawName,
      skipped: !!e.fact?.skipped,
      comment: e.fact?.comment ?? "",
      sets,
      planLabels: e.plan.sets.map(s => fmtWeight(s)),
    };
  });
}

const rows = ref<ExRow[]>(initRows());
const feedback = ref(props.workout.feedback ?? "");
const saving = ref(false);
const error = ref("");

const UNIT_SHORT: Record<string, string> = {
  kg: "кг", kg_per_side: "кг/стор", plates: "плит.", discs: "блин.",
  bodyweight: "св.вес", seconds: "с",
};

async function submit() {
  error.value = ""; saving.value = true;
  try {
    const body = {
      feedback: feedback.value.trim() || null,
      status: "completed",
      exercises: rows.value.map(r => ({
        order: r.order,
        skipped: r.skipped,
        comment: r.comment.trim() || null,
        sets: r.skipped ? [] : r.sets.filter(s => s.done).map(s => ({
          weight: s.unit === "bodyweight"
            ? { value: null, unit: "bodyweight" }
            : { value: s.weight, unit: s.unit },
          reps: s.reps != null ? { min: s.reps, max: s.reps } : null,
          toFailure: s.toFailure,
        })),
      })),
    };
    const w = await api.reportFact(props.workout.id, body);
    emit("saved", w);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="form report">
    <div v-for="r in rows" :key="r.order" class="exrow" :class="{ off: r.skipped }">
      <div class="frow2">
        <span class="ex-num">{{ r.order }}</span>
        <b class="grow">{{ r.name }}</b>
        <label class="chk"><input v-model="r.skipped" type="checkbox" /> пропустил</label>
      </div>
      <template v-if="!r.skipped">
        <div v-for="(s, i) in r.sets" :key="i" class="frow2 setline">
          <label class="chk">
            <input v-model="s.done" type="checkbox" />
            подход {{ i + 1 }}
            <span class="planhint" v-if="r.planLabels[i]">(план: {{ r.planLabels[i] }})</span>
          </label>
          <template v-if="s.done">
            <input v-model.number="s.weight" type="number" step="0.5" class="wnum"
                   :disabled="s.unit === 'bodyweight'" />
            <span class="unit">{{ UNIT_SHORT[s.unit] ?? s.unit }}</span>
            <span class="unit">×</span>
            <input v-model.number="s.reps" type="number" min="0" class="wnum" />
            <label class="chk"><input v-model="s.toFailure" type="checkbox" /> отказ</label>
          </template>
        </div>
      </template>
      <input v-model="r.comment" class="notein" placeholder="комментарий (тяжело / легко / болело…)" />
    </div>

    <label class="glabel">Итог тренировки</label>
    <textarea v-model="feedback" rows="2"
              placeholder="общее впечатление, самочувствие, что заметил"></textarea>

    <div v-if="error" class="errorbar">{{ error }}</div>
    <button class="btn primary" :disabled="saving" @click="submit">
      {{ saving ? "Сохраняю…" : "Сохранить отчёт" }}
    </button>
  </div>
</template>
