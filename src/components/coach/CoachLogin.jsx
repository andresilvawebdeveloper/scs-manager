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
        throw new Error(authError.message === 'Invalid login credentials' 
          ? 'Email ou password incorretos.' 
          : authError.message);
      }

      if (data.user) {
        onLoginSuccess();
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
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 mb-4 block">
          ← Voltar
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Área do Treinador</h2>
        <p className="text-gray-600 mb-6 text-sm">Insira as suas credenciais do Supabase para entrar</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              placeholder="o-seu-email@dominio.com"
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

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl shadow-md transition disabled:opacity-50"
          >
            {loading ? 'A autenticar...' : 'Entrar no Painel'}
          </button>
        </form>
      </div>
    </div>
  );
}