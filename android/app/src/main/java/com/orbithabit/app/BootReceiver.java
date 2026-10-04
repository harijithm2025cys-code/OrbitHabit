package com.orbithabit.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Native Boot & Time-Change Receiver.
 *
 * Does NOT start an Activity (which is blocked from background on modern Android).
 * Instead, directly re-arms all exact alarms from SharedPreferences on:
 * - BOOT_COMPLETED
 * - QUICKBOOT_POWERON (Xiaomi / HyperOS fastboot)
 * - MY_PACKAGE_REPLACED (App update)
 * - TIME_SET (User changes system clock)
 * - TIMEZONE_CHANGED (Timezone change / DST transitions)
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "OrbitHabit.BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        final String action = intent.getAction();
        if (action == null) return;

        Log.i(TAG, "Received system broadcast: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)) {

            Log.i(TAG, "Re-arming all native alarms from SharedPreferences on: " + action);
            try {
                // Ensure channels exist
                AlarmScheduler.createAllNotificationChannels(context);
                // Re-arm all saved alarms
                AlarmScheduler.reArmAllAlarms(context);
                Log.i(TAG, "✓ Native alarms successfully re-armed.");
            } catch (Exception e) {
                Log.e(TAG, "Failed to re-arm alarms on " + action + ": " + e.getMessage(), e);
            }
        }
    }
}
