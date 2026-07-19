<script setup lang="ts">
/**
 * WorkoutCard — карточка тренировки в списке.
 * Заголовок рисуется из короткой сводки (summary), детали (blocks) приходят
 * позже — когда карточку раскрыли и App.vue подгрузил полную тренировку.
 * Кнопка «Отчёт» открывает форму факта (только не для истории тренера).
 */
import { ref } from "vue";
import type { Workout, WorkoutBlock } from "../types";
import type { WorkoutSummary } from "../api";
import { fmtDate } from "../utils";
import ExerciseItem from "./ExerciseItem.vue";
import ReportForm from "./ReportForm.vue";

defineProps<{
  summary: WorkoutSummary;
  detail?: Workout;          // undefined, пока не загружено
  query: string;
  open: boolean;
  canReport: boolean;        // false в режиме без сервера
}>();
const emit = defineEmits<{ toggle: []; updated: [w: Workout] }>();

const reporting = ref(false);

const STATUS_LABEL: Record<string, string> = {
  planned: "запланирована", skipped: "пропущена",
};

function blockLabel(b: WorkoutBlock): string {
  return b.type === "triset" ? "Трисет" : "Суперсет";
}

function onSaved(w: Workout) {
  reporting.value = false;
  emit("updated", w);
}
</script>

<template>
  <div class="wcard" @click="$emit('toggle')">
    <div class="whead">
      <span class="wdate">{{ fmtDate(summary.date) }}</span>
      <span class="wtitle">{{ summary.title }}</span>
      <span v-if="STATUS_LABEL[summary.status]" class="status" :class="summary.status">
        {{ STATUS_LABEL[summary.status] }}
      </span>
      <span class="wmeta">{{ summary.exerciseCount }} упр. {{ open ? "▲" : "▼" }}</span>
    </div>
    <div class="groups">
      <span v-for="g in summary.muscleGroups" :key="g" class="group">{{ g }}</span>
    </div>

    <div v-if="open" class="detail" @click.stop>
      <template v-if="detail">
        <div v-if="canReport && detail.source !== 'trainer_history'" class="actions">
          <button class="btn" @click="reporting = !reporting">
            {{ reporting ? "Скрыть отчёт" : (detail.status === "planned" ? "Отчёт о выполнении" : "Править отчёт") }}
          </button>
        </div>

        <ReportForm v-if="reporting" :workout="detail" @saved="onSaved" />

        <template v-else>
          <div v-for="(b, i) in detail.blocks" :key="i" class="block">
            <div v-if="b.type !== 'single'" class="superset">
              <div class="ss-label">⚡ {{ blockLabel(b) }} — подряд, без отдыха</div>
              <ExerciseItem v-for="e in b.exercises" :key="e.order" :exercise="e" :query="query" />
            </div>
            <template v-else>
              <ExerciseItem v-for="e in b.exercises" :key="e.order" :exercise="e" :query="query" />
            </template>
          </div>
          <div class="footer">
            <div v-if="detail.cardio"><span class="flabel">Кардио</span>{{ detail.cardio }}</div>
            <div v-if="detail.notes"><span class="flabel">Заметки</span>{{ detail.notes }}</div>
            <div v-if="detail.feedback"><span class="flabel">Итог</span>{{ detail.feedback }}</div>
          </div>
        </template>
      </template>
      <div v-else class="empty">Загрузка…</div>
    </div>
  </div>
</template>
