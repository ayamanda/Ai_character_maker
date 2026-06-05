'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { CharacterData, LiveModeState } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';

interface LiveModePanelProps {
  characterData: CharacterData;
  onTranscript?: (text: string, role: 'user' | 'model') => void;
  onClose: () => void;
}

// ─── Audio helpers ────────────────────────────────────────────────────────────

async function getMicrophoneStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
}

function playAudioChunk(ctx: AudioContext, data: ArrayBuffer) {
  ctx.decodeAudioData(data.slice(0), (buffer) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveModePanel({
  characterData,
  onTranscript,
  onClose,
}: LiveModePanelProps) {
  const [liveState, setLiveState] = useState<LiveModeState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // ─── Cleanup ────────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    audioProcessorRef.current?.disconnect();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    sessionRef.current?.close?.();
    audioContextRef.current?.close();
    sessionRef.current = null;
    micStreamRef.current = null;
    audioContextRef.current = null;
    audioProcessorRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ─── Connect Live session ────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    setLiveState('connecting');
    setErrorMsg(null);

    try {
      // 1. Get Firebase ID token for backend auth
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const idToken = await user.getIdToken();

      // 2. Mint ephemeral token from our backend
      const tokenRes = await fetch('/api/live/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterData, idToken }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error || 'Failed to get live token');
      }

      const { token, model, systemInstruction } = await tokenRes.json();

      // 3. Open microphone
      const micStream = await getMicrophoneStream().catch(() => {
        throw new Error('Microphone permission denied. Please allow mic access and try again.');
      });
      micStreamRef.current = micStream;

      // 4. Connect to Gemini Live using the Google GenAI SDK
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1alpha' }
      });

      const session = await ai.live.connect({
        model: model,
        config: {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { responseModalities: [Modality.AUDIO] }
        },
        callbacks: {
          onopen: () => {
            setLiveState('listening');
          },
          onmessage: (msg: any) => {
            if (msg.serverContent) {
              const serverContent = msg.serverContent;

              // Handle audio output
              if (serverContent.modelTurn?.parts) {
                for (const part of serverContent.modelTurn.parts) {
                  if (part.inlineData) {
                    setLiveState('model-speaking');
                    const binaryStr = atob(part.inlineData.data);
                    const bytes = new Uint8Array(binaryStr.length);
                    for (let i = 0; i < binaryStr.length; i++) {
                      bytes[i] = binaryStr.charCodeAt(i);
                    }
                    if (audioContextRef.current) {
                      playAudioChunk(audioContextRef.current, bytes.buffer);
                    }
                  }
                }
              }

              // Handle turn completion
              if (serverContent.turnComplete) {
                setLiveState('listening');
              }

              // Handle interruptions (barge-in)
              if (serverContent.interrupted) {
                setLiveState('interrupted');
                setTimeout(() => setLiveState('listening'), 600);
              }

              // Handle text transcriptions
              if (serverContent.inputTranscription?.text) {
                const text = serverContent.inputTranscription.text;
                setTranscript((prev) => [...prev, { role: 'user', text }]);
                onTranscript?.(text, 'user');
              }
              if (serverContent.outputTranscription?.text) {
                const text = serverContent.outputTranscription.text;
                setTranscript((prev) => [...prev, { role: 'model', text }]);
                onTranscript?.(text, 'model');
              }
            }
          },
          onerror: (err: any) => {
            console.error('[LiveMode] SDK error:', err);
            setErrorMsg('Connection error. Try reconnecting.');
            setLiveState('error');
          },
          onclose: (e: any) => {
            console.log('[LiveMode] SDK closed');
            setErrorMsg(`Disconnected`);
            setLiveState('error');
          }
        }
      });

      sessionRef.current = session;

      // 5. Pipe microphone audio to Gemini
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(micStream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMuted || !sessionRef.current) return;
        try {
          const pcmData = e.inputBuffer.getChannelData(0);
          // Convert Float32 PCM → Int16 for Gemini Live
          const int16 = new Int16Array(pcmData.length);
          for (let i = 0; i < pcmData.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, pcmData[i] * 32768));
          }
          
          sessionRef.current.sendRealtimeInput([{
            mimeType: 'audio/pcm;rate=16000',
            data: btoa(String.fromCharCode(...new Uint8Array(int16.buffer)))
          }]);
        } catch (err) {
          console.warn('[LiveMode] Failed to send audio chunk:', err);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

    } catch (err: any) {
      console.error('[LiveMode] connect error:', err);
      setErrorMsg(err?.message || 'Failed to start live session');
      setLiveState('error');
      cleanup();
    }
  }, [characterData, isMuted, cleanup, onTranscript]);

  const disconnect = useCallback(() => {
    cleanup();
    setLiveState('idle');
    setTranscript([]);
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m);
  }, []);

  // ─── UI states ───────────────────────────────────────────────────────────────

  const stateLabel: Record<LiveModeState, string> = {
    idle: 'Ready to connect',
    connecting: 'Connecting…',
    listening: `Listening to you…`,
    'model-speaking': `${characterData.name} is speaking…`,
    interrupted: 'Interrupted',
    error: errorMsg ?? 'Error',
    disconnected: 'Disconnected',
  };

  const isActive = liveState !== 'idle' && liveState !== 'disconnected' && liveState !== 'error';

  // ─── Waveform animation ───────────────────────────────────────────────────

  const WaveIndicator = ({ active }: { active: boolean }) => (
    <div className={cn('flex items-end gap-0.5 h-8', active ? 'opacity-100' : 'opacity-30')}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-full bg-gradient-to-t from-purple-600 to-pink-500 transition-all',
            active && 'animate-bounce'
          )}
          style={{
            height: active ? `${20 + Math.sin(i * 1.3) * 12}px` : '8px',
            animationDelay: `${i * 80}ms`,
            animationDuration: '600ms',
          }}
        />
      ))}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Status */}
      <div className="flex flex-col items-center justify-center flex-1 gap-6 p-6">
        {/* Avatar with pulse ring */}
        <div className="relative">
          <div
            className={cn(
              'absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 blur-md opacity-40 transition-all duration-500',
              liveState === 'listening' && 'scale-125 opacity-60',
              liveState === 'model-speaking' && 'scale-150 opacity-80 animate-pulse',
              liveState === 'interrupted' && 'scale-110 opacity-30'
            )}
          />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {characterData.name.slice(0, 2).toUpperCase()}
          </div>
        </div>

        {/* Waveform */}
        <WaveIndicator active={liveState === 'model-speaking'} />

        {/* State label */}
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{stateLabel[liveState]}</p>
          {liveState === 'connecting' && (
            <Loader2 className="h-4 w-4 animate-spin mx-auto mt-2 text-muted-foreground" />
          )}
          {errorMsg && liveState === 'error' && (
            <p className="text-xs text-red-500 mt-1 max-w-xs text-center">{errorMsg}</p>
          )}
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="w-full max-h-40 overflow-y-auto space-y-1.5 px-2">
            {transcript.map((t, i) => (
              <p
                key={i}
                className={cn(
                  'text-xs rounded-lg px-3 py-1.5',
                  t.role === 'user'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-right ml-8'
                    : 'bg-muted text-left mr-8'
                )}
              >
                {t.text}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-border p-4 flex items-center justify-center gap-3">
        {!isActive ? (
          <>
            <Button
              onClick={connect}
              className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              <Mic className="h-4 w-4" />
              Start Live Mode
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            {/* Mute toggle */}
            <Button
              variant={isMuted ? 'destructive' : 'outline'}
              size="icon"
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
              className="h-10 w-10 rounded-full"
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>

            {/* Volume indicator */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Volume2 className="h-3.5 w-3.5" />
              <span>Live</span>
            </div>

            {/* Hang up */}
            <Button
              variant="destructive"
              size="icon"
              onClick={() => { disconnect(); onClose(); }}
              title="End live session"
              className="h-10 w-10 rounded-full"
            >
              <PhoneOff className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
