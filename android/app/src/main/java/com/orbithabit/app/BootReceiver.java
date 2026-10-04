package com.orbithabit.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Receives BOOT_COMPLETED and MY_PACKAGE_REPLACED broadcasts to restart
 * the app's alarm reminders after a device reboot or app update.
 *
 * On boot, Capacitor LocalNotifications' scheduled alarms are wiped by Android.
 * This receiver launches the app in the background so it can reschedule them.
 *
 * Note: On Android 10+ the app cannot start a full Activity from the background,
 * so we start the app via a low-priority headless launch. The JS bridge's
 * rescheduleAllReminders() will run as part of normal app initialization.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "OrbitHabit.BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        final String action = intent.getAction();
        if (action == null) return;

        Log.i(TAG, "Received broadcast: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)) {

            Log.i(TAG, "Scheduling alarm reschedule via app launch on: " + action);

            // Launch the app silently in the background so Capacitor can
            // reschedule alarms via rescheduleAllReminders() on init.
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_FROM_BACKGROUND);
            launchIntent.putExtra("boot_reschedule", true);

            try {
                context.startActivity(launchIntent);
            } catch (Exception e) {
                Log.w(TAG, "Could not launch app from boot receiver: " + e.getMessage());
            }
        }
    }
}
