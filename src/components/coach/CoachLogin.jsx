import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function CoachLogin({ onLoginSuccess, onBack }) {
  const { loginCoach } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    const result = loginCoach(email, password);
    
    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border-t-4 border-clubRed">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 mb-4 block">
          ← Voltar
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Área do Treinador</h2>
        <p className="text-gray-600 mb-6 text-sm">Insira as suas credenciais para entrar</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              placeholder="treinador@ginastica.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-clubRed focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-clubRed focus:outline-none"
              required
            />
          </div>

          {error && <p className="text-xs text-clubRed font-medium mt-1">{error}</p>}

          <button type="submit" className="w-full py-3 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl shadow-md transition">
            Entrar no Painel
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-gray-400">
          <p>Credenciais de teste:</p>
          <p>Email: <strong>treinador@ginastica.com</strong> | Pass: <strong>password123</strong></p>
        </div>
      </div>
    </div>
  );
}