<script setup lang="ts">
/**
 * ExerciseItem — упражнение в карточке: план чипами (или raw-строкой,
 * если схема не разобрана) и, если есть, факт — вторым рядом зелёных чипов.
 */
import { computed } from "vue";
import type { WorkoutExercise, WorkoutSet } from "../types";
import { fmtWeight, fmtReps, highlight } from "../utils";

const props = defineProps<{
  exercise: WorkoutExercise;
  query: string;
}>();

const canonHtml = computed(() => {
  const e = props.exercise;
  if (!e.exerciseName || e.exerciseName.toLowerCase() === e.rawName.toLowerCase()) return "";
  return highlight(e.exerciseName, props.query);
});
const nameHtml = computed(() => highlight(props.exercise.rawName, props.query));

function setClass(s: WorkoutSet) {
  return { set: true, fail: !!s.toFailure, warmup: !!s.warmup };
}
</script>

<template>
  <div class="exercise">
    <div class="ex-top">
      <span class="ex-num">{{ exercise.order }}</span>
      <span class="ex-name">
        <span v-html="nameHtml" />
        <span v-if="canonHtml" class="ex-canon"> → <span v-html="canonHtml" /></span>
      </span>
    </div>
    <div v-if="exercise.note" class="ex-note">{{ exercise.note }}</div>

    <div v-if="exercise.plan.parsed && exercise.plan.sets.length" class="sets">
      <div v-for="(s, i) in exercise.plan.sets" :key="i" :class="setClass(s)">
        {{ fmtWeight(s) }}
        <small v-if="fmtReps(s)">{{ fmtReps(s) }}</small>
      </div>
    </div>
    <div v-else class="rawplan" title="схема не разобрана автоматически — исходный текст плана">
      {{ exercise.plan.raw }}
    </div>

    <!-- Факт: что реально сделано -->
    <template v-if="exercise.fact">
      <div v-if="exercise.fact.skipped" class="factline skipped">пропущено</div>
      <div v-else-if="exercise.fact.sets.length" class="sets">
        <span class="factlabel">факт:</span>
        <div v-for="(s, i) in exercise.fact.sets" :key="i" class="set done">
          {{ fmtWeight(s) }}
          <small v-if="fmtReps(s)">{{ fmtReps(s) }}</small>
        </div>
      </div>
      <div v-if="exercise.fact.comment" class="ex-note">💬 {{ exercise.fact.comment }}</div>
    </template>
  </div>
</template>
