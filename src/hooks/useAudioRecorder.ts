import { useState, useRef, useCallback } from 'react';

// Get supported MIME type for audio recording
function getSupportedMimeType(): string {
  const types = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return ''; // Let browser choose default
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [volume, setVolume] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mimeTypeRef = useRef<string>('');
  const pendingStreamRef = useRef<MediaStream | null>(null);

  const updateVolume = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
      setVolume(avg);
    }
    animationFrameRef.current = requestAnimationFrame(updateVolume);
  }, []);

  // Request microphone permission and store the stream for later use
  const requestPermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      pendingStreamRef.current = stream;
      return true;
    } catch {
      return false;
    }
  };

  const startRecording = async () => {
    // Use pending stream if available, otherwise request new one
    const stream = pendingStreamRef.current || await navigator.mediaDevices.getUserMedia({ audio: true });
    pendingStreamRef.current = null; // Clear the pending stream
    
    // Set up audio analysis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    audioContextRef.current = audioCtx;
    analyserRef.current = analyser;
    
    // Start volume monitoring
    updateVolume();
    
    // Get supported MIME type
    mimeTypeRef.current = getSupportedMimeType();
    const options = mimeTypeRef.current ? { mimeType: mimeTypeRef.current } : undefined;
    
    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const mimeType = mimeTypeRef.current || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioUrl(url);
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setVolume(0);
  };

  const resetRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
  }, [audioUrl]);

  return { isRecording, audioUrl, audioBlob, volume, startRecording, stopRecording, setAudioUrl, resetRecording, requestPermission };
}
