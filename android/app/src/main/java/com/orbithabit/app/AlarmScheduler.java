package com.orbithabit.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;

/**
 * Native alarm engine for OrbitHabit.
 *
 * Uses AlarmManager.setAlarmClock() for highest OS priority and Doze survival,
 * especially critical on aggressive OEM battery managers like Vivo / iQOO (OriginOS).
 * Persists scheduled reminders in SharedPreferences so alarms survive app kills and reboots.
 */
public class AlarmScheduler {

    private static final String TAG = "OrbitHabit.AlarmScheduler";
    public static final String PREFS_NAME = "orbit_native_alarms_prefs";
    public static final String KEY_REMINDERS = "orbit_saved_reminders";
    public static final String KEY_PENDING_ACTIONS = "orbit_pending_actions";
    public static final String KEY_LAST_DELIVERED_TITLE = "orbit_last_delivered_title";
    public static final String KEY_LAST_DELIVERED_TIME = "orbit_last_delivered_time";
    public static final String KEY_CHAT_STYLE = "orbit_chat_style_enabled";

    public static boolean isChatStyleEnabled(Context context) {
        if (context == null) return true;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean(KEY_CHAT_STYLE, true);
    }

    public static void setChatStyleEnabled(Context context, boolean enabled) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_CHAT_STYLE, enabled).apply();
    }

    public static class ReminderItem {
        public String id;
        public String habitId;
        public String title;
        public String body;
        public int hour;
        public int minute;
        public List<Integer> weekdays = new ArrayList<>(); // 0 = Sun, 1 = Mon ... 6 = Sat
        public String sound = "ringtone_1";
        public boolean vibrate = true;
        public boolean enabled = true;
        public long nextTriggerMs = 0;

        public static ReminderItem fromJson(JSONObject obj) {
            ReminderItem item = new ReminderItem();
            item.id = obj.optString("id", "");
            item.habitId = obj.optString("habitId", "");
            item.title = obj.optString("title", "Orbit Reminder");
            item.body = obj.optString("body", "");
            item.hour = obj.optInt("hour", 8);
            String rawSound = obj.optString("sound", "ringtone_1");
            if (rawSound != null && rawSound.startsWith("uri:")) {
                item.sound = rawSound;
            } else {
                item.sound = (rawSound != null ? rawSound : "ringtone_1").replace(".mp3", "").replace(".wav", "");
            }
            item.enabled = obj.optBoolean("enabled", true);
            item.nextTriggerMs = obj.optLong("nextTriggerMs", 0);

            JSONArray daysArr = obj.optJSONArray("weekdays");
            if (daysArr != null) {
                for (int i = 0; i < daysArr.length(); i++) {
                    item.weekdays.add(daysArr.optInt(i));
                }
            } else {
                for (int i = 0; i <= 6; i++) item.weekdays.add(i);
            }
            return item;
        }

        public JSONObject toJson() {
            JSONObject obj = new JSONObject();
            try {
                obj.put("id", id);
                obj.put("habitId", habitId);
                obj.put("title", title);
                obj.put("body", body);
                obj.put("hour", hour);
                obj.put("minute", minute);
                obj.put("sound", sound);
                obj.put("vibrate", vibrate);
                obj.put("enabled", enabled);
                obj.put("nextTriggerMs", nextTriggerMs);
                JSONArray arr = new JSONArray();
                for (int d : weekdays) arr.put(d);
                obj.put("weekdays", arr);
            } catch (Exception ignored) {}
            return obj;
        }
    }

    /**
     * Calculates the exact upcoming trigger timestamp (in ms) for given hour, minute and weekdays.
     * weekdays: 0=Sunday, 1=Monday, ..., 6=Saturday.
     */
    public static long calculateNextTriggerMs(int hour, int minute, List<Integer> weekdays) {
        if (weekdays == null || weekdays.isEmpty()) {
            weekdays = new ArrayList<>();
            for (int i = 0; i <= 6; i++) weekdays.add(i);
        }

        Calendar now = Calendar.getInstance();
        long nowMs = now.getTimeInMillis();

        long earliestTrigger = Long.MAX_VALUE;

        // Check for each matching day within the next 8 days (covering today + next full week)
        for (int dayOffset = 0; dayOffset <= 7; dayOffset++) {
            Calendar candidate = Calendar.getInstance();
            candidate.add(Calendar.DAY_OF_YEAR, dayOffset);
            candidate.set(Calendar.HOUR_OF_DAY, hour);
            candidate.set(Calendar.MINUTE, minute);
            candidate.set(Calendar.SECOND, 0);
            candidate.set(Calendar.MILLISECOND, 0);

            // Calendar.DAY_OF_WEEK: Sunday=1, Monday=2 ... Saturday=7
            // Convert to our 0=Sun..6=Sat mapping
            int candDayIndex = candidate.get(Calendar.DAY_OF_WEEK) - 1;

            if (weekdays.contains(candDayIndex)) {
                long candMs = candidate.getTimeInMillis();
                // Must be at least 2 seconds in the future
                if (candMs > nowMs + 2000) {
                    if (candMs < earliestTrigger) {
                        earliestTrigger = candMs;
                    }
                }
            }
        }

        if (earliestTrigger == Long.MAX_VALUE) {
            // Fallback: 24 hours from now
            return nowMs + 24 * 60 * 60 * 1000L;
        }

        return earliestTrigger;
    }

    /**
     * Arm the next occurrence of a reminder with AlarmManager.setAlarmClock().
     */
    public static boolean armNextOccurrence(Context context, ReminderItem reminder) {
        if (!reminder.enabled) {
            cancelAlarm(context, reminder.id);
            return true;
        }

        long nextTrigger = calculateNextTriggerMs(reminder.hour, reminder.minute, reminder.weekdays);
        reminder.nextTriggerMs = nextTrigger;

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            Log.e(TAG, "AlarmManager service not available");
            return false;
        }

        int requestCode = Math.abs(reminder.id.hashCode() % 1_000_000_000);

        Intent alarmIntent = new Intent(context, ReminderAlarmReceiver.class);
        alarmIntent.setAction("com.orbithabit.ALARM_TRIGGER");
        alarmIntent.putExtra("id", reminder.id);
        alarmIntent.putExtra("habit_id", reminder.habitId);
        alarmIntent.putExtra("title", reminder.title);
        alarmIntent.putExtra("body", reminder.body);
        alarmIntent.putExtra("sound", reminder.sound);
        alarmIntent.putExtra("vibrate", reminder.vibrate);
        alarmIntent.putExtra("trigger_ms", nextTrigger);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                alarmIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Target activity for when user taps the alarm icon in the status bar
        Intent showIntent = new Intent(context, MainActivity.class);
        showIntent.putExtra("habit_id", reminder.habitId);
        showIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent showPendingIntent = PendingIntent.getActivity(
                context,
                requestCode + 1000,
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        try {
            AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(nextTrigger, showPendingIntent);
            am.setAlarmClock(clockInfo, pendingIntent);
            Log.i(TAG, "Successfully armed AlarmClock for \"" + reminder.title + "\" (" + reminder.id + ") at " + new Date(nextTrigger));
            return true;
        } catch (SecurityException se) {
            Log.w(TAG, "setAlarmClock SecurityException, falling back to setExactAndAllowWhileIdle: " + se.getMessage());
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTrigger, pendingIntent);
                return true;
            } catch (Exception ex) {
                Log.e(TAG, "Failed to arm alarm fallback: " + ex.getMessage());
                return false;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error setting alarm clock: " + e.getMessage());
            return false;
        }
    }

    /**
     * Cancel an active reminder alarm.
     */
    public static void cancelAlarm(Context context, String reminderId) {
        if (reminderId == null) return;
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        int requestCode = Math.abs(reminderId.hashCode() % 1_000_000_000);
        Intent alarmIntent = new Intent(context, ReminderAlarmReceiver.class);
        alarmIntent.setAction("com.orbithabit.ALARM_TRIGGER");

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                alarmIntent,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );

        if (pendingIntent != null) {
            am.cancel(pendingIntent);
            pendingIntent.cancel();
            Log.i(TAG, "Cancelled alarm for id: " + reminderId);
        }
    }

    /**
     * Save reminder items to SharedPreferences.
     */
    public static void saveReminders(Context context, List<ReminderItem> list) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        JSONArray arr = new JSONArray();
        for (ReminderItem item : list) {
            arr.put(item.toJson());
        }
        prefs.edit().putString(KEY_REMINDERS, arr.toString()).apply();
    }

    /**
     * Load all saved reminder items from SharedPreferences.
     */
    public static List<ReminderItem> loadReminders(Context context) {
        List<ReminderItem> list = new ArrayList<>();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_REMINDERS, "[]");
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                list.add(ReminderItem.fromJson(arr.getJSONObject(i)));
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to parse saved reminders: " + e.getMessage());
        }
        return list;
    }

    /**
     * Re-arms all alarms saved in SharedPreferences.
     * Called on Boot, App Update, Time/Timezone change, and app start.
     */
    public static void reArmAllAlarms(Context context) {
        List<ReminderItem> list = loadReminders(context);
        Log.i(TAG, "Re-arming " + list.size() + " native alarms from SharedPreferences...");
        for (ReminderItem item : list) {
            if (item.enabled) {
                armNextOccurrence(context, item);
            }
        }
    }

    /**
     * Record last delivered alarm.
     */
    public static void recordLastDelivered(Context context, String title, long timeMs) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_LAST_DELIVERED_TITLE, title)
                .putLong(KEY_LAST_DELIVERED_TIME, timeMs)
                .apply();
    }

    /**
     * Add action to pending queue (e.g. Done clicked from notification).
     */
    public static void addPendingAction(Context context, String habitId, String action) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_PENDING_ACTIONS, "[]");
        try {
            JSONArray arr = new JSONArray(raw);
            JSONObject act = new JSONObject();
            act.put("habitId", habitId);
            act.put("action", action);
            act.put("timestamp", System.currentTimeMillis());
            arr.put(act);
            prefs.edit().putString(KEY_PENDING_ACTIONS, arr.toString()).apply();
            Log.i(TAG, "Added pending action: " + action + " for habit " + habitId);
        } catch (Exception e) {
            Log.e(TAG, "Failed to save pending action: " + e.getMessage());
        }
    }

    /**
     * Get pending actions array.
     */
    public static JSONArray getPendingActions(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_PENDING_ACTIONS, "[]");
        try {
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    /**
     * Clear pending actions.
     */
    public static void clearPendingActions(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_PENDING_ACTIONS, "[]").apply();
    }

    /**
     * Get or create appropriate notification channel ID.
     */
    public static String getChannelId(Context context, String sound, boolean vibrate) {
        String raw = sound == null ? "ringtone_1" : sound.trim();

        if ("silent".equalsIgnoreCase(raw)) {
            return "rem_silent";
        }

        String vibSuffix = vibrate ? "vib" : "novib";
        String soundClean;
        String channelId;

        if (raw.startsWith("uri:")) {
            soundClean = raw;
            channelId = "rem_u" + Integer.toHexString(raw.hashCode()) + "_" + vibSuffix;
        } else {
            soundClean = raw.replace(".mp3", "").replace(".wav", "");
            channelId = "rem_" + soundClean + "_" + vibSuffix;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(channelId) == null) {
                createSpecificChannel(context, nm, channelId, soundClean, vibrate);
            }
        }
        return channelId;
    }

    public static void createAllNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Silent channel
        NotificationChannel silentCh = new NotificationChannel(
                "rem_silent",
                "Orbit - Silent Alarms",
                NotificationManager.IMPORTANCE_LOW
        );
        silentCh.setDescription("Silent OrbitHabit alarms with visual alert only");
        silentCh.enableVibration(false);
        silentCh.setSound(null, null);
        nm.createNotificationChannel(silentCh);

        // Ringtone 1-5 + default channels
        String[] sounds = {"ringtone_1", "ringtone_2", "ringtone_3", "ringtone_4", "ringtone_5", "default"};
        boolean[] vibOptions = {true, false};

        for (String s : sounds) {
            for (boolean v : vibOptions) {
                String id = "rem_" + s + "_" + (v ? "vib" : "novib");
                createSpecificChannel(context, nm, id, s, v);
            }
        }
    }

    public static Uri resolveSoundUri(Context context, String sound) {
        if (sound == null || "silent".equalsIgnoreCase(sound.trim())) {
            return null;
        }
        String s = sound.trim();
        if (s.startsWith("uri:")) {
            try {
                Uri parsed = Uri.parse(s.substring(4));
                if (parsed != null && parsed.getScheme() != null) {
                    return parsed;
                }
            } catch (Exception ignored) {}
            return android.provider.Settings.System.DEFAULT_NOTIFICATION_URI;
        }
        if ("default".equalsIgnoreCase(s)) {
            return android.provider.Settings.System.DEFAULT_NOTIFICATION_URI;
        }
        String soundClean = s.replace(".mp3", "").replace(".wav", "");
        int resId = context.getResources().getIdentifier(soundClean, "raw", context.getPackageName());
        if (resId != 0) {
            return Uri.parse("android.resource://" + context.getPackageName() + "/" + resId);
        } else {
            return android.provider.Settings.System.DEFAULT_NOTIFICATION_URI;
        }
    }

    private static void createSpecificChannel(Context context, NotificationManager nm, String channelId, String soundClean, boolean vibrate) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        String soundTitle;
        if (soundClean != null && soundClean.startsWith("uri:")) {
            soundTitle = "Custom Sound";
        } else if ("default".equalsIgnoreCase(soundClean)) {
            soundTitle = "System Sound";
        } else {
            soundTitle = soundClean != null ? soundClean.replace("_", " ") : "Sound";
        }
        String name = "Orbit - " + soundTitle + " (" + (vibrate ? "Vibrate" : "No Vibrate") + ")";

        NotificationChannel channel = new NotificationChannel(
                channelId,
                name,
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Exact high-priority reminder alarms with sound and banners");
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

        if (vibrate) {
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 400, 200, 400});
        } else {
            channel.enableVibration(false);
        }

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();

        Uri soundUri = resolveSoundUri(context, soundClean);
        channel.setSound(soundUri, audioAttributes);

        nm.createNotificationChannel(channel);
    }
}
