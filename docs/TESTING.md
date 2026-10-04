# OrbitHabit — Testing & Android Verification Guide

This guide details how to run the automated **End-to-End (E2E) Test Suite** with **Maestro** on Android, inspect native OS alarms and notifications via **ADB**, and simulate real **GPS route playback** on the Android Emulator.

---

## 1. Quick Start: Automated E2E Suite

Run the full end-to-end regression suite across all 9 flows:

```bash
npm run test:e2e:android
```

This single command automatically:
1. Builds the production web bundle (`vite build`).
2. Synchronizes native assets to Android (`cap sync android`).
3. Assembles the debug APK via Gradle (`gradlew assembleDebug`).
4. Checks for an active Android emulator or physical device (or starts the configured AVD).
5. Installs the APK and grants all required permissions (`FINE_LOCATION`, `BACKGROUND_LOCATION`, `POST_NOTIFICATIONS`).
6. Executes all 9 Maestro test flows.
7. Saves screen captures to `e2e-reports/screenshots/` and generates HTML, Markdown, and JSON test reports.

### Selective & Fast Execution

```bash
# Run without rebuilding the APK (fast iteration)
node e2e/scripts/run-e2e.mjs --skip-build

# Run a single specific flow
node e2e/scripts/run-e2e.mjs 05_gps_run_playback.yaml --skip-build

# Run directly via Maestro CLI
maestro test e2e/flows/05_gps_run_playback.yaml
```

---

## 2. Test Flows Overview

| Flow File | Target Feature | Verification Criteria |
| :--- | :--- | :--- |
| `01_onboarding.yaml` | Onboarding Flow | Name, age, focus selection, notification & location permissions, dashboard handoff |
| `02_create_habits.yaml` | All 6 Habit Types | Creates Check, Count, Timer, Distance, Checklist, and Wake-up Alarm habits |
| `03_edit_habit.yaml` | Edit Habit | Updates title, description, target value, and repeat days; verifies data persistence |
| `04_toggle_reminder.yaml` | Reminders | Creates standalone reminders, tests ringtones, and toggles enable/disable switch |
| `05_gps_run_playback.yaml` | GPS Run Tracking | Starts run, emits GPS waypoints, verifies distance & speed tracking, pause/resume, and completion |
| `06_transactions_rupee.yaml` | Money Ledger (₹) | Records income & expense in Indian Rupees (₹), verifies balance calculation & deletion |
| `07_theme_switch.yaml` | Theme Switching | Verifies theme tokens across **Dark Space**, **AMOLED Black**, and **Cyber Light** |
| `08_backup_export_import.yaml` | Data Management | Generates and exports full offline JSON database backup |
| `09_delete_all_data.yaml` | Hard Reset | Modal prompt typing `DELETE`, complete database wipe, and reset to onboarding |

---

## 3. ADB Commands: Verifying Native Alarms & Notifications

### A. Inspect Pending Exact Alarms

OrbitHabit registers exact alarms using `@capacitor/local-notifications` with Android's `AlarmManager`. To view all pending alarms registered by the app:

```bash
# Windows PowerShell
adb shell dumpsys alarm | Select-String "com.orbithabit.app"

# macOS / Linux / Git Bash
adb shell dumpsys alarm | grep -E "com.orbithabit.app|ORBIT"
```

To view the full details of all pending intents, scheduled fire timestamps (`when`), and wakeup flags (`RTC_WAKEUP`):

```bash
# Dump the alarm service filtered to our package
adb shell dumpsys alarm com.orbithabit.app
```

Look for lines indicating exact wakeups:
- `RTC_WAKEUP`: Indicates the alarm will wake the device from deep sleep / Doze mode.
- `tag=*walarm*:com.orbithabit.app/...`: Indicates the scheduled local notification pending intent.

### B. Inspect Notification Channels & Importance

OrbitHabit creates custom high-importance notification channels with bundled sounds (`channel_ringtone_1` through `5`):

```bash
adb shell dumpsys notification --noredact | Select-String "channel_"
```

Verify that each channel has:
- `importance=4` or `5` (`IMPORTANCE_HIGH` / `IMPORTANCE_MAX` for banners and sound).
- `sound=android.resource://com.orbithabit.app/raw/ringtone_1`.
- `vibration=true`.

### C. Inspect Posted & Active Notifications

To view notifications currently displayed in the system tray or lock screen:

```bash
adb shell dumpsys notification --noredact | Select-String -Context 2,5 "com.orbithabit.app"
```

### D. Test Reboot Survival (`BootReceiver`)

To verify that alarms survive or are rescheduled after a device restart without manually rebooting the device:

```bash
# Trigger the BOOT_COMPLETED broadcast via ADB
adb shell am broadcast -a android.intent.action.BOOT_COMPLETED -p com.orbithabit.app

# Trigger package replacement broadcast (app update)
adb shell am broadcast -a android.intent.action.MY_PACKAGE_REPLACED -p com.orbithabit.app

# Check logcat to verify BootReceiver executed
adb logcat -d -s OrbitHabit.BootReceiver
```

---

## 4. How to Replay a GPS Route on the Emulator

OrbitHabit features a real-time GPS tracking engine with Haversine distance accumulation, 20m accuracy filtering, and stationary jitter suppression.

### Method 1: Using the Automated Route Playback Script

Run the bundled playback utility which feeds realistic waypoints along a 1 km route in San Francisco:

```bash
# Replay default 1 km trail with 1.5s intervals
npm run gps:playback

# Custom update interval in milliseconds (e.g. 500ms for fast walking/running)
node e2e/scripts/gps-playback.mjs 500
```

### Method 2: Manual Location Injection via ADB

You can inject individual GPS coordinates directly into the running emulator:

```bash
# Syntax: adb emu geo fix <longitude> <latitude> [altitude_meters]

# Waypoint 1 (Start)
adb emu geo fix -122.41940 37.77490 10

# Waypoint 2 (~120m North-East)
adb emu geo fix -122.41830 37.77580 12

# Waypoint 3 (~250m North-East)
adb emu geo fix -122.41710 37.77690 14

# Waypoint 4 (~400m North-East)
adb emu geo fix -122.41580 37.77820 16
```

### Method 3: Using Android Studio Emulator Extended Controls

1. In the Android Emulator sidebar, click the **... (Extended Controls)** button.
2. Navigate to the **Location** tab.
3. Click **Load GPX/KML** and select:
   `e2e/routes/gps_mock_route.gpx`
4. Set playback speed (e.g., `1x` for walking ~5 km/h, `2x` for running ~10 km/h).
5. Click **Play Route**.
6. Switch to OrbitHabit on the emulator:
   - Observe real-time speed in `km/h`.
   - Observe accumulated distance in `km`.
   - Observe the live path rendering on the canvas.

### Method 4: Telnet Connection to Emulator Console

Connect directly to the emulator console on port 5554:

```bash
# Get auth token from ~/.emulator_console_auth_token
telnet localhost 5554
auth <your_auth_token>
geo fix -122.41940 37.77490
geo fix -122.41830 37.77580
```

---

## 5. Artifacts & Test Reports

After running the test suite, check the generated artifacts:

- **HTML Report with Summary**: `e2e-reports/report.html`
- **Markdown CI Report**: `e2e-reports/report.md`
- **Machine-readable JSON**: `e2e-reports/results.json`
- **Visual Screen Captures**: `e2e-reports/screenshots/`
