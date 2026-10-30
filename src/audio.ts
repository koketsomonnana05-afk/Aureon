// Simple Audio Synthesizer for UI feedback
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  
  private init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.1; // Soft volume
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn("AudioContext not supported", e);
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol = 1) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playTaskComplete() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Bubble pop / glockenspiel sound
    this.playTone(600, 'sine', 0.1, 0.5);
    setTimeout(() => this.playTone(800, 'sine', 0.2, 0.3), 50);
  }

  playTimerStart() {
    // Gentle sine beep
    this.playTone(440, 'sine', 0.2, 0.5);
  }
  
  playLevelUp() {
    this.init();
    if (!this.ctx) return;
    
    // Triumphant arpeggio
    this.playTone(440, 'sine', 0.15, 0.5);
    setTimeout(() => this.playTone(554.37, 'sine', 0.15, 0.5), 100); // C#
    setTimeout(() => this.playTone(659.25, 'sine', 0.15, 0.5), 200); // E
    setTimeout(() => this.playTone(880, 'sine', 0.3, 0.6), 300); // A higher
  }

  playBreathingBell(type: "in" | "out" | "hold" = "in") {
    this.init();
    if (!this.ctx) return;
    const freq = type === "in" ? 528 : type === "hold" ? 432 : 396; // Solfeggio healing frequencies
    this.playTone(freq, "sine", 1.2, 0.25);
  }

  startAmbient(type: "brown" | "rain" | "gamma" | "none") {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.stopAmbient();
    if (type === "none") return;

    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === "brown") {
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Compensate gain
      }
    } else if (type === "rain") {
      // Pinkish noise with volume modulation
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11; 
        b6 = white * 0.115926;
        output[i] *= (1 + 0.3 * Math.sin(i / this.ctx.sampleRate * 10));
      }
    } else if (type === "gamma") {
      // 40Hz Gamma Amplitude-Modulated Flow Tone (Harmonic carrier at 144Hz modulated at 40Hz)
      const carrierFreq = 144;
      const modFreq = 40;
      for (let i = 0; i < bufferSize; i++) {
        const t = i / this.ctx.sampleRate;
        const carrier = Math.sin(2 * Math.PI * carrierFreq * t);
        const modulator = (1 + Math.sin(2 * Math.PI * modFreq * t)) * 0.5;
        // Add subtle warm pinkish undertone
        const sub = Math.sin(2 * Math.PI * 72 * t) * 0.3;
        output[i] = (carrier * modulator + sub) * 0.35;
      }
    }

    this.ambientSource = this.ctx.createBufferSource();
    this.ambientSource.buffer = buffer;
    this.ambientSource.loop = true;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = type === "brown" ? 0.3 : type === "gamma" ? 0.25 : 0.5;

    this.ambientSource.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);

    this.ambientSource.start();
  }

  stopAmbient() {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch (e) {
        // ignore
      }
      this.ambientSource.disconnect();
      this.ambientSource = null;
    }
    if (this.ambientGain) {
      this.ambientGain.disconnect();
      this.ambientGain = null;
    }
  }
}

export const audio = new AudioEngine();
