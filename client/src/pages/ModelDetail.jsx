import React, { useState } from 'react';
import { AudioRecorder } from '../components/AudioRecorder';
import { ArrowLeft, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Toast } from '../components/Toast';
import { ResponseModal } from '../components/ResponseModal';
import { Modal, CircularProgress } from '@mui/material';

export function ModelDetail() {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [progress, setProgress] = useState(false);
  const [modelResponse, setModelResponse] = useState({ response: '', confidence: 0 });
  const [keyword, setKeyword] = useState("");

  const navigate = useNavigate();

  const model = JSON.parse(window.localStorage.getItem('model'));

  const handleFileUpload = async () => {
    // const file = event.target.files?.[0];
    setProgress(true);
    if (!file) {
      setToastMessage('Please select a file to upload');
      setToastType('error');
      setShowToast(true);
      return;
    }

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg'];
    if (!validTypes.includes(file.type)) {
      setToastMessage('Please upload a valid audio file (MP3, WAV, OGG)');
      setToastType('error');
      setShowToast(true);
      setProgress(false);
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setToastMessage('File size must be less than 10MB');
      setToastType('error');
      setShowToast(true);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    if (model.model_dir === "wake-word") formData.append("keyword", keyword);
    else formData.append("model_name", model.model_dir);

    const url = model.model_dir === "wake-word" ? "http://localhost:5050/upload_wav" : "http://localhost:5050/uploadAudioToModel";

    try {
      const response = await axios.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

     if (model.model_dir !== "wake-word") {
      console.log(response.data);
      setModelResponse(response.data);
      setShowResponseModal(true);
    }
      setFile(null);
    } catch (error) {
      console.error("Error uploading file:", error);
    }

    // setToastMessage('File uploaded successfully!');
    // setToastType('success');
    // setShowToast(true);
    setProgress(false);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    setFile(e.dataTransfer.files?.[0]);
    const temp = e.dataTransfer.files?.[0];
    if (!temp) {
      setToastMessage('Please drop a valid file');
      setToastType('error');
      setShowToast(true);
      return;
    }

    // handleFileUpload(event);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => {
            window.localStorage.removeItem('model');
            navigate("/")
          }}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Models
        </button>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{model.name}</h1>
          <p className="text-gray-600">Upload or record audio for processing</p>
        </div>

        {
          model.model_dir === "wake-word" && <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <input
              type="text"
              placeholder="Enter a keyword"
              value={keyword}
              className="keyword-input model-input"
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Upload Audio File
            </h2>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors
                ${dragActive
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-300 hover:border-indigo-400'}`}
            >

              <input
                type="file"
                accept="audio/*"
                className="hidden"
                id="audio-upload"
                onChange={(e) => setFile(e.target.files?.[0])}
              />
              {
                !file ? (
                  <label
                    htmlFor="audio-upload"
                    className="cursor-pointer text-indigo-600 hover:text-indigo-500"
                  >
                    Click to upload
                  </label>
                ) : (
                  <label className="text-gray-800 font-medium">
                    {file.name}
                  </label>
                )
              }

              <p className="text-sm text-gray-500 mt-2">or drag and drop</p>
              <p className="text-xs text-gray-400 mt-1">MP3, WAV, OGG up to 10MB</p>
            </div>
            <div className="flex justify-center gap-4">
              <button
                size="medium"
                onClick={handleFileUpload}
                disabled={!file || progress}
                className={`mt-4 px-4 py-2 rounded-lg transition-colors relative ${!file || progress
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' // Disabled styles
                  : 'bg-indigo-600 text-white hover:bg-indigo-700' // Enabled styles
                  }`}
              >
                {/* Overlay the circular progress indicator when uploading */}
                {progress && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CircularProgress size={24} />
                  </div>
                )}

                {/* Upload text content */}
                <span className={progress ? 'opacity-0' : 'opacity-100'}>
                  Upload
                </span>
              </button>

            </div>


          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Record Audio</h2>
            <AudioRecorder keyword={keyword} />
          </div>
        </div>
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