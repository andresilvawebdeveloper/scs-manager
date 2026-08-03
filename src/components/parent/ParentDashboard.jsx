import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function ParentDashboard({ registration, onLogout }) {
  const { updateRegistrationByParent } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(registration);
  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = (e) => {
    e.preventDefault();
    updateRegistrationByParent(registration.id, formData);
    setSuccessMsg('Dados atualizados com sucesso! Como alterou os dados, a inscrição ficou pendente de nova validação pelo treinador.');
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-clubRed text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="font-bold text-sm">Área do Encarregado de Educação</h1>
        <button onClick={onLogout} className="text-xs bg-white text-clubRed px-3 py-1.5 rounded-lg font-semibold">
          Sair
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        
        {successMsg && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs font-medium">
            {successMsg}
          </div>
        )}

        {/* Estado da Inscrição */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-gray-800">Estado da Inscrição</h2>
            <span className={`px-3 py-1 text-xs font-bold rounded-full ${
              registration.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {registration.status === 'accepted' ? 'Aceite ✓' : 'Pendente de Validação'}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Código de Acesso Pessoal: <strong className="text-gray-900">{registration.accessCode}</strong>
          </p>
        </div>

        {/* Regulamento e Fichas Importantes */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-3">
          <h2 className="font-bold text-gray-800 text-sm">Documentos e Regulamentos</h2>
          <div className="space-y-2">
            <a href="#" className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs text-clubRed font-semibold transition">
              📄 Baixar Regulamento Interno do Clube (PDF)
            </a>
            <a href="#" className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs text-clubRed font-semibold transition">
              📄 Ficha de Autorização de Saídas e Imagem (PDF)
            </a>
          </div>
        </div>

        {/* Dados do Atleta / Inscrição */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-gray-800 text-sm">Dados da Inscrição</h2>
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-semibold"
              >
                Editar Dados
              </button>
            )}
          </div>

          {!isEditing ? (
            <div className="text-xs text-gray-600 space-y-2 bg-gray-50 p-4 rounded-xl">
              <p><strong>Atleta:</strong> {formData.athleteName}</p>
              <p><strong>Data de Nascimento:</strong> {formData.birthDate}</p>
              <p><strong>Encarregado de Educação:</strong> {formData.parentName}</p>
              <p><strong>Email:</strong> {formData.email}</p>
              <p><strong>Telemóvel:</strong> {formData.phone}</p>
              <p><strong>Roupa:</strong> {formData.clothingType} - Tamanho: {formData.clothingSize}</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome do Atleta</label>
                <input type="text" name="athleteName" value={formData.athleteName} onChange={handleChange} className="w-full p-2.5 border rounded-xl text-xs" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Data de Nascimento</label>
                <input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} className="w-full p-2.5 border rounded-xl text-xs" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome do EE</label>
                <input type="text" name="parentName" value={formData.parentName} onChange={handleChange} className="w-full p-2.5 border rounded-xl text-xs" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2.5 border rounded-xl text-xs" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Telemóvel</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2.5 border rounded-xl text-xs" required />
              </div>
              <div className="flex space-x-2 pt-2">
                <button type="button" onClick={() => setIsEditing(false)} className="w-1/2 py-2 bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold">Cancelar</button>
                <button type="submit" className="w-1/2 py-2 bg-clubRed text-white rounded-xl text-xs font-semibold">Guardar Alterações</button>
              </div>
            </form>
          )}
        </div>

      </main>
    </div>
  );
}