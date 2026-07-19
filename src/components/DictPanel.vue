<script setup lang="ts">
import { ref, computed } from "vue";
import type { ExerciseDictionary } from "../types";

const props = defineProps<{
  dict: ExerciseDictionary;
  query: string;
  group: string;
}>();

const openIds = ref(new Set<string>());

const list = computed(() => {
  const q = props.query.trim().toLowerCase();
  let items = props.dict.exercises;
  if (props.group) items = items.filter(e => e.group === props.group);
  if (q) {
    items = items.filter(
      e => e.name.toLowerCase().includes(q) || e.aliases.some(a => a.includes(q))
    );
  }
  return items;
});

function toggle(id: string) {
  const s = new Set(openIds.value);
  s.has(id) ? s.delete(id) : s.add(id);
  openIds.value = s;
}
</script>

<template>
  <div>
    <div
      v-for="e in list" :key="e.id"
      class="dict-item" :class="{ open: openIds.has(e.id) }"
      @click="toggle(e.id)">
      <div class="dict-head">
        <span class="dict-name">{{ e.name }}</span>
        <span class="dict-meta">
          {{ e.group }}<template v-if="e.subgroup"> · {{ e.subgroup }}</template>
          · {{ e.equipment }} · {{ e.mentions }} уп.
        </span>
      </div>
      <div class="dict-aliases">
        Формулировки тренера: {{ e.aliases.join("; ") }}
      </div>
    </div>
    <div v-if="!list.length" class="empty">Ничего не найдено</div>
  </div>
</template>
