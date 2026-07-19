<script setup lang="ts">
/**
 * NewWorkoutForm — конструктор тренировки (вкладка «+ Новая»).
 *
 * Упрощения первой версии:
 *  - каждое упражнение — отдельный блок "single" (без конструктора суперсетов);
 *  - схема одинаковая для всех подходов упражнения: N подходов × повторения ×
 *    вес; флаг «последний в отказ» помечает крайний подход.
 * plan.raw собирается автоматически — как писал тренер: «4×8 | 60 кг».
 */
import { ref, computed } from "vue";
import type { ExerciseDictionary } from "../types";
import * as api from "../api";

const props = defineProps<{ dict: ExerciseDictionary }>();
const emit = defineEmits<{ created: [w: any] }>();

const UNITS = [
  { v: "kg", label: "кг" },
  { v: "kg_per_side", label: "кг/сторона" },
  { v: "plates", label: "плитки" },
  { v: "bodyweight", label: "свой вес" },
];

interface Row {
  exerciseId: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  weight: number | null;
  unit: string;
  lastToFailure: boolean;
  note: string;
}
const blank = (): Row => ({
  exerciseId: "", sets: 3, repsMin: 10, repsMax: 12,
  weight: null, unit: "kg", lastToFailure: false, note: "",
});

const today = new Date().toISOString().slice(0, 10);
const date = ref(today);
const title = ref("");
const groups = ref<Set<string>>(new Set());
const cardio = ref("");
const notes = ref("");
const rows = ref<Row[]>([blank()]);
const saving = ref(false);
const error = ref("");

// ---- генерация через Claude ----
const wish = ref("");
const generating = ref(false);

/** Просим сервер сгенерировать и сразу сохранить (save=true) — созданная
 *  тренировка со статусом planned откроется в истории, там же её можно
 *  отработать и отчитаться. */
