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
        Intent intent = new Intent();
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            if (manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco")) {
                intent.setComponent(new android.content.ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
            } else if (manufacturer.contains("oppo") || manufacturer.contains("realme")) {
                intent.setComponent(new android.content.ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
            } else if (manufacturer.contains("vivo")) {
                intent.setComponent(new android.content.ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"));
            } else if (manufacturer.contains("huawei") || manufacturer.contains("honor")) {
                intent.setComponent(new android.content.ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
            } else if (manufacturer.contains("samsung")) {
                intent.setAction(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            } else {
                intent.setAction(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            }
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
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
