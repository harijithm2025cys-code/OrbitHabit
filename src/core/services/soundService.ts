import { Capacitor } from '@capacitor/core';
import { NativeAlarmHelper } from './notificationService';

export class SoundService {
  private static currentAudio: HTMLAudioElement | null = null;
  private static playingSoundId: string | null = null;
  private static nativeTimer: ReturnType<typeof setTimeout> | null = null;

  public static playSound(soundFile: string = 'ringtone_1', onEnded?: () => void): void {
    try {
      const normalize = (s: string) => (s.startsWith('uri:') ? s : s.replace(/\.(mp3|wav)$/, ''));

      if (this.playingSoundId && normalize(this.playingSoundId) === normalize(soundFile)) {
        this.stopCurrentSound();
        return;
      }

      this.stopCurrentSound();

      if (soundFile === 'silent') return;

      if (soundFile === 'default' || soundFile.startsWith('uri:')) {
        if (Capacitor.isNativePlatform()) {
          this.playingSoundId = soundFile;
          NativeAlarmHelper.previewSound({
            uri: soundFile === 'default' ? 'default' : soundFile.slice(4)
          }).catch((err) => {
            console.warn('Native sound preview failed:', err);
            this.playingSoundId = null;
          });

          this.nativeTimer = setTimeout(() => {
            this.stopCurrentSound();
            if (onEnded) onEnded();
          }, 5000);
        }
        return;
      }

      const base = soundFile.replace(/\.(mp3|wav)$/, '');
      const audioPath = `/sounds/${base}.mp3`;
      const audio = new Audio(audioPath);
      this.currentAudio = audio;
      this.playingSoundId = soundFile;

      audio.onended = () => {
        this.playingSoundId = null;
        this.currentAudio = null;
        if (onEnded) onEnded();
      };

      audio.play().catch((err) => {
        console.warn('Audio playback failed or was blocked by autoplay policy:', err);
        this.playingSoundId = null;
      });
    } catch (err) {
      console.warn('Sound service error:', err);
      this.playingSoundId = null;
    }
  }

  public static stopCurrentSound(): void {
    if (this.nativeTimer) {
      clearTimeout(this.nativeTimer);
      this.nativeTimer = null;
    }
    if (Capacitor.isNativePlatform()) {
      NativeAlarmHelper.stopPreview().catch(() => {});
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.playingSoundId = null;
  }

  public static stopSound(): void {
    this.stopCurrentSound();
  }

  public static isPlaying(soundId?: string): boolean {
    if (!soundId) return this.playingSoundId !== null;
    const normalize = (s: string) => (s.startsWith('uri:') ? s : s.replace(/\.(mp3|wav)$/, ''));
    return this.playingSoundId !== null && normalize(this.playingSoundId) === normalize(soundId);
  }

  public static getAvailableSounds(): { id: string; name: string }[] {
    return [
      { id: 'ringtone_1', name: 'Celestial Chime' },
      { id: 'ringtone_2', name: 'Upbeat Pulse' },
      { id: 'ringtone_3', name: 'Bright Resonance' },
      { id: 'ringtone_4', name: 'Deep Nebula' },
      { id: 'ringtone_5', name: 'Cosmic Bell' },
      { id: 'default', name: 'System Default' },
      { id: 'silent', name: 'Silent' }
    ];
  }
}
