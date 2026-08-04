import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function RoleSelector({ onSelectRole, onNewRegistration, onLoginWithCode }) {
  const { loginParentByCode } = useApp();
  const [viewMode, setViewMode] = useState('main'); // 'main' ou 'parent_options'
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    const result = loginParentByCode(code.trim());
    if (result.success) {
      onLoginWithCode(result.registration);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-t-4 border-clubRed">
        
        {/* Logótipo do Clube */}
        <div className="mx-auto w-24 h-24 mb-6 flex items-center justify-center p-2">
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
                onClick={() => setViewMode('parent_options')}
                className="w-full py-4 px-6 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg transition duration-200 flex items-center justify-center space-x-2"
              >
                <span>Sou Encarregado de Educação</span>
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
              onClick={() => { setViewMode('main'); setError(''); }} 
              className="text-sm text-gray-500 hover:text-gray-800 mb-2 block font-medium transition"
            >
              ← Voltar ao início
            </button>

            <p className="text-gray-600 mb-4 text-sm text-center">O que pretende fazer?</p>

            <button
              type="button"
              onClick={onNewRegistration}
              className="w-full py-3 px-6 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl shadow-md transition text-center"
            >
              Fazer Nova Inscrição
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs">OU JÁ TEM INSCRIÇÃO ACEITE?</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-3">
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
                <p className="text-xs text-clubRed font-semibold mt-1">{error}</p>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl shadow-md text-sm transition text-center"
              >
                Entrar na Área Pessoal
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}