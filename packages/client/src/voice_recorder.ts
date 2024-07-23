import { RunInputs } from "@scoopika/types";
import sleep from "./lib/sleep";

type OnTextCallback = (text: string) => void;
type State = "recording" | "stopped" | "paused";

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    isFinal: boolean;
    [key: number]: { transcript: string };
  }[];
}

export class VoiceRecorder {
  mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  audioBlob: Blob | null = null;
  started: boolean = false;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;

  isRecording: boolean = false;
  isPaused: boolean = false;
  onAudioChunk?: (chunk: Blob) => any;
  public state: State = "stopped";
  onStateChange?: (state: State) => any;
  onAudioProcess?: (dataArray: Uint8Array) => any;
  onText?: OnTextCallback;
  visualizer?: (dataArray: Uint8Array) => any;
  smoothDataArray = new Array(4).fill(0);
  circleRadius: number = 0;

  public recognition: any | null = null;
  public text: string = "";
  public isRecognitionFinished: boolean = false;

  constructor(options?: {
    onAudioChunk?: (chunk: Blob) => any;
    onStateChange?: (state: State) => any;
    onAudioProcess?: (dataArray: Uint8Array) => any;
    onText?: OnTextCallback;
  }) {
    this.onAudioChunk = options?.onAudioChunk;
    this.onStateChange = options?.onStateChange;
    this.onAudioProcess = options?.onAudioProcess;
    this.onText = options?.onText;

    this.initSpeechRecognition();
  }

  private changeState(state: State) {
    this.state = state;
    if (this.onStateChange) this.onStateChange(state);
  }

  private handleChunk(chunk: Blob) {
    this.audioChunks.push(chunk);
    this.audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
    if (this.onAudioChunk) this.onAudioChunk(chunk);
  }

  private startAnalyser() {
    if (!this.audioContext || !this.analyser || !this.dataArray) return;

    const processAudio = () => {
      this.analyser!.getByteTimeDomainData(this.dataArray!);
      if (this.onAudioProcess)
        this.onAudioProcess(this.dataArray as Uint8Array);
      if (this.visualizer) this.visualizer(this.dataArray as Uint8Array);
      if (this.isRecording) {
        requestAnimationFrame(processAudio);
      }
    };

    processAudio.bind(this);
    processAudio();
  }

  async init(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);
      this.analyser.fftSize = 2048;

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      const changeState = this.changeState.bind(this);
      const handleChunk = this.handleChunk.bind(this);
      const startAnalyser = this.startAnalyser.bind(this);

      this.mediaRecorder.addEventListener("start", () => {
        changeState("recording");
        startAnalyser();
      });

      this.mediaRecorder.addEventListener("stop", () => {
        changeState("stopped");
      });

      this.mediaRecorder.addEventListener("pause", () => {
        changeState("paused");
      });

      this.mediaRecorder.addEventListener("resume", () => {
        changeState("recording");
        startAnalyser();
      });

      this.mediaRecorder.addEventListener("dataavailable", (e: BlobEvent) => {
        handleChunk(e.data);
      });

