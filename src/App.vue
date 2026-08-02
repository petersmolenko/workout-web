<script setup lang="ts">
/**
 * App.vue — корневой компонент: режим работы, вкладки, фильтры, список.
 *
 * Два режима:
 *  - api   — сервер (server/) доступен: история грузится с него, доступны
 *            создание тренировок и отчёты;
 *  - local — сервера нет: работаем read-only на JSON, зашитом в бандл
 *            (данные на момент сборки).
 */
import { ref, computed, watch, onMounted } from "vue";
import exercisesData from "./data/exercises.json";
import type { WorkoutsFile, ExerciseDictionary, ExerciseDef, Workout } from "./types";
import { allExercises, matchQuery } from "./utils";
import * as api from "./api";
import WorkoutCard from "./components/WorkoutCard.vue";
import DictPanel from "./components/DictPanel.vue";
import NewWorkoutForm from "./components/NewWorkoutForm.vue";

// Локальная история (~1.5 МБ) НЕ вшивается в основной бандл, а грузится
// отдельным чанком только когда сервер недоступен (режим local). В Docker
// с рабочим API этот файл вообще не скачивается - критический JS остаётся
// лёгким и не «висит» в pending на медленной сети / низком MTU.
let LOCAL: WorkoutsFile | null = null;
async function ensureLocal(): Promise<WorkoutsFile> {
  if (!LOCAL) LOCAL = (await import("./data/workouts.json")).default as unknown as WorkoutsFile;
  return LOCAL;
}
const LOCAL_DICT = exercisesData as unknown as ExerciseDictionary;

const mode = ref<"checking" | "api" | "local">("checking");
const tab = ref<"history" | "new" | "dict">("history");
const query = ref("");
const group = ref("");
const year = ref("");
const error = ref("");

/** Короткий список карточек (в api-режиме приходит с сервера). */
const list = ref<api.WorkoutSummary[]>([]);
/** Кэш полных тренировок: id → Workout (детали грузим лениво, по клику). */
const details = ref<Record<string, Workout>>({});
const openIds = ref(new Set<string>());
const dict = ref<ExerciseDictionary>(LOCAL_DICT);
const exById = computed(() => new Map<string, ExerciseDef>(dict.value.exercises.map(e => [e.id, e])));

const years = computed(() => {
  const ys = new Set(list.value.map(w => w.date.slice(0, 4)));
  return [...ys].sort();
});

// ---------- загрузка списка ----------
function localList(local: WorkoutsFile): api.WorkoutSummary[] {
  const q = query.value.trim().toLowerCase();
  return local.workouts
    .filter(w => {
      if (year.value && !w.date.startsWith(year.value)) return false;
      if (group.value) {
        const inTitle = (w.muscleGroups as string[]).includes(group.value);
        const inEx = allExercises(w).some(
          e => e.exerciseId && exById.value.get(e.exerciseId)?.group === group.value);
        if (!inTitle && !inEx) return false;
      }
      if (q && !allExercises(w).some(e => matchQuery(e, q))) return false;
      return true;
    })
    .map(w => ({
      id: w.id, date: w.date, title: w.title,
      muscleGroups: w.muscleGroups as string[],
      status: w.status, source: w.source,
      exerciseCount: allExercises(w).length,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

async function reload() {
  error.value = "";
  if (mode.value === "api") {
    try {
      const res = await api.listWorkouts({
        year: year.value || undefined,
        group: group.value || undefined,
        q: query.value.trim() || undefined,
      });
      list.value = res.items;
    } catch (e) {
      error.value = `Ошибка API: ${(e as Error).message}`;
    }
  } else {
    list.value = localList(await ensureLocal());
  }
}

// Дебаунс поиска: не дёргаем сервер на каждую букву, ждём паузу 250 мс.
let debounce: ReturnType<typeof setTimeout>;
watch(query, () => { clearTimeout(debounce); debounce = setTimeout(reload, 250); });
watch([group, year], reload);

onMounted(async () => {
  mode.value = (await api.checkApi()) ? "api" : "local";
  if (mode.value === "api") {
    try { dict.value = { groups: LOCAL_DICT.groups, exercises: await api.getExercises() as ExerciseDef[] }; }
    catch { /* останется локальный словарь */ }
  }
  await reload();
});

// ---------- раскрытие карточки: ленивый детальный запрос ----------
async function toggle(id: string) {
  const s = new Set(openIds.value);
  if (s.has(id)) { s.delete(id); openIds.value = s; return; }
  if (!details.value[id]) {
    if (mode.value === "api") {
      try { details.value[id] = await api.getWorkout(id); }
      catch (e) { error.value = `Ошибка API: ${(e as Error).message}`; return; }
    } else {
      const w = (await ensureLocal()).workouts.find(w => w.id === id);
      if (w) details.value[id] = w;
    }
  }
  s.add(id); openIds.value = s;
}

/** После отчёта сервер возвращает обновлённую тренировку — кладём в кэш. */
function onUpdated(w: Workout) {
  details.value[w.id] = w;
  reload();
}

/** После создания: перечитать список, раскрыть новую карточку. */
async function onCreated(w: Workout) {
  details.value[w.id] = w;
  tab.value = "history";
  year.value = ""; group.value = ""; query.value = "";
  await reload();
  openIds.value = new Set([w.id]);
}
</script>

<template>
  <div class="wrap">
    <h1>WORKOUT</h1>
    <div class="sub">
      <template v-if="mode === 'api'">API: {{ }}подключено · {{ list.length }} тренировок</template>
      <template v-else-if="mode === 'local'">
        ⚠ Сервер недоступен — режим просмотра (данные на момент сборки).
        Запусти API: <code>cd server && uvicorn main:app</code>
      </template>
      <template v-else>Подключение…</template>
    </div>
    <div v-if="error" class="errorbar">{{ error }}</div>

    <div class="tabs">
      <button class="tabbtn" :class="{ active: tab === 'history' }" @click="tab = 'history'">История</button>
      <button class="tabbtn" :class="{ active: tab === 'new' }" @click="tab = 'new'"
              :disabled="mode !== 'api'"
              :title="mode !== 'api' ? 'нужен запущенный сервер' : ''">+ Новая</button>
      <button class="tabbtn" :class="{ active: tab === 'dict' }" @click="tab = 'dict'">Справочник</button>
    </div>

    <template v-if="tab === 'history'">
      <div class="controls">
        <input v-model="query" type="search" placeholder="Поиск по упражнению…" />
        <select v-model="group">
          <option value="">Все группы</option>
          <option v-for="g in dict.groups" :key="g" :value="g">{{ g }}</option>
        </select>
        <select v-model="year">
          <option value="">Все годы</option>
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>
        <div class="count">Найдено: {{ list.length }} тренировок</div>
      </div>
      <WorkoutCard
        v-for="w in list" :key="w.id"
        :summary="w" :detail="details[w.id]" :query="query"
        :open="openIds.has(w.id)" :can-report="mode === 'api'"
        @toggle="toggle(w.id)" @updated="onUpdated" />
      <div v-if="!list.length" class="empty">Ничего не найдено</div>
    </template>

    <NewWorkoutForm v-else-if="tab === 'new'" :dict="dict" @created="onCreated" />
    <DictPanel v-else :dict="dict" :query="query" :group="group" />
  </div>
</template>
