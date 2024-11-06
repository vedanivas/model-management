import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload } from 'lucide-react';
import io from 'socket.io-client';
import axios from 'axios';
import { Toast } from './Toast.jsx';
import { LoadingSpinner } from './Loading.jsx';
import { ResponseModal } from './ResponseModal.jsx';
import { Modal } from '@mui/material';

export function AudioRecorder({keyword}) {
  const [audioURL, setAudioURL] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [isLoading, setIsLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [modelResponse, setModelResponse] = useState({ response: '', confidence: 0 });
  const mediaRecorder = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef();
  const audioContext = useRef();
  const analyser = useRef();
  const dataArray = useRef();
  const socketRef = useRef(null);

  const model = JSON.parse(window.localStorage.getItem("model"))

  useEffect(() => {

    const initiateSocket = () => {
      socketRef.current = io("http://localhost:5050");

      socketRef.current.on("model_response", (prediction) => {
        console.log("Prediction:", prediction);
        if (mediaRecorder.current) {
          mediaRecorder.current.stop();
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          socketRef.current.emit("stop_recording_to_model");
          setRecording(false);
          mediaRecorder.current = null;
        }
        // setDetectedKeyword(prediction);
        // setPopupOpen(true);
        // alert(prediction)
        setModelResponse(prediction);
        setShowResponseModal(true);
      })

      socketRef.current.on("stop_recording_to_model", () => {
        if (mediaRecorder.current) {
          mediaRecorder.current.stop();
          socketRef.current.emit("stop_recording_to_model");
          setRecording(false);
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          mediaRecorder.current = null;
          console.log("Recording has been stopped by the server.");
        }
      })

      socketRef.current.on("stop_recording", ({ keyword }) => {
        if (mediaRecorder.current) {
          mediaRecorder.current.stop();
          socketRef.current.emit("stop_recording");
          stopRecording();
          setRecording(false);
          mediaRecorder.current = null;
        }
        setModelResponse({response: `${keyword} detected`, confidence: null});
        setShowResponseModal(true);
        // setDetectedKeyword(keyword);
        // setPopupOpen(true);
      });

      socketRef.current.on("wakeword_detected", () => {
        stopRecording();
        setRecording(false);
        console.log('hello');
        // setMessage("Wakeword detected!");
        setModelResponse({response: `${keyword} detected`, confidence: null});
        setShowResponseModal(true);
      });

      socketRef.current.on("wakeword_detected_from_file", ({ keyword }) => {
        // setDetectedKeyword(keyword);
        // setPopupOpen(true);
        setModelResponse({response: `${keyword} detected`, confidence: null});
        setShowResponseModal(true);
      });

      socketRef.current.on("process_completed", () => {
        // setMessage("Process completed");
        setToastMessage('Process Completed');
        setShowToast(true);
      });

      return () => {
        socketRef.current.disconnect();
      };
    }

    const loadModel = async () => {
      if (model.model_dir === "wake-word") {
        setIsLoading(false);
        return;
      }
      try {
        const res = await axios.get(`http://localhost:5001/loadModel?model_name=${model.model_dir}`);
        if (res.data.status !== "success") {
          console.error("Error loading model:", res.data.message);
          return;
        }
        console.log("Model loaded successfully.");
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading model:", error);
      }
    }

    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 256;
      dataArray.current = new Uint8Array(analyser.current.frequencyBinCount);
    }

    initiateSocket();
    loadModel();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyser.current || !dataArray.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const bufferLength = analyser.current.frequencyBinCount;
    const barCount = 32;
    const skipCount = Math.floor(bufferLength / barCount);

    analyser.current.getByteFrequencyData(dataArray.current);

    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#f8fafc');
    bgGradient.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const barGradient = ctx.createLinearGradient(0, height, 0, 0);
    barGradient.addColorStop(0, '#4f46e5');
    barGradient.addColorStop(0.5, '#818cf8');
    barGradient.addColorStop(1, '#6366f1');

    const barWidth = (width / barCount) * 0.8;
    const barSpacing = (width - barCount * barWidth) / (barCount + 1);
    let x = barSpacing;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = i * skipCount;
      const value = dataArray.current[dataIndex];
      let barHeight = (value / 255) * height * 0.8;
      barHeight = Math.max(barHeight, 10);

      const cornerRadius = barWidth / 2;

      ctx.beginPath();
      ctx.moveTo(x + cornerRadius, height);
      ctx.lineTo(x + cornerRadius, height - barHeight + cornerRadius);
      ctx.quadraticCurveTo(x, height - barHeight, x + cornerRadius, height - barHeight);
      ctx.lineTo(x + barWidth - cornerRadius, height - barHeight);
      ctx.quadraticCurveTo(x + barWidth, height - barHeight, x + barWidth - cornerRadius, height - barHeight + cornerRadius);
      ctx.lineTo(x + barWidth - cornerRadius, height);

      ctx.shadowColor = 'rgba(99, 102, 241, 0.3)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 5;
      ctx.fillStyle = barGradient;
      ctx.fill();

      const shineGradient = ctx.createLinearGradient(x, height - barHeight, x + barWidth, height);
      shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
      shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
      shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
      ctx.fillStyle = shineGradient;
      ctx.fill();

      x += barWidth + barSpacing;
    }

    animationRef.current = requestAnimationFrame(drawVisualizer);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          model.model_dir === "wake-word" ? socketRef.current.emit("audioData", { audioBlob: e.data, keyword })
            : socketRef.current.emit("audioDataToModel", { audioBlob: e.data, model: model.model_dir });
        }
      };

      setRecording(true);

      model.model_dir === "wake-word" ? mediaRecorder.current.start(2000) : mediaRecorder.current.start(3000); // Send data every 3000ms

      if (audioContext.current && analyser.current) {
        const source = audioContext.current.createMediaStreamSource(stream);
        source.connect(analyser.current);
      }

      // mediaRecorder.current.onstop = () => {
      //   setToastMessage('Recording completed successfully!');
      //   setToastType('success');
      //   setShowToast(true);
      // };

      setRecording(true);
      drawVisualizer();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setToastMessage('Error accessing microphone. Please check permissions.');
      setToastType('error');
      setShowToast(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setRecording(false);
      model.model_dir === "wake-word" ? socketRef.current.emit("stop_recording") : socketRef.current.emit("stop_recording_to_model");
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      mediaRecorder.current = null;
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }
  return (
    <div className="space-y-6">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          className="w-full rounded-xl bg-slate-50 shadow-inner"
        />
        {!recording && !audioURL && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            Click Start Recording to begin
          </div>
        )}
      </div>

      <div className="flex justify-center gap-4">
        {!recording ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all hover:shadow-lg hover:-translate-y-0.5 duration-200"
          >
            <Mic className="w-5 h-5" />
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all hover:shadow-lg hover:-translate-y-0.5 duration-200 animate-pulse"
          >
            <Square className="w-5 h-5" />
            Stop Recording
          </button>
        )}
      </div>

      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}

      <Modal open={showResponseModal} onClose={() => setShowResponseModal(false)}>
        <ResponseModal
          isOpen={showResponseModal}
          onClose={() => setShowResponseModal(false)}
          response={modelResponse}
        />
      </Modal>
    </div>
  );
}