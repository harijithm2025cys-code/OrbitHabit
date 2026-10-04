export class SoundService {
  private static currentAudio: HTMLAudioElement | null = null;
  private static playingSoundId: string | null = null;

  public static playSound(soundFile: string = 'ringtone_1.mp3', onEnded?: () => void): void {
    try {
      if (this.playingSoundId === soundFile && this.currentAudio) {
        this.stopCurrentSound();
        return;
      }

      this.stopCurrentSound();

      if (soundFile === 'silent') return;

      const audioPath = `/sounds/${soundFile.replace(/\.wav$/, '.mp3')}`;
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
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      this.playingSoundId = null;
    }
  }

  public static stopSound(): void {
    this.stopCurrentSound();
  }

  public static isPlaying(soundId?: string): boolean {
    if (!soundId) return this.playingSoundId !== null;
    return this.playingSoundId === soundId;
  }

  public static getAvailableSounds(): { id: string; name: string }[] {
    return [
      { id: 'ringtone_1.mp3', name: 'Celestial Chime' },
      { id: 'ringtone_2.mp3', name: 'Upbeat Pulse' },
      { id: 'ringtone_3.mp3', name: 'Bright Resonance' },
      { id: 'ringtone_4.mp3', name: 'Deep Nebula' },
      { id: 'ringtone_5.mp3', name: 'Cosmic Bell' },
      { id: 'silent', name: 'Silent' }
    ];
  }
}