      this.mediaRecorder.addEventListener("stop", () => {
        this.audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
      });

      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  private initSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let fullTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        fullTranscript += transcript;
        if (event.results[i].isFinal) {
          this.text += transcript;
        }
      }

      this.text = fullTranscript;
      if (this.onText) this.onText(this.text);
    };

    this.recognition.onerror = (event: Event) => {
      console.error("Speech recognition error", event);
    };

    this.recognition.onend = () => {
      this.isRecognitionFinished = true;
    };
  }

  private startSpeechRecognition() {
    if (this.recognition && !this.isPaused) {
      this.recognition.start();
    }
  }

  private stopSpeechRecognition() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  start() {
    this.audioBlob = null;
    this.audioChunks = [];
    this.text = "";
    this.isRecognitionFinished = false;

    this.init().then(() => {
      if (!this.isRecording && this.mediaRecorder) {
        this.mediaRecorder.start();
        this.isRecording = true;
        this.started = true;
        this.isPaused = false;
        this.startSpeechRecognition();
      }
    });

    return this;
  }

  stop() {
    this.isRecording = false;
    if (this.mediaRecorder) this.mediaRecorder.stop();
    this.stopSpeechRecognition();
    this.changeState("stopped");

    if (this.visualizer) this.visualizer([] as any);

    return this;
  }

  cancel() {
    this.stop();
    this.started = false;
    this.isRecognitionFinished = true;
    this.text = "";

    return this;
  }

  pause() {
    if (this.isRecording && !this.isPaused && this.mediaRecorder) {
      this.mediaRecorder.pause();
      this.isRecording = false;
      this.isPaused = true;
      this.changeState("paused");
      this.stopSpeechRecognition();
    }

    return this;
  }

  resume(): void {
    if (!this.isRecording && this.isPaused && this.mediaRecorder) {
      this.mediaRecorder.resume();
      this.isPaused = false;
      this.isRecording = true;
      this.isRecognitionFinished = false;
      this.changeState("recording");
      this.startSpeechRecognition();
    }
  }

  getBlob(): Blob | null {
    if (!this.audioBlob) return null;
    return this.audioBlob;
  }

  getObjectUrl(): string | null {
    if (!this.audioBlob) return null;
    const url = URL.createObjectURL(this.audioBlob);
    return url;
  }

  toString(): string | null {
    if (this.audioBlob) {
      return URL.createObjectURL(this.audioBlob);
    }

    return null;
  }

  async asRunInput(): Promise<RunInputs | null> {
    if (this.recognition) {
      while (!this.isRecognitionFinished) {
        await sleep(5);
      }

      if (this.text.length > 0) {
        return {
          message: this.text,
        };
      }
    }

    return new Promise((resolve) => {
      if (!this.audioBlob) {
        resolve(null);
        return;
      }

      const reader = new FileReader();

      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve({
          audio: [
            {
              type: "base64",
              value: dataUrl,
            },
          ],
        });
      };

      reader.readAsDataURL(this.audioBlob);
    });
  }

  async finish() {
    this.stop();
    this.started = false;

    if (!this.recognition) {
      return this;
    }

    while (!this.isRecognitionFinished) {
      await sleep(5);
    }

    return this;
  }

  addVisualizer(element: HTMLCanvasElement | string, color: string) {
    const visualize = this.visualize.bind(this);
    visualize(element, this.dataArray || ([] as any), color);
    const visualizeFunction = (dataArray: Uint8Array) => {
      visualize(element, dataArray, color);
    };

    this.visualizer = visualizeFunction;
  }

  visualize(
    element: HTMLCanvasElement | string,
    dataArray: Uint8Array,
    color: string,
  ) {
    const elm =
      typeof element === "string" ? document.getElementById(element) : element;

    if (!elm) {
      throw new Error("Canvas element is not found");
    }

    const canvas = elm as HTMLCanvasElement;
    const canvasCtx = canvas.getContext("2d");

    if (!canvasCtx) {
      throw new Error("Can't get canvas context");
    }

    const width = canvas.width;
    const height = canvas.height;
    const barCount = 4;
    const centerX = width / 2;
    const centerY = height / 2;
    const barWidth = width / (barCount * 2); // Adjusted bar width to make space for centering
    const barSpacing = barWidth / 2; // Space between bars
    const maxRadius = barWidth / 2; // Rounded corners radius

    // Smooth transition for the circle radius
    const targetRadius =
      dataArray.length !== 0 && this.state === "recording" ? 0 : width; // Increase circle size
    this.circleRadius += (targetRadius - this.circleRadius) * 0.1;

    // Clear the canvas
    canvasCtx.clearRect(0, 0, width, height);

    if (this.circleRadius > 1) {
      // Draw the circle when stopped or paused
      canvasCtx.fillStyle = color;
      canvasCtx.beginPath();
      canvasCtx.arc(centerX, centerY, this.circleRadius, 0, 2 * Math.PI);
      canvasCtx.fill();
    } else {
      // Calculate total wave width and start X position for centering
      const totalWaveWidth = barCount * barWidth + (barCount - 1) * barSpacing;
      const startX = (width - totalWaveWidth) / 2;

      // Draw the wave when recording
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