async function generateNow() {
  error.value = ""; generating.value = true;
  try {
    const res = await api.generate({ wish: wish.value, date: date.value, save: true });
    if (res.workoutId) {
      const w = await api.getWorkout(res.workoutId);
      emit("created", w);
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    generating.value = false;
  }
}

/** Справочник, сгруппированный для <optgroup>. */
const byGroup = computed(() => {
  const m = new Map<string, typeof props.dict.exercises>();
  for (const e of props.dict.exercises) {
    if (!m.has(e.group)) m.set(e.group, []);
    m.get(e.group)!.push(e);
  }
  return m;
});

function toggleGroup(g: string) {
  const s = new Set(groups.value);
  s.has(g) ? s.delete(g) : s.add(g);
  groups.value = s;
}

function exName(id: string): string {
  return props.dict.exercises.find(e => e.id === id)?.name ?? "";
}

/** Автозаголовок из выбранных групп, если поле не заполнено вручную. */
const effectiveTitle = computed(
  () => title.value.trim() || [...groups.value].join(", ") || "Тренировка"
);

const valid = computed(() =>
  rows.value.length > 0 && rows.value.every(r => r.exerciseId && r.sets >= 1)
);

function rowToExercise(r: Row) {
  const unitLabel = UNITS.find(u => u.v === r.unit)?.label ?? r.unit;
  const repsTxt = r.repsMin != null
    ? (r.repsMax && r.repsMax !== r.repsMin ? `${r.repsMin}-${r.repsMax}` : `${r.repsMin}`)
    : "?";
  const weightTxt = r.unit === "bodyweight" ? "свой вес"
    : r.weight != null ? `${r.weight} ${unitLabel}` : "";
  const raw = `${r.sets}×${repsTxt}${weightTxt ? " | " + weightTxt : ""}${r.lastToFailure ? ", последний в отказ" : ""}`;
  const sets = Array.from({ length: r.sets }, (_, i) => ({
    weight: r.unit === "bodyweight"
      ? { value: null, unit: "bodyweight" }
      : { value: r.weight, unit: r.unit },
    reps: r.repsMin != null ? { min: r.repsMin, max: r.repsMax ?? r.repsMin } : null,
    toFailure: r.lastToFailure && i === r.sets - 1,
  }));
  return {
    exerciseId: r.exerciseId,
    rawName: exName(r.exerciseId),
    note: r.note.trim() || null,
    plan: { raw, parsed: true, setsCount: r.sets, sets },
  };
}

async function submit() {
  error.value = ""; saving.value = true;
  try {
    const w = await api.createWorkout({
      date: date.value,
      title: effectiveTitle.value,
      muscleGroups: [...groups.value],
      source: "manual",
      blocks: rows.value.map(r => ({ type: "single", exercises: [rowToExercise(r)] })),
      cardio: cardio.value.trim() || null,
      notes: notes.value.trim() || null,
    });
    emit("created", w);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="form">
    <div class="genpanel">
      <div class="glabel">🤖 Сгенерировать тренировку (Claude)</div>
      <div class="frow2">
        <input v-model="wish" class="grow"
               placeholder="пожелание: «ноги, средняя тяжесть, около часа»"
               @keyup.enter="generateNow" />
        <button type="button" class="btn primary" :disabled="generating" @click="generateNow">
          {{ generating ? "Генерирую… (10–30 с)" : "Сгенерировать" }}
        </button>
      </div>
      <div class="planhint">План составится по твоей истории и сохранится как «запланирована» — или собери вручную ниже.</div>
    </div>

    <div class="frow2">
      <label>Дата <input v-model="date" type="date" /></label>
      <label class="grow">Название <input v-model="title" :placeholder="effectiveTitle" /></label>
    </div>

    <div class="glabel">Группы мышц</div>
    <div class="groups">
      <button
        v-for="g in dict.groups" :key="g" type="button"
        class="group pick" :class="{ on: groups.has(g) }"
        @click="toggleGroup(g)">{{ g }}</button>
    </div>

    <div class="glabel">Упражнения</div>
    <div v-for="(r, i) in rows" :key="i" class="exrow">
      <div class="frow2">
        <span class="ex-num">{{ i + 1 }}</span>
        <select v-model="r.exerciseId" class="grow">
          <option value="" disabled>— выбери упражнение —</option>
          <optgroup v-for="[g, list] in byGroup" :key="g" :label="g">
            <option v-for="e in list" :key="e.id" :value="e.id">{{ e.name }}</option>
          </optgroup>
        </select>
        <button type="button" class="btn danger" title="убрать"
                @click="rows.splice(i, 1)">✕</button>
      </div>
      <div class="frow2 scheme">
        <label>подходы <input v-model.number="r.sets" type="number" min="1" max="10" /></label>
        <label>повт. от <input v-model.number="r.repsMin" type="number" min="1" /></label>
        <label>до <input v-model.number="r.repsMax" type="number" min="1" /></label>
        <label>вес <input v-model.number="r.weight" type="number" step="0.5"
                          :disabled="r.unit === 'bodyweight'" /></label>
        <select v-model="r.unit">
          <option v-for="u in UNITS" :key="u.v" :value="u.v">{{ u.label }}</option>
        </select>
        <label class="chk"><input v-model="r.lastToFailure" type="checkbox" /> последний в отказ</label>
      </div>
      <input v-model="r.note" class="notein" placeholder="примечание (постановка ног, пояс…)" />
    </div>
    <button type="button" class="btn" @click="rows.push(blank())">+ упражнение</button>

    <div class="frow2">
      <label class="grow">Кардио <input v-model="cardio" placeholder="велосипед 30 мин, пульс 130" /></label>
    </div>
    <div class="frow2">
      <label class="grow">Заметки <input v-model="notes" /></label>
    </div>

    <div v-if="error" class="errorbar">{{ error }}</div>
    <button class="btn primary" :disabled="!valid || saving" @click="submit">
      {{ saving ? "Сохраняю…" : "Сохранить тренировку" }}
    </button>
  </div>
</template>
