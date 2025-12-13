import { GoogleGenAI, LiveServerMessage, Session } from '@google/genai';

import { VoiceProvider, VoiceSession, VoiceSessionConfig, VoiceSessionState } from './types';

export class GeminiVoiceProvider implements VoiceProvider {
  name = 'gemini';

  private session: Session | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private config: VoiceSessionConfig | null = null;
  private lastAudioTimeRef: number = 0;

  // Silence detection refs

  private silenceTimeoutRef: NodeJS.Timeout | null = null;
  private stopRecordingCallback: (() => void) | null = null;

  async startSession(config: VoiceSessionConfig): Promise<VoiceSession> {
    this.config = config;
    this.stopRecordingCallback = config.onStopRecording || null;
    this.setState(VoiceSessionState.CONNECTING);

    try {
      const client = new GoogleGenAI({
        apiKey: config.token,
        httpOptions: {
          apiVersion: 'v1alpha',
        },
      });

      const session = await client.live.connect({
        model: config.model,
        callbacks: {
          onopen: () => {
            this.setState(VoiceSessionState.ACTIVE);
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleMessage(message);
          },
          onclose: () => {
            this.setState(VoiceSessionState.CLOSED);
          },
          onerror: (e) => {
            this.setState(VoiceSessionState.ERROR);
            config.onError(new Error(e.message));
          },
        },
      });

      this.session = session;

      // Initialize silence detection
      this.lastAudioTimeRef = Date.now();

      await this.setupAudioProcessing(config.mediaStream);

      session.sendRealtimeInput({ activityStart: {} });

      return { isActive: true, provider: this };
    } catch (error) {
      this.setState(VoiceSessionState.ERROR);
      config.onError(error as Error);
      throw error;
    }
  }

  async stopSession(): Promise<void> {
    this.setState(VoiceSessionState.CLOSED);

    // Clear silence detection timeout
    if (this.silenceTimeoutRef) {
      clearTimeout(this.silenceTimeoutRef);
      this.silenceTimeoutRef = null;
    }

    // Cleanup audio processing
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Close Gemini session
    if (this.session) {
      try {
        this.session.close();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error closing Gemini session:', error);
      }
      this.session = null;
    }
  }

  private async setupAudioProcessing(stream: MediaStream): Promise<void> {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    this.audioContext = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    this.source = source;

    const processor = audioContext.createScriptProcessor(8192, 1, 1);
    this.processor = processor;

    processor.addEventListener('audioprocess', (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // Calculate RMS to detect audio level
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);

      // Check if audio level is above threshold (adjust as needed)
      const audioThreshold = 0.01; // Threshold for detecting audio input
      const hasAudioInput = rms > audioThreshold;

      if (hasAudioInput) {
        // Reset the silence timer when audio is detected
        this.lastAudioTimeRef = Date.now();

        // Clear existing timeout
        if (this.silenceTimeoutRef) {
          clearTimeout(this.silenceTimeoutRef);
        }
      } else {
        // Check for silence
        const timeSinceLastAudio = Date.now() - this.lastAudioTimeRef;
        const idleTimeoutMs = this.config?.idleTimeoutMs ?? 5000;
        if (timeSinceLastAudio > idleTimeoutMs && !this.silenceTimeoutRef) {
          this.silenceTimeoutRef = setTimeout(() => {
            this.stopRecordingCallback?.();
          }, 100);
        }
      }

      const pcmData = this.convertFloat32ToInt16(inputData);
      const base64Audio = this.arrayBufferToBase64(pcmData.buffer as ArrayBuffer);

      if (this.session) {
        this.session.sendRealtimeInput({
          media: {
            data: base64Audio,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      }
    });

    source.connect(processor);
    processor.connect(audioContext.destination);
  }

  private handleMessage(message: LiveServerMessage): void {
    if (message.serverContent?.inputTranscription) {
      const textChunk = message.serverContent.inputTranscription.text;
      if (textChunk) {
        this.config?.onTranscription(textChunk);
      }
    }
  }

  private convertFloat32ToInt16(float32Array: Float32Array): Int16Array {
    const pcmData = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcmData;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  private setState(newState: VoiceSessionState): void {
    this.config?.onSessionStateChange?.(newState);
  }
}

// Factory function
export const createGeminiVoiceProvider = (): VoiceProvider => {
  return new GeminiVoiceProvider();
};
