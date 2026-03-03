export class AudioManager {
  // --- RECORDING STATE ---
  private recordingContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  // --- PLAYBACK STATE ---
  // We keep a secondary context strictly for playback so it survives 
  // pausing/stopping the microphone.
  private playbackContext: AudioContext | null = null;
  private nextPlayTime: number = 0;

  async startRecording(onAudioCallback: (base64String: string) => void) {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        }
      });
      
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.recordingContext = new AudioCtx({ sampleRate: 16000 }) as AudioContext;
      this.source = this.recordingContext.createMediaStreamSource(this.mediaStream);
      
      this.processor = this.recordingContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to Base64
        const buffer = new ArrayBuffer(pcm16.buffer.byteLength);
        new Uint8Array(buffer).set(new Uint8Array(pcm16.buffer));
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64String = window.btoa(binary);
        onAudioCallback(base64String);
      };

      if (this.source && this.processor && this.recordingContext) {
        this.source.connect(this.processor);
        this.processor.connect(this.recordingContext.destination);
      }
      
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  }

  stopRecording() {
    try {
      if (this.source) this.source.disconnect();
      if (this.processor) this.processor.disconnect();
    } catch (e) {
      console.warn("Audio disconnect error:", e);
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.recordingContext && this.recordingContext.state !== 'closed') {
       this.recordingContext.close().catch(console.error);
    }
    
    this.source = null;
    this.processor = null;
    this.mediaStream = null;
    this.recordingContext = null;
  }

  clearPlaybackQueue() {
      // Useful for "Barge-in". If the user interrupts, we reset the playback context
      // to abruptly halt the current AudioBufferSourceNodes.
      if (this.playbackContext && this.playbackContext.state !== 'closed') {
          this.playbackContext.close().catch(console.error);
      }
      this.playbackContext = null;
      this.nextPlayTime = 0;
  }

  initializePlaybackContext() {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.playbackContext || this.playbackContext.state === 'closed') {
        this.playbackContext = new AudioCtx({ sampleRate: 16000 }) as AudioContext;
        this.nextPlayTime = 0; // Reset
    }
    
    // Resume immediately if suspended to satisfy browser policies during user click
    if (this.playbackContext.state === 'suspended') {
      this.playbackContext.resume();
    }
  }

  async playChunk(base64Data: string) {
    if (!this.playbackContext || this.playbackContext.state === 'closed') {
        this.initializePlaybackContext();
    }
    
    const ctx = this.playbackContext;
    if (!ctx) return;
    
    // Browsers often suspend AudioContexts until user interaction. Ensure it's active.
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const binary = window.atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32Array.length, 16000);
    audioBuffer.getChannelData(0).set(float32Array);
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    
    // Add a GainNode to boost the natively quiet Gemini audio output
    const gainNode = ctx.createGain();
    gainNode.gain.value = 3.0; // 300% volume boost
    
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Ensure chunks don't overlap if they arrive faster than they play back
    if (this.nextPlayTime < ctx.currentTime) {
      this.nextPlayTime = ctx.currentTime;
    }
    source.start(this.nextPlayTime);
    
    // Advance the play head by the exact length of this buffer
    this.nextPlayTime += audioBuffer.duration;
  }
}
