export class AudioManager {
  private context: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
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
      this.context = new AudioCtx({ sampleRate: 16000 }) as AudioContext;
      this.source = this.context.createMediaStreamSource(this.mediaStream);
      
      this.processor = this.context.createScriptProcessor(4096, 1, 1);
      
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

      if (this.source && this.processor && this.context) {
        this.source.connect(this.processor);
        this.processor.connect(this.context.destination);
      }
      
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  }

  stopRecording() {
    if (this.processor && this.source) {
      this.source.disconnect(this.processor);
      this.processor.disconnect();
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.context) {
       this.context.close();
       this.context = null;
    }
  }

  playChunk(base64Data: string) {
    if (!this.context) return;
    
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

    const audioBuffer = this.context.createBuffer(1, float32Array.length, 16000);
    audioBuffer.getChannelData(0).set(float32Array);
    
    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.context.destination);
    
    if (this.nextPlayTime < this.context.currentTime) {
      this.nextPlayTime = this.context.currentTime;
    }
    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;
  }
}
