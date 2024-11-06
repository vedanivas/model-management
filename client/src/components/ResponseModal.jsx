import React from 'react';
import { X, CheckCircle } from 'lucide-react';

export function ResponseModal({ isOpen, onClose, response }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Model Response</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Processing Complete</span>
          </div>
          
          <div className="space-y-2">
            <h3 className="font-medium text-gray-900">Prediction</h3>
            <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{response.response}</p>
          </div>
          
          {
            response.confidence &&
            <div className="space-y-2">
            <h3 className="font-medium text-gray-900">Confidence Score</h3>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" 
                  style={{ width: `${response.confidence}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1">{response.confidence}% confident</p>
            </div>
          </div>
          }
        </div>
        
        <button
          onClick={onClose}
          className="w-full mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}