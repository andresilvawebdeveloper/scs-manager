import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function RegistrationWizard({ onBack }) {
  const { addRegistration } = useApp();
  const [step, setStep] = useState(1);
  const totalSteps = 8;
  
  const [formData, setFormData] = useState({
    athleteName: '',
    birthDate: '',
    gender: 'Masculino',
    athleteCC: '',
    address: '',
    city: '',
    postalCode: '',
    parentName: '',
    parentCC: '',
    phone: '+351 ',
    memberNumber: '',
    memberType: 'Atleta',
    clothingType: 'Fato de Treino',
    clothingSize: 'M',
  });

  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (error) setError('');
  };

  // Validação estrita por cada pergunta individual
  const validateCurrentStep = () => {
    setError('');
    
    switch (step) {
      case 1:
        if (!formData.athleteName.trim()) {
          setError('O nome completo do atleta é obrigatório.');
          return false;
        }
        break;
      case 2:
        if (!formData.birthDate) {
          setError('A data de nascimento é obrigatória.');
          return false;
        }
        break;
      case 3:
        const ccRegex = /^\d{8}[A-Z0-9]{4}$/;
        if (!ccRegex.test(formData.athleteCC.replace(/\s/g, ''))) {
          setError('Formato inválido (deve conter 8 dígitos + 4 caracteres, ex: 12345678ZX12).');
          return false;
        }
        break;
      case 4:
        if (!formData.address.trim() || !formData.city.trim()) {
          setError('A morada e a localidade são obrigatórias.');
          return false;
        }
        const cpRegex = /^\d{4}-\d{3}$/;
        if (!cpRegex.test(formData.postalCode.trim())) {
          setError('Código postal inválido (formato correto: 0000-000).');
          return false;
        }
        break;
      case 5:
        if (!formData.parentName.trim()) {
          setError('O nome do encarregado de educação é obrigatório.');
          return false;
        }
        const parentCCRegex = /^\d{8}[A-Z0-9]{4}$/;
        if (!parentCCRegex.test(formData.parentCC.replace(/\s/g, ''))) {
          setError('CC do encarregado de educação inválido (8 dígitos + 4 caracteres).');
          return false;
        }
        break;
      case 6:
        const phoneRegex = /^\+351\s?\d{9}$/;
        if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
          setError('Telemóvel inválido (deve começar com +351 seguido de 9 dígitos).');
          return false;
        }
        break;
      case 7:
        if (!formData.memberNumber.trim()) {
          setError('O número de sócio é obrigatório.');
          return false;
        }
        break;
      default:
        break;
    }
    return true;
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (validateCurrentStep()) {
      if (step < totalSteps) {
        setStep(step + 1);
      } else {
        handleSubmitFinal();
      }
    }
  };

  const handleSubmitFinal = () => {
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
          <p className="text-gray-700 mb-6 text-sm">{feedback.message}</p>
          <button
            onClick={() => {
              if (feedback.success) {
                onBack();
              } else {
                setFeedback(null);
                setStep(1);
              }
            }}
            className="w-full py-3 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition"
          >
            {feedback.success ? 'Voltar ao Início' : 'Tentar Novamente'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 md:p-8 border-t-4 border-clubRed">
        
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 font-medium">
            ← Voltar
          </button>
          <span className="text-xs font-bold px-3 py-1 bg-red-50 text-clubRed rounded-full">
            Pergunta {step} de {totalSteps}
          </span>
        </div>

        <form onSubmit={handleNext} className="space-y-6">
          
          {/* PERGUNTA 1: Nome do Atleta */}
          {step === 1 && (
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">
                Qual é o nome completo do atleta?
              </label>
              <input
                type="text"
                name="athleteName"
                value={formData.athleteName}
                onChange={handleChange}
                className="w-full p-3.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none"
                placeholder="Ex: Maria Silva"
                autoFocus
              />
            </div>
          )}

          {/* PERGUNTA 2: Data de Nascimento e Sexo */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-base font-bold text-gray-900 mb-1">
                  Qual é a data de nascimento do atleta?
                </label>
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  className="w-full p-3.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sexo</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full p-3.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none bg-white"
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                </select>
              </div>
            </div>
          )}

          {/* PERGUNTA 3: CC do Atleta */}
          {step === 3 && (
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">
                Qual é o número de Cartão de Cidadão do atleta?
              </label>
              <input
                type="text"
                name="athleteCC"
                value={formData.athleteCC}
                onChange={handleChange}
                placeholder="Ex: 12345678ZX1"
                className="w-full p-3.5 border border-gray-300 rounded-xl text-sm uppercase focus:ring-2 focus:ring-clubRed focus:outline-none"
                autoFocus
              />
              <span className="text-[11px] text-gray-400 block">Formato: 8 dígitos + 4 caracteres</span>
            </div>
          )}

          {/* PERGUNTA 4: Morada, Localidade e Código Postal */}
          {step === 4 && (
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">
                Qual é a morada e código postal?
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Morada (Ex: Rua Principal, nº 100)"
                className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Localidade"
                  className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none"
                />
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  placeholder="0000-000"
                  className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* PERGUNTA 5: Nome do EE e CC do EE */}
          {step === 5 && (
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">
                Dados do Encarregado de Educação
              </label>
              <input
                type="text"
                name="parentName"
                value={formData.parentName}
                onChange={handleChange}
                placeholder="Nome completo do EE"
                className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none"
                autoFocus
              />
              <input
                type="text"
                name="parentCC"
                value={formData.parentCC}
                onChange={handleChange}
                placeholder="CC do EE (8 dígitos + 4 chars)"
                className="w-full p-3 border border-gray-300 rounded-xl text-sm uppercase focus:ring-2 focus:ring-clubRed focus:outline-none"
              />
            </div>
          )}

          {/* PERGUNTA 6: Telemóvel */}
          {step === 6 && (
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">
                Qual é o contacto telefónico de emergência?
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+351 912345678"
                className="w-full p-3.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none"
                autoFocus
              />
              <span className="text-[11px] text-gray-400 block">Deve começar com +351</span>
            </div>
          )}

          {/* PERGUNTA 7: Número de Sócio e Titular */}
          {step === 7 && (
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">
                Número de Sócio do Clube
              </label>
              <input
                type="text"
                name="memberNumber"
                value={formData.memberNumber}
                onChange={handleChange}
                placeholder="Nº de Sócio (Ex: 452)"
                className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none"
                autoFocus
              />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">O sócio titular é:</label>
                <select
                  name="memberType"
                  value={formData.memberType}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none bg-white"
                >
                  <option value="Atleta">Atleta</option>
                  <option value="Pai">Pai</option>
                  <option value="Mãe">Mãe</option>
                </select>
              </div>
            </div>
          )}

          {/* PERGUNTA 8: Merchandising / Roupa */}
          {step === 8 && (
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">
                Seleção de Roupa e Merchandising
              </label>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Roupa Pretendida</label>
                <select
                  name="clothingType"
                  value={formData.clothingType}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none bg-white"
                >
                  <option value="Fato de Treino">Fato de Treino</option>
                  <option value="T-Shirt">T-Shirt</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tamanho</label>
                <select
                  name="clothingSize"
                  value={formData.clothingSize}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none bg-white"
                >
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                </select>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-clubRed font-semibold mt-2">{error}</p>
          )}

          <div className="flex space-x-3 pt-4">
            {step > 1 && (
              <button
                type="button"
                onClick={() => { setStep(step - 1); setError(''); }}
                className="w-1/2 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition"
              >
                Anterior
              </button>
            )}
            <button
              type="submit"
              className={`${step === 1 ? 'w-full' : 'w-1/2'} py-3.5 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition shadow-md`}
            >
              {step === totalSteps ? 'Submeter Inscrição' : 'Seguinte'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}