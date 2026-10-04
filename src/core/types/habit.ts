export type HabitType = 'check' | 'timer' | 'distance' | 'count' | 'checklist' | 'alarm';

export interface Habit {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  type: HabitType;
  target_value: number; // minutes for timer, km for distance, count for count, 1 for check/alarm, items count for checklist
  unit: string; // 'min' | 'km' | 'times' | 'done' | 'items' | 'alarm'
  repeat_days: number[]; // [0, 1, 2, 3, 4, 5, 6] where 0 = Sunday
  checklist_items?: string[];
  alarm_time?: string;
  alarm_sound?: string;
  created_at: number; // timestamp in ms
  archived: number; // 0 or 1
}

export interface HabitWithTodayStatus extends Habit {
  today_progress: number;
  today_completed: boolean;
  streak_current: number;
  streak_best: number;
}

