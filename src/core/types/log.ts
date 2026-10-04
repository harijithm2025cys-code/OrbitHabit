export type LogSource = 'manual' | 'timer' | 'gps';

export interface HabitLog {
  id: string;
  habit_id: string;
  date: string; // 'YYYY-MM-DD'
  progress: number;
  completed: number; // 0 or 1
  completed_at: number | null; // timestamp in ms
  source: LogSource;
}

export type TimerSessionStatus = 'running' | 'paused' | 'done' | 'cancelled';

export interface TimerSession {
  id: string;
  habit_id: string;
  start_ts: number;
  target_seconds: number;
  paused_total_ms: number;
  last_paused_at: number | null;
  status: TimerSessionStatus;
}

export interface GpsCoordinate {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
  speed?: number | null;
}

export interface RunRecord {
  id: string;
  habit_id: string;
  start_ts: number;
  end_ts: number;
  distance_m: number;
  duration_s: number;
  route_json: string; // stringified GpsCoordinate[]
}
