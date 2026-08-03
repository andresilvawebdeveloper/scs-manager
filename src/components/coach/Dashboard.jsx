import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function Dashboard({ onLogout }) {
  const { registrations, updateRegistrationStatus, attendances, toggleAttendance } = useApp();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'accepted', 'attendance'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const pendingList = registrations.filter((r) => r.status === 'pending');
  const acceptedList = registrations.filter((r) => r.status === 'accepted');

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      
      {/* Header Moderno com identidade visual do clube */}
      <header className="bg-gradient-to-r from-clubRed to-red-700 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 shadow">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Painel do Treinador</h1>
              <p className="text-xs text-red-100 opacity-90">Gestão e Controlo do Clube</p>
            </div>
          </div>
          <button 
            onClick={onLogout} 
            className="text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl font-semibold transition backdrop-blur-sm"
          >
            Terminar Sessão
          </button>
        </div>
      </header>

      {/* Estatísticas Rápidas / Resumo */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
              {pendingList.length}
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Por Validar</p>
              <h3 className="text-sm font-bold text-gray-900">Pendentes</h3>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center font-bold text-sm">
              {acceptedList.length}
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Ativos no Clube</p>
              <h3 className="text-sm font-bold text-gray-900">Atletas Aceites</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Modernas */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="flex space-x-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
              activeTab === 'pending' 
                ? 'bg-clubRed text-white shadow-md shadow-red-500/20' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Pendentes ({pendingList.length})
          </button>
          <button
            onClick={() => setActiveTab('accepted')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
              activeTab === 'accepted' 
                ? 'bg-clubRed text-white shadow-md shadow-red-500/20' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Atletas Aceites ({acceptedList.length})
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
              activeTab === 'attendance' 
                ? 'bg-clubRed text-white shadow-md shadow-red-500/20' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Presenças
          </button>
        </div>
      </div>

      {/* Content Area */}
      <main className="max-w-4xl mx-auto px-4 mt-6">
        
        {/* SECÇÃO: PENDENTES */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-sm">Fichas de Inscrição Pendentes</h2>
            </div>

            {pendingList.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center space-y-2">
                <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto text-lg">✓</div>
                <p className="text-sm font-semibold text-gray-700">Tudo em dia!</p>
                <p className="text-xs text-gray-400">Não existem inscrições pendentes para validação de momento.</p>
              </div>
            ) : (
              pendingList.map((reg) => (
                <div key={reg.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4 transition hover:shadow-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-extrabold px-2.5 py-1 bg-red-50 text-clubRed rounded-full uppercase tracking-wider">
                        Novo Atleta
                      </span>
                      <h3 className="font-bold text-gray-900 text-base mt-2">{reg.athleteName}</h3>
                      <p className="text-xs text-gray-400">Nascimento: {reg.birthDate}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div>
                      <span className="text-gray-400 block mb-0.5">Encarregado de Educação</span>
                      <strong className="text-gray-800">{reg.parentName}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">Contactos</span>
                      <strong className="text-gray-800">{reg.phone}</strong><br />
                      <span className="text-gray-500">{reg.email}</span>
                    </div>
                    <div className="md:col-span-2 pt-2 border-t border-gray-200/60">
                      <span className="text-gray-400 block mb-0.5">Merchandising Escolhido</span>
                      <span className="inline-block bg-white px-2.5 py-1 rounded-lg border border-gray-200 font-semibold text-gray-700">
                        {reg.clothingType} — Tamanho: {reg.clothingSize}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-1">
                    <button
                      onClick={() => updateRegistrationStatus(reg.id, 'accepted')}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition flex items-center justify-center space-x-1.5"
                    >
                      <span>Aceitar Inscrição</span>
                    </button>
                    <button
                      onClick={() => updateRegistrationStatus(reg.id, 'rejected')}
                      className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-600/20 transition flex items-center justify-center space-x-1.5"
                    >
                      <span>Rejeitar & Eliminar</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SECÇÃO: ATLETAS ACEITES */}
        {activeTab === 'accepted' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 text-sm">Atletas Ativos no Plantel</h2>
            {acceptedList.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center space-y-2">
                <p className="text-sm font-semibold text-gray-700">Nenhum atleta ativo</p>
                <p className="text-xs text-gray-400">Aceite inscrições no separador de pendentes para preencher o plantel.</p>
              </div>
            ) : (
              acceptedList.map((reg) => (
                <div key={reg.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-center transition hover:shadow-md">
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 text-sm">{reg.athleteName}</h3>
                    <p className="text-xs text-gray-500">
                      EE: <span className="text-gray-700 font-medium">{reg.parentName}</span> | Roupa: <span className="text-gray-700 font-medium">{reg.clothingType} ({reg.clothingSize})</span>
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">Código Acesso: {reg.accessCode}</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200/50">
                    Ativo
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* SECÇÃO: PRESENÇAS */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-200 gap-3">
              <div>
                <h3 className="text-xs font-bold text-gray-800">Selecione o Dia do Treino</h3>
                <p className="text-[11px] text-gray-400">O registo grava automaticamente por data</p>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-auto p-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-clubRed focus:outline-none bg-gray-50"
              />
            </div>

            <h2 className="font-bold text-gray-800 text-sm">Marcação de Presenças</h2>
            {acceptedList.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center space-y-2">
                <p className="text-sm font-semibold text-gray-700">Sem atletas disponíveis</p>
                <p className="text-xs text-gray-400">Apenas atletas com inscrição aceite aparecem no mapa de presenças.</p>
              </div>
            ) : (
              acceptedList.map((reg) => {
                const isPresent = attendances[`${reg.id}_${selectedDate}`] || false;
                return (
                  <div key={reg.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-center transition hover:shadow-md">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{reg.athleteName}</h3>
                      <p className="text-xs text-gray-400">ID: {reg.accessCode}</p>
                    </div>
                    <button
                      onClick={() => toggleAttendance(reg.id, selectedDate)}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm ${
                        isPresent 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' 
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      }`}
                    >
                      {isPresent ? 'Presente ✓' : 'Falta'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

      </main>
    </div>
  );
}