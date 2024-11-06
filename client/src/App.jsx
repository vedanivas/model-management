import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { PlusCircle, Boxes, Search } from 'lucide-react'
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import { ModelCard } from './components/ModelCard.jsx'
import { ModelForm } from './components/ModelForm.jsx'
import { ModelDetail } from './pages/ModelDetail.jsx'
import { LoadingSpinner } from './components/Loading.jsx'
import axios from 'axios'
import { Toast } from './components/Toast.jsx'

const App = () => {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [progress, setProgress] = useState(false);
  const [models, setModels] = useState([
    {
      id: '1',
      name: 'Speech Recognition Model',
      description: 'Advanced model for converting speech to text with high accuracy.',
    },
    {
      id: '2',
      name: 'Text-to-Speech Model',
      description: 'Natural-sounding voice synthesis model with multiple language support.',
    },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('http://localhost:5050/getModels')
        setModels(res.data)
        console.log(res.data[0])
        setIsLoading(false)
      } catch (error) {
        console.error(error)
      }
    }

    fetchData()
  }, [])

  const filteredModels = models.filter(
    model =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddModel = async (data) => {
    setProgress(true);
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('description', data.description);
    formData.append('file', data.file);

    const response = await fetch("http://localhost:5050/addModel", {
      method: "POST",
      body: formData,
    });

    const newModel = await response.json();
    console.log(newModel)

    const res = await axios.get('http://localhost:5050/testModel?model_dir=' + newModel.model_dir)
    console.log("Response: ", res.data)
    if (res.data.status === 'success') {
      setModels([...models, newModel]);
      setShowModal(false);
    }
    else {
      await handleDeleteModel(newModel.id)
      setToastMessage('Model not valid, please upload a valid model file')
      setToastType('error')
      setShowToast(true)
    }

    setProgress(false);
  };

  const handleEditModel = async (data) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('description', data.description);
    if (data.file)
      formData.append('file', data.file);
    else
      formData.append('file', null);

    const response = await fetch(`http://localhost:5050/editModel/${data.id}`, {
      method: "PUT",
      body: formData,
    });

    const newModel = await response.json();
    console.log(newModel)

    models.every((model, index) => {
      if (model.id === newModel.id) {
        models[index] = newModel;
        return false;
      }
      return true;
    })

    setModels(models);
    window.location.reload();
  };

  const handleDeleteModel = async (id) => {
    try {
      await axios.delete(`http://localhost:5050/deleteModel/${id}`);
      setModels(models.filter(model => model.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 py-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Boxes className="w-8 h-8 text-indigo-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Model Management</h1>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <PlusCircle className="w-5 h-5" />
                  Add Model
                </button>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="grid gap-4">
                {filteredModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    {...model}
                    onEdit={handleEditModel}
                    onDelete={handleDeleteModel}
                  />
                ))}
                {filteredModels.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No models found matching your search.
                  </div>
                )}
              </div>

              {showModal && (
                <ModelForm
                  onClose={() => setShowModal(false)}
                  onSubmit={handleAddModel}
                />
              )}

              {showToast && (
                <Toast
                  message={toastMessage}
                  type={toastType}
                  onClose={() => setShowToast(false)}
                />
              )}
              <Backdrop
                sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
                open={progress}
              >
                <CircularProgress color="inherit" />
              </Backdrop>
            </div>
          </div>
        } />
        <Route path="/model/:id" element={<ModelDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
