import { useState } from 'react';
import { Trash2, Edit, Waves, Delete, Link } from 'lucide-react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { EditModelForm } from './EditModelForm.jsx'
import { Modal } from '@mui/material';

const convertToSlug = (str) => {
  return str.toLowerCase().trim().replace(/\s+/g, '-');
}

export function ModelCard({ id, name, description, model_dir, onEdit, onDelete }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setEditShowModal] = useState(false);

  const navigate = useNavigate();

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    setShowDeleteModal(true)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer p-6 border border-gray-100 transform hover:-translate-y-1 duration-200">
      <div className="flex items-start justify-between">
        <div>
          <div onClick={() => {
            window.localStorage.setItem('model', JSON.stringify({ id: id, name: name, description: description, model_dir: model_dir }));
            navigate(`/model/${convertToSlug(name)}`);
          }} className="group">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2 group-hover:text-blue-600 transition-colors">
              <Waves className="w-5 h-5 text-indigo-600" />
              {name}
            </h3>
          </div>
          <p className="text-gray-600 text-sm">{description}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditShowModal(true);
            }}
            className="p-2 text-gray-600 hover:text-indigo-600 transition-colors rounded-full hover:bg-indigo-50"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-2 text-gray-600 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>      
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={() => onDelete(id)}
          modelName={name}
        />
      </Modal>

      <Modal open={showEditModal} onClose={() => setEditShowModal(false)}>
        <EditModelForm
          id={id}
          prevName={name}
          prevDescription={description}
          onClose={() => setEditShowModal(false)}
          onSubmit={onEdit}
        />
      </Modal>
    </div>
  );
}