export class VideoCapture {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  private intervalId: number | null = null;

  async startCamera(videoRef: HTMLVideoElement, onFrame: (base64Jpeg: string) => void, fps: number = 1) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      
      this.videoElement = videoRef;
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      this.canvasElement = document.createElement('canvas');
      this.canvasElement.width = 640;
      this.canvasElement.height = 480;

      const context = this.canvasElement.getContext('2d');
      if (!context) return;

      const captureFrame = () => {
        if (!this.videoElement || !this.videoElement.videoWidth || !this.canvasElement) return;
        
        context.drawImage(this.videoElement, 0, 0, 640, 480);
        // Quality 0.5 to keep payload sizes manageable
        const dataUrl = this.canvasElement.toDataURL('image/jpeg', 0.5);
        // Remove the data URI prefix for the payload
        const base64Str = dataUrl.split(',')[1];
        onFrame(base64Str);
      };

      this.intervalId = window.setInterval(captureFrame, 1000 / fps);

    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  }

  stopCamera() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
       this.videoElement.srcObject = null;
       this.videoElement = null;
    }
    if (this.canvasElement) {
       this.canvasElement = null;
    }
  }

  changeFramerate(fps: number, onFrame: (base64Jpeg: string) => void) {
      if (this.intervalId) window.clearInterval(this.intervalId);
      
      const captureFrame = () => {
        if (!this.videoElement || !this.videoElement.videoWidth || !this.canvasElement) return;
        const context = this.canvasElement.getContext('2d');
        if (!context) return;
        
        context.drawImage(this.videoElement, 0, 0, 640, 480);
        const dataUrl = this.canvasElement.toDataURL('image/jpeg', 0.5);
        const base64Str = dataUrl.split(',')[1];
        onFrame(base64Str);
      };

      this.intervalId = window.setInterval(captureFrame, 1000 / fps);
  }
}
