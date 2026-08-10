import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function RegistrationWizard({ onBack }) {
  const { addRegistration } = useApp();
  const [step, setStep] = useState(1);
  const totalSteps = 11;
  
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
    email: '',
    memberNumber: '',
    memberType: 'Atleta',
    // Predefinição para "Não pretendo / Não preciso"
    tracksuitSize: 'Não pretendo / Não preciso',
    officialTshirtSize: 'Não pretendo / Não preciso',
    redTshirtSize: 'Não pretendo / Não preciso',
    yellowTshirtSize: 'Não pretendo / Não preciso',
    // Dados para as Aulas de Adultos
    adultClassesInterest: 'Não',
    adultClassesParticipants: 'Pai',
    adultClassesPaymentMode: 'Avulso',
    privacyNotified: 'Sim',
    marketingConsent: 'Sim',
    acceptedRegulations: false,
  });

  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');

  // Lista de tamanhos com a nova opção "Não pretendo / Não preciso"
  const sizeOptions = [
    'Não pretendo / Não preciso',
    '7-8',
    '9-10',
    '11-12',
    '13-14',
    'XS',
    'S',
    'M',
    'L',
    'XL'
  ];

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
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email.trim())) {
          setError('Por favor, insira um endereço de email válido.');
          return false;
        }
        break;
      case 7:
        if (!formData.memberNumber.trim()) {
          setError('O número de sócio é obrigatório.');
          return false;
        }
        break;
      case 9:
        if (formData.adultClassesInterest === 'Sim') {
          if (!formData.adultClassesParticipants || !formData.adultClassesPaymentMode) {
            setError('Por favor, selecione quem irá participar e a modalidade de pagamento.');
            return false;
          }
        }
        break;
      case 11:
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
    const generatedAccessCode = Math.floor(100000 + Math.random() * 900000).toString();

    const result = await addRegistration({
      ...formData,
      status: 'pending',
      access_code: generatedAccessCode,
    });

    setFeedback(result);
  };

  if (feedback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-t-4 border-clubRed space-y-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl">
            ✓
          </div>
          <h2 className="text-xl font-bold text-gray-900">Inscrição Submetida com Sucesso!</h2>
          
          <div className="text-xs text-gray-600 space-y-2 text-left bg-gray-50 p-4 rounded-xl border border-gray-100 leading-relaxed">
            <p><strong>O que acontece agora?</strong></p>
            <p>1. O Sport Clube Sanjoanense irá analisar e revisar a ficha de inscrição do atleta.</p>
            <p>
              2. <strong>Enviaremos um email de notificação para:</strong> <br />
              <span className="font-semibold text-clubRed">{formData.email}</span>
            </p>
            <p>3. Assim que a inscrição for aceite, receberá nesse mesmo email o seu <strong>Código de Acesso</strong> exclusivo para entrar na Área Pessoal.</p>
            <p>4. Caso seja necessário corrigir algum dado, a ficha será devolvida para que possa revisá-la e alterá-la.</p>
          </div>

          <button
            onClick={() => {
              if (feedback.success) {
                onBack();
              } else {
                setFeedback(null);
                setStep(1);
              }
            }}
            className="w-full py-3.5 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition shadow"
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
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 font-medium">
            ← Voltar
          </button>
          <span className="text-xs font-bold px-3 py-1 bg-red-50 text-clubRed rounded-full">
            Passo {step} de {totalSteps}
          </span>
        </div>

        <form onSubmit={handleNext} className="space-y-6">
          
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

          {step === 6 && (
            <div className="space-y-4">
              <div>
                <label className="block text-base font-bold text-gray-900 mb-1">
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
                <span className="text-[11px] text-gray-400 block mt-1">Deve começar com +351</span>
              </div>

              <div>
                <label className="block text-base font-bold text-gray-900 mb-1">
                  Qual é o Email do Encarregado de Educação?
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="exemplo@dominio.com"
                  className="w-full p-3.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none"
                  required
                />
                <span className="text-[11px] text-gray-400 block mt-1">Para onde enviaremos o estado da inscrição e o código de acesso.</span>
              </div>
            </div>
          )}

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

          {/* PASSO 8: SELEÇÃO DE TAMANHOS PARA VESTUÁRIO */}
          {step === 8 && (
            <div className="space-y-4">
              <div>
                <label className="block text-base font-bold text-gray-900 mb-1">
                  Tamanhos do Equipamento e Vestuário
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Selecione o tamanho pretendido para cada um dos itens abaixo:
                </p>
              </div>

              {/* Fato de Treino */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Fato de Treino (Calça e Casaco)
                </label>
                <select
                  name="tracksuitSize"
                  value={formData.tracksuitSize}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-clubRed focus:outline-none"
                >
                  {sizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'Não pretendo / Não preciso' ? option : `Tamanho ${option}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* T-shirt Oficial */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  T-shirt Oficial
                </label>
                <select
                  name="officialTshirtSize"
                  value={formData.officialTshirtSize}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-clubRed focus:outline-none"
                >
                  {sizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'Não pretendo / Não preciso' ? option : `Tamanho ${option}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* T-shirt Vermelha (Treino) */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  T-shirt Vermelha (Treino)
                </label>
                <select
                  name="redTshirtSize"
                  value={formData.redTshirtSize}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-clubRed focus:outline-none"
                >
                  {sizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'Não pretendo / Não preciso' ? option : `Tamanho ${option}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* T-shirt Amarela (Treino) */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  T-shirt Amarela (Treino)
                </label>
                <select
                  name="yellowTshirtSize"
                  value={formData.yellowTshirtSize}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-clubRed focus:outline-none"
                >
                  {sizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'Não pretendo / Não preciso' ? option : `Tamanho ${option}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* PASSO 9: AULAS DE ADULTOS PARA ENCARREGADOS DE EDUCAÇÃO */}
          {step === 9 && (
            <div className="space-y-4">
              <div>
                <label className="block text-base font-bold text-gray-900 mb-1">
                  Aulas de Adultos para Encarregados
                </label>
                <p className="text-xs text-gray-600 leading-relaxed">
                  O clube disponibiliza aulas para adultos às <strong>segundas-feiras, das 18h15 às 19h00</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <span className="block text-xs font-bold text-gray-800">
                  Tem interesse em participar nestas aulas?
                </span>
                <div className="flex space-x-6">
                  <label className="flex items-center space-x-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="adultClassesInterest"
                      value="Sim"
                      checked={formData.adultClassesInterest === 'Sim'}
                      onChange={handleChange}
                      className="text-clubRed focus:ring-clubRed"
                    />
                    <span>Sim</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="adultClassesInterest"
                      value="Não"
                      checked={formData.adultClassesInterest === 'Não'}
                      onChange={handleChange}
                      className="text-clubRed focus:ring-clubRed"
                    />
                    <span>Não</span>
                  </label>
                </div>
              </div>

              {formData.adultClassesInterest === 'Sim' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      Quem pretende participar?
                    </label>
                    <select
                      name="adultClassesParticipants"
                      value={formData.adultClassesParticipants}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none"
                    >
                      <option value="Pai">Apenas o Pai</option>
                      <option value="Mãe">Apenas a Mãe</option>
                      <option value="Ambos">Ambos (Pai e Mãe)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      Modalidade de Pagamento Pretendida:
                    </label>
                    <select
                      name="adultClassesPaymentMode"
                      value={formData.adultClassesPaymentMode}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none"
                    >
                      <option value="Avulso">Aulas a Avulso — 5€ / aula</option>
                      <option value="Mensal">Opção Mensal — 15€ / mês</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed space-y-1">
                <p className="font-bold">⚠️ Nota Importante sobre as Aulas de Adultos:</p>
                <p>
                  Cada aula possui um <strong>limite máximo de inscrições</strong>. É da inteira responsabilidade de cada encarregado de educação efetuar a sua inscrição prévia para garantir a presença no treino pretendido.
                </p>
              </div>
            </div>
          )}

          {step === 10 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900">a) Notificação de Privacidade</h3>
              
              <div className="max-h-48 overflow-y-auto p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] text-gray-600 leading-relaxed text-justify">
                A Associação “Sport Clube Sanjoanense”, pessoa coletiva nº 501599100, com sede na Rua Dep. Pedro Botelho Neves, é a responsável pelo tratamento dos seus dados pessoais. Os dados recolhidos no presente formulário serão utilizados para efeitos de inscrição em competições desportivas, seguros obrigatórios, captação e divulgação de imagens e vídeos nos canais oficiais do Clube, e convocações. Para exercer os seus direitos, contacte geral@scsanjoanense.pt.
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <p className="text-xs font-semibold text-gray-800 mb-1">Fui notificado da política de privacidade</p>
                  <div className="flex space-x-6">
                    <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                      <input 
                        type="radio" 
                        name="privacyNotified" 
                        value="Sim" 
                        checked={formData.privacyNotified === 'Sim'} 
                        onChange={handleChange} 
                        className="text-clubRed focus:ring-clubRed"
                      />
                      <span>Sim</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                      <input 
                        type="radio" 
                        name="privacyNotified" 
                        value="Não" 
                        checked={formData.privacyNotified === 'Não'} 
                        onChange={handleChange} 
                        className="text-clubRed focus:ring-clubRed"
                      />
                      <span>Não</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-800 mb-1">
                    “Autorizo que o Clube possa processar os meus dados para efeitos de envio de comunicações sobre todas as suas atividades, tanto por meios eletrónicos como telefónicos”.
                  </p>
                  <div className="flex space-x-6">
                    <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                      <input 
                        type="radio" 
                        name="marketingConsent" 
                        value="Sim" 
                        checked={formData.marketingConsent === 'Sim'} 
                        onChange={handleChange} 
                        className="text-clubRed focus:ring-clubRed"
                      />
                      <span>Sim</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                      <input 
                        type="radio" 
                        name="marketingConsent" 
                        value="Não" 
                        checked={formData.marketingConsent === 'Não'} 
                        onChange={handleChange} 
                        className="text-clubRed focus:ring-clubRed"
                      />
                      <span>Não</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 11 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Regulamento Geral do Clube</h3>
              
              <p className="text-xs text-gray-600">
                Para concluir a inscrição, deve consultar e aceitar o regulamento geral em vigor no clube.
              </p>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center space-y-2">
                <span className="text-xs text-gray-500 block">Documento oficial disponível:</span>
                <a 
                  href="/Regulamento geral.pdf" 
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
                    className="mt-0.5 h-4 w-4 text-clubRed rounded border-gray-300 focus:ring-clubRed"
                    required
                  />
                  <span className="text-xs text-gray-800 font-medium leading-tight">
                    Declaro que li, compreendi e aceito integralmente os termos da política de privacidade e o Regulamento Geral do Sport Clube Sanjoanense.
                  </span>
                </label>
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