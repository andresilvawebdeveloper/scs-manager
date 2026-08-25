import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function RegistrationWizard({ onBack }) {
  const { addRegistration } = useApp();
  const [step, setStep] = useState(1);
  const totalSteps = 6; // 6 passos focados estritamente no adulto (sem dados de EE separado)
  
  const [formData, setFormData] = useState({
    athleteName: '',
    birthDate: '',
    gender: 'Masculino',
    athleteCC: '',
    athleteNIF: '',
    address: '',
    city: '',
    postalCode: '',
    phone: '+351 ',
    email: '',
    paymentMode: 'Mensal',
    privacyNotified: 'Sim',
    marketingConsent: 'Sim',
    acceptedRegulations: false,
  });

  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ 
      ...formData, 
      [name]: type === 'checkbox' ? checked : value 
    });
    if (error) setError('');
  };

  const validateCurrentStep = () => {
    setError('');
    
    switch (step) {
      case 1:
        if (!formData.athleteName.trim()) {
          setError('O nome completo é obrigatório.');
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
          setError('Cartão de Cidadão inválido (deve conter 8 dígitos + 4 caracteres, ex: 12345678ZX12).');
          return false;
        }
        const nifRegex = /^\d{9}$/;
        if (!nifRegex.test(formData.athleteNIF.replace(/\s/g, ''))) {
          setError('NIF inválido (deve conter exatamente 9 dígitos).');
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
        const phoneRegex = /^\+351\s?\d{9}$/;
        if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
          setError('Telemóvel inválido (deve começar com +351 seguido de 9 dígitos).');
          return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email.trim())) {
          setError('Por favor, insira um endereço de email válido.');
          return false;
        }
        break;
      case 6:
        if (!formData.acceptedRegulations) {
          setError('Deve confirmar que leu e aceita o Regulamento Geral para submeter a inscrição.');
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

  const handleSubmitFinal = async () => {
    try {
      const payload = {
        athlete_name: formData.athleteName,
        birth_date: formData.birthDate,
        gender: formData.gender,
        athlete_cc: formData.athleteCC,
        athlete_nif: formData.athleteNIF,
        parent_name: formData.athleteName, // Para adultos, o próprio é o titular
        parent_cc: formData.athleteCC,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        postal_code: formData.postalCode,
        city: formData.city,
        assigned_class: 'Aulas de Adultos',
        adultClassesInterest: 'Sim',
        adultClassesParticipants: 'Adulto',
        adultClassesPaymentMode: formData.paymentMode,
      };

      const result = await addRegistration(payload);

      if (result && result.success) {
        setFeedback(result);
      } else {
        setError(result?.message || 'Erro ao submeter a inscrição. Tente novamente.');
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado: ' + err.message);
    }
  };

  if (feedback) {
    const isSuccess = feedback.success;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-t-4 border-amber-600 space-y-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto text-xl ${
            isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            {isSuccess ? '✓' : '✕'}
          </div>

          <h2 className="text-xl font-bold text-gray-900">
            {isSuccess ? 'Inscrição Submetida com Sucesso!' : 'Ocorreu um Erro'}
          </h2>
          
          {isSuccess ? (
            <div className="text-xs text-gray-600 space-y-2 text-left bg-gray-50 p-4 rounded-xl border border-gray-100 leading-relaxed">
              <p><strong>O que acontece agora?</strong></p>
              <p>1. O Sport Clube Sanjoanense irá analisar e revisar a sua ficha de inscrição.</p>
              <p>
                2. <strong>Enviaremos um email de notificação para:</strong> <br />
                <span className="font-semibold text-amber-700">{formData.email}</span>
              </p>
              <p>3. Assim que a inscrição for aceite, receberá nesse mesmo email o seu <strong>Código de Acesso</strong> exclusivo para entrar na Área Pessoal de Adultos.</p>
              <p>4. Caso seja necessário corrigir algum dado, a ficha será devolvida para que possa revisá-la e alterá-la.</p>
            </div>
          ) : (
            <p className="text-xs text-gray-600 bg-red-50 p-4 rounded-xl border border-red-100">
              {feedback.message || 'Não foi possível gravar a inscrição. Verifique os dados e tente novamente.'}
            </p>
          )}

          <button
            onClick={() => {
              if (isSuccess) {
                onBack();
              } else {
                setFeedback(null);
                setStep(1);
              }
            }}
            className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-sm transition shadow"
          >
            {isSuccess ? 'Voltar ao Início' : 'Tentar Novamente'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-6 md:p-8 border-t-4 border-amber-600">
        
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 font-medium">
            ← Voltar
          </button>
          <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-700 rounded-full">
            Passo {step} de {totalSteps}
          </span>
        </div>

        <form onSubmit={handleNext} className="space-y-6">
          
          {step === 1 && (
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">
                Qual é o seu nome completo?
              </label>
              <input
                type="text"
                name="athleteName"
                value={formData.athleteName}
                onChange={handleChange}
                className="w-full p-3.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none"
                placeholder="Ex: Carlos Silva"
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-base font-bold text-gray-900 mb-1">
                  Qual é a sua data de nascimento?
                </label>
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  className="w-full p-3.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sexo</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full p-3.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none bg-white"
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">
                Documentos de Identificação
              </label>
              
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Cartão de Cidadão</label>
                <input
                  type="text"
                  name="athleteCC"
                  value={formData.athleteCC}
                  onChange={handleChange}
                  placeholder="Ex: 12345678ZX12"
                  className="w-full p-3 border border-gray-300 rounded-xl text-sm uppercase focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  autoFocus
                />
                <span className="text-[11px] text-gray-400 block mt-0.5">Formato: 8 dígitos + 4 caracteres</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">NIF (Número de Identificação Fiscal)</label>
                <input
                  type="text"
                  name="athleteNIF"
                  value={formData.athleteNIF}
                  onChange={handleChange}
                  placeholder="Ex: 123456789"
                  maxLength={9}
                  className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
                <span className="text-[11px] text-gray-400 block mt-0.5">Formato: 9 dígitos numéricos</span>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <label className="block text-base font-bold text-gray-900">
                Qual é a sua morada e código postal?
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Morada (Ex: Rua Principal, nº 100)"
                className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Localidade"
                  className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  placeholder="0000-000"
                  className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="block text-base font-bold text-gray-900 mb-1">
                  Qual é o seu contacto telefónico?
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+351 912345678"
                  className="w-full p-3.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  autoFocus
                />
                <span className="text-[11px] text-gray-400 block mt-1">Deve começar com +351</span>
              </div>

              <div>
                <label className="block text-base font-bold text-gray-900 mb-1">
                  Qual é o seu Email?
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="exemplo@dominio.com"
                  className="w-full p-3.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  required
                />
                <span className="text-[11px] text-gray-400 block mt-1">Para onde enviaremos o estado da inscrição e o código de acesso.</span>
              </div>

              <div>
                <label className="block text-base font-bold text-gray-900 mb-1">
                  Modalidade de Pagamento Pretendida:
                </label>
                <select
                  name="paymentMode"
                  value={formData.paymentMode}
                  onChange={handleChange}
                  className="w-full p-3.5 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                >
                  <option value="Mensal">Opção Mensal — 15€ / mês</option>
                  <option value="Avulso">Aulas a Avulso — 5€ / aula</option>
                </select>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Termos, Privacidade e Regulamento</h3>
              
              <div className="max-h-40 overflow-y-auto p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] text-gray-600 leading-relaxed text-justify">
                A Associação “Sport Clube Sanjoanense”, pessoa coletiva nº 501599100, com sede na Rua Dep. Pedro Botelho Neves, é a responsável pelo tratamento dos seus dados pessoais. Os dados recolhidos no presente formulário serão utilizados para efeitos de inscrição nas aulas de adultos, seguros obrigatórios e comunicações do Clube. Para exercer os seus direitos, contacte geral@scsanjoanense.pt.
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center space-y-2">
                <span className="text-xs text-gray-500 block">Documento oficial disponível:</span>
                <a 
                  href="/Regulamentos gerais 26-27.pdf" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-block px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl text-xs transition shadow-sm"
                >
                  📄 Abrir Regulamento Geral (PDF)
                </a>
              </div>

              <div className="pt-3">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="acceptedRegulations" 
                    checked={formData.acceptedRegulations} 
                    onChange={handleChange} 
                    className="mt-0.5 h-4 w-4 text-amber-600 rounded border-gray-300 focus:ring-amber-600"
                    required
                  />
                  <span className="text-xs text-gray-800 font-medium leading-tight">
                    Declaro que li, compreendi e aceito integralmente os termos da política de privacidade e o Regulamento Geral do Sport Clube Sanjoanense para participação nas Aulas de Adultos.
                  </span>
                </label>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-600 font-semibold mt-2">{error}</p>
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
              className={`${step === 1 ? 'w-full' : 'w-1/2'} py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-sm transition shadow-md`}
            >
              {step === totalSteps ? 'Submeter Inscrição' : 'Seguinte'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}