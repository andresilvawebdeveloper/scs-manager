import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function RegistrationWizard({ onBack }) {
  const { addRegistration } = useApp();
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    athleteName: '',
    birthDate: '',
    parentName: '',
    email: '',
    phone: '',
    clothingType: 'Fato de Treino',
    clothingSize: 'M',
  });

  const [feedback, setFeedback] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = (e) => {
    e.preventDefault();
    setStep(step + 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = addRegistration(formData);
    setFeedback(result);
  };

  if (feedback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-t-4 border-clubRed">
          <h2 className={`text-xl font-bold mb-4 ${feedback.success ? 'text-green-600' : 'text-clubRed'}`}>
            {feedback.success ? 'Inscrição Submetida!' : 'Atenção'}
          </h2>
          <p className="text-gray-700 mb-6">{feedback.message}</p>
          <button
            onClick={() => {
              if (feedback.success) {
                onBack();
              } else {
                setFeedback(null);
                setStep(1);
              }
            }}
            className="w-full py-3 bg-clubRed text-white font-semibold rounded-xl"
          >
            {feedback.success ? 'Voltar ao Início' : 'Tentar Novamente'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-6 md:p-8 border-t-4 border-clubRed">
        
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800">
            ← Voltar
          </button>
          <span className="text-xs font-bold px-3 py-1 bg-red-100 text-clubRed rounded-full">
            Passo {step} de 3
          </span>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-6">Inscrição de Atleta</h2>

        {step === 1 && (
          <form onSubmit={handleNext} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo do Atleta</label>
              <input
                type="text"
                name="athleteName"
                required
                value={formData.athleteName}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-clubRed focus:outline-none"
                placeholder="Ex: Maria Silva"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
              <input
                type="date"
                name="birthDate"
                required
                value={formData.birthDate}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-clubRed focus:outline-none"
              />
            </div>
            <button type="submit" className="w-full py-3 bg-clubRed text-white font-semibold rounded-xl mt-4">
              Seguinte
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleNext} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Encarregado de Educação</label>
              <input
                type="text"
                name="parentName"
                required
                value={formData.parentName}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-clubRed focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-clubRed focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telemóvel</label>
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-clubRed focus:outline-none"
              />
            </div>
            <div className="flex space-x-3">
              <button type="button" onClick={() => setStep(1)} className="w-1/2 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl">
                Anterior
              </button>
              <button type="submit" className="w-1/2 py-3 bg-clubRed text-white font-semibold rounded-xl">
                Seguinte
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Roupa Pretendida</label>
              <select
                name="clothingType"
                value={formData.clothingType}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-clubRed focus:outline-none"
              >
                <option value="Fato de Treino">Fato de Treino</option>
                <option value="T-Shirt">T-Shirt</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tamanho</label>
              <select
                name="clothingSize"
                value={formData.clothingSize}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-clubRed focus:outline-none"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </div>
            <div className="flex space-x-3">
              <button type="button" onClick={() => setStep(2)} className="w-1/2 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl">
                Anterior
              </button>
              <button type="submit" className="w-1/2 py-3 bg-clubRed text-white font-semibold rounded-xl">
                Submeter Inscrição
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}