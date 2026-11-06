export type AudioChannel = "music" | "ambience" | "voice" | "effects";
export type AudioSettings = Record<AudioChannel | "master", number>;
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { master: 0.8, music: 0.65, ambience: 0.5, voice: 0.8, effects: 0.7 };
export const AUDIO_SETTINGS_KEY = "hogwarts-audio-settings-v1";

/** Session-owned audio; files are provided by the project owner, never fetched from third parties. */
export class AudioManager {
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  private music: HTMLAudioElement | null = null;
  private musicUrl: string | null = null;
  private clips = new Set<{ element: HTMLAudioElement; channel: AudioChannel }>();
  private context: AudioContext | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private musicFade = 1;
  private fadeFrame = 0;
  private fadingOut: { element: HTMLAudioElement; url: string | null } | null = null;

  setSettings(settings: AudioSettings) {
    this.settings = settings;
    this.applyVolume();
  }

  private volume(channel: AudioChannel) { return this.settings.master * this.settings[channel]; }
  private applyVolume() {
    if (this.music) this.music.volume = this.volume("music") * this.musicFade;
    for (const clip of this.clips) clip.element.volume = this.volume(clip.channel);
    if (this.ambienceGain && this.context) this.ambienceGain.gain.setTargetAtTime(this.volume("ambience") * 0.3, this.context.currentTime, 0.12);
  }

  async loadMusic(file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    const next = new Audio(url);
    next.loop = true;
    next.volume = this.volume("music");
    try { await next.play(); } catch (error) { URL.revokeObjectURL(url); throw error; }
    const previous = this.music;
    const previousUrl = this.musicUrl;
    cancelAnimationFrame(this.fadeFrame);
    this.releaseFadingOut();
    this.fadingOut = previous ? { element: previous, url: previousUrl } : null;
    this.music = next;
    this.musicUrl = url;
    this.musicFade = 0;
    this.applyVolume();
    const start = performance.now();
    const fade = (now: number) => {
      const progress = Math.min(1, (now - start) / 1000);
      this.musicFade = progress;
      this.applyVolume();
      if (previous) previous.volume = this.volume("music") * (1 - progress);
      if (progress < 1) this.fadeFrame = requestAnimationFrame(fade);
      else this.releaseFadingOut();
    };
    this.fadeFrame = requestAnimationFrame(fade);
  }

  private releaseFadingOut() {
    this.fadingOut?.element.pause();
    if (this.fadingOut?.url) URL.revokeObjectURL(this.fadingOut.url);
    this.fadingOut = null;
  }

  /** Plays a registered local voice/effect asset; returns false when the file is unavailable. */
  async playClip(url: string, channel: "voice" | "effects"): Promise<boolean> {
    const element = new Audio(url);
    const clip = { element, channel };
    element.volume = this.volume(channel);
    this.clips.add(clip);
    element.addEventListener("ended", () => this.clips.delete(clip), { once: true });
    element.addEventListener("error", () => this.clips.delete(clip), { once: true });
    try { await element.play(); return true; } catch { this.clips.delete(clip); return false; }
  }

  /** Synthesized placeholder ambience, created only after a user gesture. */
  async startTrainAmbience() {
    if (this.ambienceSource) return;
    const context = this.context ?? new AudioContext();
    this.context = context;
    await context.resume();
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const data = buffer.getChannelData(0);
    let filtered = 0;
    for (let i = 0; i < data.length; i++) {
      filtered = filtered * 0.97 + (Math.random() * 2 - 1) * 0.03;
      const pulse = 0.55 + 0.45 * Math.pow(Math.sin(i / context.sampleRate * Math.PI * 2.2), 8);
      data[i] = filtered * pulse;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = this.volume("ambience") * 0.3;
    source.connect(gain).connect(context.destination);
    source.start();
    this.ambienceSource = source;
    this.ambienceGain = gain;
  }
  stopTrainAmbience() {
    this.ambienceSource?.stop();
    this.ambienceSource?.disconnect();
    this.ambienceSource = null;
    this.ambienceGain?.disconnect();
    this.ambienceGain = null;
  }
  dispose() {
    cancelAnimationFrame(this.fadeFrame);
    this.releaseFadingOut();
    this.stopTrainAmbience();
    this.music?.pause();
    for (const clip of this.clips) clip.element.pause();
    this.clips.clear();
    if (this.musicUrl) URL.revokeObjectURL(this.musicUrl);
    void this.context?.close();
  }
}
