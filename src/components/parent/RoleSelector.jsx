import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function RoleSelector({ onSelectRole, onNewRegistration, onLoginWithCode, onAdultRegistration, onAdultLoginWithCode }) {
  const { loginParentByCode, loginAdultByCode, sendSmsVerification, verifySmsCode } = useApp();

  // Estados de navegação e controlo de passos
  const [viewMode, setViewMode] = useState('main'); // 'main', 'parent_options', 'adult_options'
  const [step, setStep] = useState('code'); // 'code' (1º Fator) ou 'sms' (2º Fator)
  const [activeUserType, setActiveUserType] = useState(null); // 'parent' ou 'adult'

  // Estados dos formulários
  const [code, setCode] = useState('');
  const [adultCode, setAdultCode] = useState('');
  const [smsCode, setSmsCode] = useState('');

  // Estados de sessão temporária
  const [currentRegistration, setCurrentRegistration] = useState(null);
  const [currentPhoneNumber, setCurrentPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Iniciar login do Encarregado de Educação (Passo 1: Código + Envio SMS)
  const handleInitiateParentLogin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError('');

    const result = loginParentByCode(code.trim());
    if (!result.success) {
      setError(result.message);
      return;
    }

    const reg = result.registration;
    const phone = reg?.phone || reg?.telemovel;

    if (!phone) {
      setError("Não existe número de telemóvel associado a esta inscrição.");
      return;
    }

    setLoading(true);
    const smsResult = await sendSmsVerification(phone);
    setLoading(false);

    if (smsResult.success) {
      setCurrentRegistration(reg);
      setCurrentPhoneNumber(phone);
      setActiveUserType('parent');
      setStep('sms');
    } else {
      setError(smsResult.message);
    }
  };

  // Iniciar login do Aluno Adulto (Passo 1: Código + Envio SMS)
  const handleInitiateAdultLogin = async (e) => {
    e.preventDefault();
    if (!adultCode.trim()) return;
    setError('');

    const result = loginAdultByCode ? loginAdultByCode(adultCode.trim()) : { success: false, message: "Função de login não configurada." };
    if (!result.success) {
      setError(result.message);
      return;
    }

    const reg = result.registration;
    const phone = reg?.phone || reg?.telemovel;

    if (!phone) {
      setError("Não existe número de telemóvel associado a este registo.");
      return;
    }

    setLoading(true);
    const smsResult = await sendSmsVerification(phone);
    setLoading(false);

    if (smsResult.success) {
      setCurrentRegistration(reg);
      setCurrentPhoneNumber(phone);
      setActiveUserType('adult');
      setStep('sms');
    } else {
      setError(smsResult.message);
    }
  };

  // Validar o código SMS inserido (Passo 2: Confirmação do 2FA)
  const handleVerifySmsSubmit = async (e) => {
    e.preventDefault();
    if (!smsCode.trim()) return;
    setError('');
    setLoading(true);

    const verifyResult = await verifySmsCode(currentPhoneNumber, smsCode.trim());
    setLoading(false);

    if (verifyResult.success) {
      if (activeUserType === 'parent') {
        onLoginWithCode(currentRegistration);
      } else if (activeUserType === 'adult' && onAdultLoginWithCode) {
        onAdultLoginWithCode(currentRegistration);
      }
    } else {
      setError(verifyResult.message || "Código SMS inválido. Verifique e tente novamente.");
    }
  };

  const resetState = () => {
    setStep('code');
    setCode('');
    setAdultCode('');
    setSmsCode('');
    setError('');
    setCurrentRegistration(null);
    setCurrentPhoneNumber('');
    setActiveUserType(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-t-4 border-clubRed">
        
        {/* Logótipo do Clube */}
        <div className="mx-auto w-28 h-28 mb-6 flex items-center justify-center p-2">
          <img 
            src="/logo.png" 
            alt="Símbolo do Clube de Ginástica" 
            className="w-full h-full object-contain drop-shadow-md"
          />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">SCS Manager</h1>

        {/* VISTA 1: Escolha Principal */}
        {viewMode === 'main' && (
          <>
            <p className="text-gray-600 mb-8 text-sm">Selecione o seu perfil para continuar</p>

            <div className="space-y-4">
              <button
                type="button"
                onClick={() => { setViewMode('parent_options'); resetState(); }}
                className="w-full py-4 px-6 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg transition duration-200 flex items-center justify-center space-x-2"
              >
                <span>Sou Encarregado de Educação</span>
              </button>

              <button
                type="button"
                onClick={() => { setViewMode('adult_options'); resetState(); }}
                className="w-full py-4 px-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl shadow-lg transition duration-200 flex items-center justify-center space-x-2"
              >
                <span>Quero participar na Aula de Adultos</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectRole('coach')}
                className="w-full py-4 px-6 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl shadow-lg transition duration-200 flex items-center justify-center space-x-2"
              >
                <span>Sou Treinador</span>
              </button>
            </div>
          </>
        )}

        {/* VISTA 2: Opções do Encarregado de Educação */}
        {viewMode === 'parent_options' && (
          <div className="text-left space-y-4">
            <button 
              type="button"
              onClick={() => { setViewMode('main'); resetState(); }} 
              className="text-sm text-gray-500 hover:text-gray-800 mb-2 block font-medium transition"
            >
              ← Voltar ao início
            </button>

            {step === 'code' ? (
              <>
                <p className="text-gray-600 mb-4 text-sm text-center">O que pretende fazer?</p>

                <button
                  type="button"
                  onClick={onNewRegistration}
                  className="w-full py-3 px-6 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl shadow-md transition text-center"
                >
                  Fazer Nova Inscrição (Atleta)
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink mx-4 text-gray-400 text-xs">OU JÁ TEM INSCRIÇÃO ACEITE?</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <form onSubmit={handleInitiateParentLogin} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Insira o seu Código de Acesso:</label>
                    <input
                      type="text"
                      placeholder="Ex: SCS-ABC123"
                      value={code}
                      onChange={(e) => { setCode(e.target.value); setError(''); }}
                      className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-clubRed focus:outline-none uppercase"
                      required
                    />
                  </div>

                  {error && (
                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
                      <p className="text-xs text-rose-700 font-semibold">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow-md text-sm transition text-center"
                  >
                    {loading ? "A enviar SMS..." : "Continuar"}
                  </button>
                </form>
              </>
            ) : (
              /* Ecrã do 2º Fator (SMS) */
              <form onSubmit={handleVerifySmsSubmit} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center">
                  <p className="text-xs text-blue-900 font-medium mb-1">
                    Enviámos um SMS com o código de verificação para:
                  </p>
                  <p className="text-sm font-bold text-blue-950">
                    {currentPhoneNumber}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Código SMS (6 dígitos):</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={smsCode}
                    onChange={(e) => { setSmsCode(e.target.value); setError(''); }}
                    className="w-full p-3 text-center tracking-widest font-mono text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-clubRed focus:outline-none"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
                    <p className="text-xs text-rose-700 font-semibold">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-clubRed hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow-md text-sm transition text-center"
                >
                  {loading ? "A verificar..." : "Entrar na Área Pessoal"}
                </button>

                <button
                  type="button"
                  onClick={resetState}
                  className="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
                >
                  Voltar / Usar outro código
                </button>
              </form>
            )}
          </div>
        )}

        {/* VISTA 3: Opções de Aluno da Aula de Adultos */}
        {viewMode === 'adult_options' && (
          <div className="text-left space-y-4">
            <button 
              type="button"
              onClick={() => { setViewMode('main'); resetState(); }} 
              className="text-sm text-gray-500 hover:text-gray-800 mb-2 block font-medium transition"
            >
              ← Voltar ao início
            </button>

            {step === 'code' ? (
              <>
                <p className="text-gray-600 mb-4 text-sm text-center">Aulas de Adultos - Gestão de Alunos</p>

                <button
                  type="button"
                  onClick={onAdultRegistration}
                  className="w-full py-3 px-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl shadow-md transition text-center"
                >
                  Fazer Inscrição nas Aulas de Adultos
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink mx-4 text-gray-400 text-xs">JÁ ESTÁ INSCRITO?</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <form onSubmit={handleInitiateAdultLogin} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Insira o seu Código de Acesso:</label>
                    <input
                      type="text"
                      placeholder="Ex: SCS-ABC123"
                      value={adultCode}
                      onChange={(e) => { setAdultCode(e.target.value); setError(''); }}
                      className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none uppercase"
                      required
                    />
                  </div>

                  {error && (
                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
                      <p className="text-xs text-rose-700 font-semibold">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow-md text-sm transition text-center"
                  >
                    {loading ? "A enviar SMS..." : "Continuar"}
                  </button>
                </form>
              </>
            ) : (
              /* Ecrã do 2º Fator (SMS) para Adultos */
              <form onSubmit={handleVerifySmsSubmit} className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
                  <p className="text-xs text-amber-900 font-medium mb-1">
                    Enviámos um SMS com o código de verificação para:
                  </p>
                  <p className="text-sm font-bold text-amber-950">
                    {currentPhoneNumber}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Código SMS (6 dígitos):</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={smsCode}
                    onChange={(e) => { setSmsCode(e.target.value); setError(''); }}
                    className="w-full p-3 text-center tracking-widest font-mono text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
                    <p className="text-xs text-rose-700 font-semibold">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow-md text-sm transition text-center"
                >
                  {loading ? "A verificar..." : "Entrar na Área de Adultos"}
                </button>

                <button
                  type="button"
                  onClick={resetState}
                  className="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
                >
                  Voltar / Usar outro código
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}