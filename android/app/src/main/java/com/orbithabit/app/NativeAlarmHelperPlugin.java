package com.orbithabit.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

@CapacitorPlugin(name = "NativeAlarmHelper")
public class NativeAlarmHelperPlugin extends Plugin {

    public static String lastTappedHabitId = null;

    @PluginMethod
    public void getNotificationLaunchHabitId(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("habitId", lastTappedHabitId);
        lastTappedHabitId = null; // consume once
        call.resolve(ret);
    }

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("manufacturer", Build.MANUFACTURER != null ? Build.MANUFACTURER : "Unknown");
        ret.put("model", Build.MODEL != null ? Build.MODEL : "Unknown");
        ret.put("brand", Build.BRAND != null ? Build.BRAND : "Unknown");
        ret.put("sdkVersion", Build.VERSION.SDK_INT);

        Context context = getContext();
        boolean isIgnoringBattery = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && context != null) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                isIgnoringBattery = pm.isIgnoringBatteryOptimizations(context.getPackageName());
            }
        }
        ret.put("isIgnoringBatteryOptimizations", isIgnoringBattery);

        boolean canScheduleExactAlarms = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && context != null) {
            android.app.AlarmManager am = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                canScheduleExactAlarms = am.canScheduleExactAlarms();
            }
        }
        ret.put("canScheduleExactAlarms", canScheduleExactAlarms);

        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(context.getPackageName())) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + context.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    call.resolve();
                    return;
                } catch (Exception e) {
                    try {
                        Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                        fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(fallback);
                        call.resolve();
                        return;
                    } catch (Exception ex) {
                        call.reject(ex.getMessage());
                        return;
                    }
                }
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                call.resolve();
                return;
            } catch (Exception e) {
                // Fallback to app details
            }
        }

        try {
            Intent appSettings = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            appSettings.setData(Uri.parse("package:" + context.getPackageName()));
            appSettings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(appSettings);
            call.resolve();
        } catch (Exception ex) {
            call.reject(ex.getMessage());
        }
    }

    @PluginMethod
    public void openOemBatterySettings(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        String manufacturer = (Build.MANUFACTURER != null ? Build.MANUFACTURER : "").toLowerCase();
        String brand = (Build.BRAND != null ? Build.BRAND : "").toLowerCase();

        // 1. Vivo / iQOO (OriginOS / FuntouchOS)
        if (manufacturer.contains("vivo") || manufacturer.contains("iqoo") || brand.contains("vivo") || brand.contains("iqoo")) {
            Intent[] vivoIntents = new Intent[] {
                // High background power consumption whitelist
                new Intent().setComponent(new android.content.ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity")),
                // Background start manager
                new Intent().setComponent(new android.content.ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager")),
                // Vivo permission manager startup
                new Intent().setComponent(new android.content.ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")),
                // Vivo purview tab
                new Intent().setComponent(new android.content.ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.PurviewTabActivity")),
                // Vivo application behavior engine
                new Intent().setComponent(new android.content.ComponentName("com.vivo.abe", "com.vivo.applicationbehaviorengine.ui.ExcessivePowerManagerActivity")),
                // Fallback to standard battery ignore
                new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            };

            for (Intent it : vivoIntents) {
                try {
                    it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(it);
                    call.resolve();
                    return;
                } catch (Exception ignored) {}
            }
        }

        // 2. Xiaomi / Redmi / POCO
        if (manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco")) {
            try {
                Intent it = new Intent();
                it.setComponent(new android.content.ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
                it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(it);
                call.resolve();
                return;
            } catch (Exception ignored) {}
        }

        // 3. Oppo / Realme
        if (manufacturer.contains("oppo") || manufacturer.contains("realme")) {
            try {
                Intent it = new Intent();
                it.setComponent(new android.content.ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
                it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(it);
                call.resolve();
                return;
            } catch (Exception ignored) {}
        }

        // 4. Huawei / Honor
        if (manufacturer.contains("huawei") || manufacturer.contains("honor")) {
            try {
                Intent it = new Intent();
                it.setComponent(new android.content.ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
                it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(it);
                call.resolve();
                return;
            } catch (Exception ignored) {}
        }

        // 5. Standard Battery Optimization
        try {
            Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
            return;
        } catch (Exception ignored) {}

        // Fallback to application details settings
        try {
            Intent appSettings = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            appSettings.setData(Uri.parse("package:" + context.getPackageName()));
            appSettings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(appSettings);
            call.resolve();
        } catch (Exception ex) {
            call.reject(ex.getMessage());
        }
    }

    @PluginMethod
    public void scheduleReminders(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            android.app.AlarmManager am = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am != null && !am.canScheduleExactAlarms()) {
                call.reject("SCHEDULE_EXACT_ALARM_PERMISSION_REQUIRED");
                return;
            }
        }

        try {
            com.getcapacitor.JSArray remindersArr = call.getArray("reminders");
            if (remindersArr == null) {
                call.reject("reminders array is required");
                return;
            }

            java.util.List<AlarmScheduler.ReminderItem> currentSaved = AlarmScheduler.loadReminders(context);
            java.util.List<AlarmScheduler.ReminderItem> updatedList = new java.util.ArrayList<>(currentSaved);
            int scheduledCount = 0;

            for (int i = 0; i < remindersArr.length(); i++) {
                org.json.JSONObject obj = remindersArr.getJSONObject(i);
                AlarmScheduler.ReminderItem item = AlarmScheduler.ReminderItem.fromJson(obj);

                // Replace if existing with same id
                for (int j = updatedList.size() - 1; j >= 0; j--) {
                    if (updatedList.get(j).id.equals(item.id)) {
                        updatedList.remove(j);
                    }
                }

                if (item.enabled) {
                    boolean ok = AlarmScheduler.armNextOccurrence(context, item);
                    if (!ok) {
                        call.reject("Failed to arm exact alarm for reminder: " + item.title);
                        return;
                    }
                    scheduledCount++;
                } else {
                    AlarmScheduler.cancelAlarm(context, item.id);
                }
                updatedList.add(item);
            }

            AlarmScheduler.saveReminders(context, updatedList);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("count", scheduledCount);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error scheduling reminders: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelReminders(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        try {
            com.getcapacitor.JSArray idsArr = call.getArray("ids");
            if (idsArr == null) {
                call.reject("ids array is required");
                return;
            }

            java.util.List<AlarmScheduler.ReminderItem> saved = AlarmScheduler.loadReminders(context);
            java.util.List<AlarmScheduler.ReminderItem> remaining = new java.util.ArrayList<>();

            java.util.List<String> idsToCancel = new java.util.ArrayList<>();
            for (int i = 0; i < idsArr.length(); i++) {
                idsToCancel.add(idsArr.getString(i));
            }

            for (AlarmScheduler.ReminderItem item : saved) {
                if (idsToCancel.contains(item.id)) {
                    AlarmScheduler.cancelAlarm(context, item.id);
                } else {
                    remaining.add(item);
                }
            }

            AlarmScheduler.saveReminders(context, remaining);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error cancelling reminders: " + e.getMessage());
        }
    }

    @PluginMethod
    public void listReminders(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        try {
            java.util.List<AlarmScheduler.ReminderItem> list = AlarmScheduler.loadReminders(context);
            com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
            for (AlarmScheduler.ReminderItem item : list) {
                arr.put(item.toJson());
            }
            JSObject ret = new JSObject();
            ret.put("reminders", arr);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingActions(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        try {
            org.json.JSONArray actions = AlarmScheduler.getPendingActions(context);
            com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
            for (int i = 0; i < actions.length(); i++) {
                arr.put(actions.getJSONObject(i));
            }
            JSObject ret = new JSObject();
            ret.put("actions", arr);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void clearPendingActions(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        AlarmScheduler.clearPendingActions(context);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getLastDeliveredAlarm(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        android.content.SharedPreferences prefs = context.getSharedPreferences(AlarmScheduler.PREFS_NAME, Context.MODE_PRIVATE);
        String title = prefs.getString(AlarmScheduler.KEY_LAST_DELIVERED_TITLE, null);
        long timeMs = prefs.getLong(AlarmScheduler.KEY_LAST_DELIVERED_TIME, 0);

        JSObject ret = new JSObject();
        ret.put("title", title);
        ret.put("timeMs", timeMs);
        call.resolve(ret);
    }

    @PluginMethod
    public void isLocationEnabled(PluginCall call) {
        Context context = getContext();
        boolean isEnabled = false;
        if (context != null) {
            android.location.LocationManager lm = (android.location.LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
            if (lm != null) {
                isEnabled = lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER) ||
                            lm.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER);
            }
        }
        JSObject ret = new JSObject();
        ret.put("enabled", isEnabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkLocationPermissionsDetail(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();
        if (context == null) {
            ret.put("gpsSwitchEnabled", false);
            ret.put("fineLocationGranted", false);
            ret.put("coarseLocationGranted", false);
            ret.put("backgroundLocationGranted", false);
            ret.put("notificationGranted", false);
            ret.put("isIgnoringBattery", false);
            call.resolve(ret);
            return;
        }

        // 1. System GPS switch
        android.location.LocationManager lm = (android.location.LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        boolean gpsEnabled = false;
        if (lm != null) {
            gpsEnabled = lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER) ||
                         lm.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER);
        }
        ret.put("gpsSwitchEnabled", gpsEnabled);

        // 2. Fine & Coarse Location permissions
        boolean fine = androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        boolean coarse = androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        ret.put("fineLocationGranted", fine);
        ret.put("coarseLocationGranted", coarse);

        // 3. Background Location (Android 10+ / API 29+)
        boolean background = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            background = androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_BACKGROUND_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }
        ret.put("backgroundLocationGranted", background);

        // 4. Notifications (Android 13+ / API 33+)
        boolean notif = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notif = androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }
        ret.put("notificationGranted", notif);

        // 5. Battery Optimization
        boolean isIgnoringBattery = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                isIgnoringBattery = pm.isIgnoringBatteryOptimizations(context.getPackageName());
            }
        }
        ret.put("isIgnoringBattery", isIgnoringBattery);

        call.resolve(ret);
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        Context context = getContext();
        if (context != null) {
            try {
                Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        } else {
            call.reject("Context is null");
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Context context = getContext();
        if (context != null) {
            try {
                Intent appSettings = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                appSettings.setData(Uri.parse("package:" + context.getPackageName()));
                appSettings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(appSettings);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        } else {
            call.reject("Context is null");
        }
    }
}
