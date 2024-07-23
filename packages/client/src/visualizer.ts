export class VoiceVisualizer {
  private elm: HTMLAudioElement;
  private smoothDataArray = new Array(4).fill(0);
  private circleRadius: number = 0;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private visualizing: boolean = false;
  private color: string;
  private canvas: HTMLCanvasElement;
  private added: boolean = false;

  constructor(
    elm: HTMLAudioElement | string,
    canvas: HTMLCanvasElement | string,
    color: string = "#000000",
  ) {
    const element = (
      typeof elm === "string" ? document.getElementById(elm) : elm
    ) as HTMLAudioElement;

    this.canvas = (
      typeof canvas === "string" ? document.getElementById(canvas) : canvas
    ) as HTMLCanvasElement;

    if (!this.canvas) throw new Error("Canvas element not found!");
    if (!element) {
      throw new Error("Audio element is not found");
    }

    this.color = color;
    this.elm = element;
  }

  getReady() {
    if (this.added) return;

    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const audioSource = audioContext.createMediaElementSource(this.elm);
    this.analyser = audioContext.createAnalyser();

    audioSource.connect(this.analyser);
    this.analyser.connect(audioContext.destination);
    this.analyser.fftSize = 2048;

    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);

    this.added = true;
    this.startVisualization();
  }

  private startVisualization() {
    if (!this.visualizing && this.canvas && this.analyser && this.dataArray) {
      this.visualizing = true;
      this.visualize();
    }
  }

  private visualize() {
    if (!this.canvas || !this.analyser) {
      return;
    }

    this.analyser.getByteTimeDomainData(this.dataArray || new Uint8Array());
    this.visualizeCanvas(this.dataArray || new Uint8Array(), this.color);

    requestAnimationFrame(() => this.visualize());
  }

  private visualizeCanvas(dataArray: Uint8Array, color: string) {
    const canvas = this.canvas;
    const canvasCtx = canvas.getContext("2d");

    if (!canvasCtx) {
      throw new Error("Can't get canvas context");
    }

    const width = canvas.width;
    const height = canvas.height;
    const barCount = 4;
    const centerX = width / 2;
    const centerY = height / 2;
    const barWidth = width / (barCount * 2);
    const barSpacing = barWidth / 2;
    const maxRadius = barWidth / 2;

    const targetRadius = this.elm.paused ? height / 3 : 0;
    this.circleRadius += (targetRadius - this.circleRadius) * 0.1;

    canvasCtx.clearRect(0, 0, width, height);

    if (this.circleRadius > 1) {
      canvasCtx.fillStyle = color;
      canvasCtx.beginPath();
      canvasCtx.arc(centerX, centerY, this.circleRadius, 0, 2 * Math.PI);
      canvasCtx.fill();
    } else {
      const totalWaveWidth = barCount * barWidth + (barCount - 1) * barSpacing;
      const startX = (width - totalWaveWidth) / 2;

      for (let i = 0; i < barCount; i++) {
        const barHeight = (dataArray[i] / 128.0) * centerY;
        this.smoothDataArray[i] += (barHeight - this.smoothDataArray[i]) * 0.5;
      }

      this.smoothDataArray.forEach((barHeight, i) => {
        const barX = startX + i * (barWidth + barSpacing);
        const barY = centerY - barHeight / 2;
        canvasCtx.fillStyle = color;
        canvasCtx.beginPath();
        canvasCtx.moveTo(barX + maxRadius, barY);
        canvasCtx.lineTo(barX + barWidth - maxRadius, barY);
        canvasCtx.quadraticCurveTo(
          barX + barWidth,
          barY,
          barX + barWidth,
          barY + maxRadius,
        );
        canvasCtx.lineTo(barX + barWidth, barY + barHeight - maxRadius);
        canvasCtx.quadraticCurveTo(
          barX + barWidth,
          barY + barHeight,
          barX + barWidth - maxRadius,
          barY + barHeight,
        );
        canvasCtx.lineTo(barX + maxRadius, barY + barHeight);
        canvasCtx.quadraticCurveTo(
          barX,
          barY + barHeight,
          barX,
          barY + barHeight - maxRadius,
        );
        canvasCtx.lineTo(barX, barY + maxRadius);
        canvasCtx.quadraticCurveTo(barX, barY, barX + maxRadius, barY);
        canvasCtx.closePath();
        canvasCtx.fill();
      });
    }
  }
}
