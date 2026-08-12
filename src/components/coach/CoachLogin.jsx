import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';

export default function CoachLogin({ onLoginSuccess, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        throw new Error(
          authError.message === 'Invalid login credentials'
            ? 'Email ou password incorretos.'
            : authError.message
        );
      }

      if (data && data.user) {
        // Garantir pequeno atraso assíncrono para que o token fique guardado antes da mudança de vista
        setTimeout(() => {
          if (typeof onLoginSuccess === 'function') {
            onLoginSuccess();
          }
        }, 100);
      }
    } catch (err) {
      setError(err.message || 'Erro ao efetuar login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border-t-4 border-clubRed">
        
        {/* Botão Voltar */}
        {onBack && (
          <button 
            type="button" 
            onClick={onBack} 
            className="text-sm text-gray-500 hover:text-gray-800 mb-4 block font-medium transition"
          >
            ← Voltar
          </button>
        )}

        {/* Logo do Clube e Título */}
        <div className="text-center mb-6 space-y-2">
          <div className="w-16 h-16 mx-auto bg-white rounded-2xl p-1 shadow-sm border border-gray-100 flex items-center justify-center">
            <img 
              src="/logo_clube.png" 
              alt="Logo do Clube" 
              className="w-full h-full object-contain"
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Área do Treinador</h2>
          <p className="text-gray-600 text-sm">Insira as suas credenciais para gerir o painel</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              placeholder="o-seu-email@dominio.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-clubRed focus:outline-none text-sm"
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
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-clubRed focus:outline-none text-sm"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-xs text-clubRed font-semibold">{error}</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl shadow-md transition disabled:opacity-50 text-sm"
          >
            {loading ? 'A autenticar...' : 'Entrar no Painel'}
          </button>
        </form>
      </div>
    </div>
  );
}