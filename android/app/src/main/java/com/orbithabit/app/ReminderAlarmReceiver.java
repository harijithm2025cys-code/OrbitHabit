package com.orbithabit.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import java.util.List;

/**
 * BroadcastReceiver triggered by AlarmManager when an exact reminder alarm fires.
 *
 * Posts high-priority native notification with:
 * - MessagingStyle avatar on the LEFT (fixes OriginOS/Vivo default blue X icon)
 * - Round full-colour OrbitHabit logo decoded from ic_notification_large
 * - Action buttons ("✓ Done", "⏱ Snooze 10m")
 * - Full-screen intent for lockscreen alert
 * - Configurable chat-style vs standard style toggle
 * - Dynamic conversation shortcut for Android 11+
 * - Automatic re-arming for the next scheduled occurrence
 */
public class ReminderAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "OrbitHabit.AlarmReceiver";

    public static final String ACTION_DONE = "com.orbithabit.ACTION_DONE";
    public static final String ACTION_SNOOZE = "com.orbithabit.ACTION_SNOOZE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String id = intent.getStringExtra("id");
        String habitId = intent.getStringExtra("habit_id");
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String sound = intent.getStringExtra("sound");
        boolean vibrate = intent.getBooleanExtra("vibrate", true);

        if (title == null || title.isEmpty()) {
            title = "Orbit Habit Reminder";
        }
        if (body == null || body.isEmpty()) {
            body = "Time to complete your habit mission!";
        }

        Log.i(TAG, "⏰ Alarm fired for \"" + title + "\" (id=" + id + ", habitId=" + habitId + ")");

        // Record last delivered alarm
        AlarmScheduler.recordLastDelivered(context, title, System.currentTimeMillis());

        // Post the notification
        postNotification(context, id, habitId, title, body, sound, vibrate);

        // Immediately arm the next occurrence for this reminder!
        if (id != null && !id.isEmpty()) {
            reArmNextOccurrence(context, id);
        }
    }

    private void postNotification(Context context, String id, String habitId, String title, String body, String sound, boolean vibrate) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        String channelId = AlarmScheduler.getChannelId(context, sound, vibrate);
        int notifId = id != null ? Math.abs(id.hashCode() % 1_000_000_000) : 1001;

        // Clean title and body so we never repeat the app name or title
        String habitTitle = title;
        if (habitTitle == null || habitTitle.trim().isEmpty() || "Orbit Habit Reminder".equalsIgnoreCase(habitTitle.trim())) {
            habitTitle = "Daily Habit";
        } else if (habitTitle.startsWith("OrbitHabit: ")) {
            habitTitle = habitTitle.substring("OrbitHabit: ".length()).trim();
        } else if (habitTitle.startsWith("OrbitHabit - ")) {
            habitTitle = habitTitle.substring("OrbitHabit - ".length()).trim();
        }

        String messageText;
        if (body != null && !body.isEmpty() && !body.equals("Time to complete your habit mission!") && !body.equalsIgnoreCase(habitTitle)) {
            messageText = body;
        } else {
            messageText = "Time for " + habitTitle + "!";
        }

        // Content Intent: Open Habit in MainActivity
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setAction(Intent.ACTION_VIEW);
        openIntent.putExtra("habit_id", habitId);
        openIntent.putExtra("from_notification", true);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                context,
                notifId,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Action 1: "✓ Done" button
        Intent doneIntent = new Intent(context, NotificationActionReceiver.class);
        doneIntent.setAction(ACTION_DONE);
        doneIntent.putExtra("habit_id", habitId);
        doneIntent.putExtra("notif_id", notifId);
        PendingIntent donePendingIntent = PendingIntent.getBroadcast(
                context,
                notifId + 1,
                doneIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Action 2: "⏱ Snooze 10m" button
        Intent snoozeIntent = new Intent(context, NotificationActionReceiver.class);
        snoozeIntent.setAction(ACTION_SNOOZE);
        snoozeIntent.putExtra("id", id);
        snoozeIntent.putExtra("habit_id", habitId);
        snoozeIntent.putExtra("title", habitTitle);
        snoozeIntent.putExtra("sound", sound);
        snoozeIntent.putExtra("vibrate", vibrate);
        snoozeIntent.putExtra("notif_id", notifId);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(
                context,
                notifId + 2,
                snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Decode round full-colour logo bitmap from res/drawable-nodpi/ic_notification_large
        Bitmap logoBitmap = null;
        try {
            logoBitmap = BitmapFactory.decodeResource(context.getResources(), R.drawable.ic_notification_large);
        } catch (Exception e) {
            Log.e(TAG, "Failed to decode ic_notification_large bitmap: " + e.getMessage());
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.ic_stat_orbit)
                .setColor(0xFF00F0FF)
                .setContentTitle(habitTitle)
                .setContentText(messageText)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(contentPendingIntent)
                .setFullScreenIntent(contentPendingIntent, true)
                .addAction(0, "✓ Done", donePendingIntent)
                .addAction(0, "⏱ Snooze 10m", snoozePendingIntent);

        if (logoBitmap != null) {
            builder.setLargeIcon(logoBitmap);
        }

        // Check if chat-style notification is enabled (default ON)
        boolean isChatStyle = AlarmScheduler.isChatStyleEnabled(context);

        if (isChatStyle && logoBitmap != null) {
            // Build Person for MessagingStyle avatar
            Person appPerson = new Person.Builder()
                    .setName("OrbitHabit")
                    .setIcon(IconCompat.createWithBitmap(logoBitmap))
                    .setKey("orbithabit")
                    .build();

            NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(appPerson)
                    .setConversationTitle(habitTitle);
            style.addMessage(messageText, System.currentTimeMillis(), appPerson);

            builder.setStyle(style);

            // For Android 11+ (API 30+), publish dynamic shortcut so OriginOS/system UI treats it as a conversation
            // and renders the round avatar on the LEFT tile
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                String effectiveHabitId = (habitId != null && !habitId.isEmpty()) ? habitId : (id != null ? id : "orbit");
                String shortcutId = "habit_" + effectiveHabitId;
                try {
                    ShortcutInfoCompat shortcut = new ShortcutInfoCompat.Builder(context, shortcutId)
                            .setShortLabel(habitTitle)
                            .setLongLabel("OrbitHabit: " + habitTitle)
                            .setIcon(IconCompat.createWithBitmap(logoBitmap))
                            .setIntent(openIntent)
                            .setLongLived(true)
                            .setPerson(appPerson)
                            .build();
                    ShortcutManagerCompat.pushDynamicShortcut(context, shortcut);
                    builder.setShortcutId(shortcutId);
                } catch (Exception se) {
                    Log.w(TAG, "Error pushing dynamic shortcut for habit conversation: " + se.getMessage());
                }
            }
        } else {
            // Standard notification style (BigTextStyle)
            builder.setStyle(new NotificationCompat.BigTextStyle().bigText(messageText));
        }

        if (vibrate) {
            builder.setVibrate(new long[]{0, 400, 200, 400});
        }

        nm.notify(notifId, builder.build());
        Log.i(TAG, "Notification posted for \"" + habitTitle + "\" [chatStyle=" + isChatStyle + "] on channel " + channelId);
    }

    private void reArmNextOccurrence(Context context, String reminderId) {
        List<AlarmScheduler.ReminderItem> reminders = AlarmScheduler.loadReminders(context);
        for (AlarmScheduler.ReminderItem item : reminders) {
            if (reminderId.equals(item.id)) {
                if (item.enabled) {
                    AlarmScheduler.armNextOccurrence(context, item);
                    AlarmScheduler.saveReminders(context, reminders);
                }
                break;
            }
        }
    }
}
