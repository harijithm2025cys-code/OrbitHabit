#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default coordinates along a 1 km running trail in San Francisco
const DEFAULT_WAYPOINTS = [
  { lat: 37.77490, lon: -122.41940, alt: 10 },
  { lat: 37.77535, lon: -122.41885, alt: 11 },
  { lat: 37.77580, lon: -122.41830, alt: 12 },
  { lat: 37.77635, lon: -122.41770, alt: 13 },
  { lat: 37.77690, lon: -122.41710, alt: 14 },
  { lat: 37.77755, lon: -122.41645, alt: 15 },
  { lat: 37.77820, lon: -122.41580, alt: 16 },
  { lat: 37.77885, lon: -122.41515, alt: 17 },
  { lat: 37.77950, lon: -122.41450, alt: 18 },
  { lat: 37.78015, lon: -122.41385, alt: 19 },
  { lat: 37.78080, lon: -122.41320, alt: 20 },
  { lat: 37.78145, lon: -122.41255, alt: 21 },
  { lat: 37.78210, lon: -122.41190, alt: 22 }
];

const intervalMs = parseInt(process.argv[2], 10) || 1500;

function sendAdbGeoFix(lon, lat, alt = 10) {
  try {
    // adb emu geo fix <longitude> <latitude> <altitude>
    execSync(`adb emu geo fix ${lon.toFixed(6)} ${lat.toFixed(6)} ${alt}`, { stdio: 'ignore' });
    console.log(`[GPS Playback] Sent location: lat=${lat.toFixed(6)}, lon=${lon.toFixed(6)}, alt=${alt}m`);
  } catch (err) {
    console.warn(`[GPS Playback] Failed to send geo fix via adb: ${err.message}`);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPlayback() {
  console.log(`=======================================================`);
  console.log(`OrbitHabit — Android Emulator GPS Route Playback`);
  console.log(`Waypoints: ${DEFAULT_WAYPOINTS.length} | Interval: ${intervalMs}ms`);
  console.log(`=======================================================\n`);

  for (let i = 0; i < DEFAULT_WAYPOINTS.length; i++) {
    const pt = DEFAULT_WAYPOINTS[i];
    console.log(`Waypoint ${i + 1}/${DEFAULT_WAYPOINTS.length}`);
    sendAdbGeoFix(pt.lon, pt.lat, pt.alt);
    if (i < DEFAULT_WAYPOINTS.length - 1) {
      await sleep(intervalMs);
    }
  }

  console.log(`\n✓ Route playback completed successfully.`);
}

runPlayback().catch(console.error);
