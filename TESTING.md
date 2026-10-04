# OrbitHabit — QA & Test Automation Guide

This guide details how to execute and verify all automated, integration, and performance test suites for **OrbitHabit**.

## Quick Execution

To run the complete automated test suite (strict TypeScript type checks + 8 Vitest suites):

```bash
npm run test:all
```

To run test suites in interactive watch mode:

```bash
npm run test:watch
```

---

## Test Suites Overview

| Suite | File | Coverage |
| :--- | :--- | :--- |
| **Zero-Network Audit** | `src/tests/offlineAudit.test.ts` | Static scan ensuring 0 runtime external URLs or API fetch calls |
| **Streaks & Rollover** | `src/tests/streakService.test.ts` | Consecutive day counting, rest day tolerance, missed day handling |
| **Focus Timer Engine** | `src/tests/timerEngine.test.ts` | Timestamp remaining calculation, pause/resume, app-kill reconciliation |
| **GPS Distance & Noise** | `src/tests/gpsTracker.test.ts` | Haversine formula, accuracy filtering, speed limits, 3km auto-complete |
| **Database & Ledgers** | `src/tests/database.test.ts` | Schema CRUD, cascading deletions, retroactive daily balance recalculations |
| **Backup & Restore** | `src/tests/backupService.test.ts` | JSON export, database wipe, 100% data restore, corrupt JSON rejection |
| **Stress & Scale** | `src/tests/stress.test.ts` | 500 habits bulk indexing & 1,000 transactions performance |
| **Smoke & Utilities** | `src/tests/smoke.test.ts` | ID generation, date string parsing, currency formatting |

---

## Manual Native Hardware Verification Checklist

1. **GPS Background Tracking with Screen Off**:
   - Start a GPS habit (e.g., *Walk 3 km*).
   - Lock the phone screen.
   - Walk / simulate movement; check notification bar distance updates; verify completion sound plays at 3.00 km.
2. **Timer App-Kill Recovery**:
   - Start a 20-minute timer.
   - Swipe away / force close OrbitHabit from recent apps.
   - Wait 20 minutes; verify exact local notification alarm rings; reopen app and confirm habit marked completed.
3. **Exact Alarms Across Device Reboot**:
   - Set a daily reminder at a specific time.
   - Restart the Android device.
   - Confirm alarm fires on scheduled time after reboot.
