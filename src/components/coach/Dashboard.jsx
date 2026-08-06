import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function Dashboard({ onLogout }) {
  const { 
    registrations, 
    updateRegistrationStatus, 
    removeAcceptedAthlete, 
    attendances, 
    toggleAttendance,
    events,
    addEvent,
    deleteEvent,
    eventAttendances,
    toggleEventAttendance 
  } = useApp();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'accepted', 'attendance', 'events'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClassFilter, setSelectedClassFilter] = useState('Formação infantil');
  const [selectedClasses, setSelectedClasses] = useState({});

  // Formulário para novo evento
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventClass, setNewEventClass] = useState('Formação geral');

  const pendingList = registrations.filter((r) => r.status === 'pending');
  const acceptedList = registrations.filter((r) => r.status === 'accepted');

  const handleClassChange = (id, className) => {
    setSelectedClasses({ ...selectedClasses, [id]: className });
  };

  const handleAcceptWithClass = (regId) => {
    const assignedClass = selectedClasses[regId] || 'Formação geral';
    updateRegistrationStatus(regId, 'accepted', '', assignedClass);
  };

  const handleCreateEvent = (e) => {
    e.preventDefault();
    if (!newEventName.trim() || !newEventDate) return;
    addEvent({
      name: newEventName.trim(),
      date: newEventDate,
      targetClass: newEventClass,
    });
    setNewEventName('');
    setNewEventDate('');
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      
      {/* Header Moderno */}
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
            className="text-xs bg-white/15 hover:bg-white/25 text-white border border-white/20 px-4 py-2 rounded-xl font-semibold transition"
          >
            Terminar Sessão
          </button>
        </div>
      </header>

      {/* Estatísticas Rápidas */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              {pendingList.length}
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-medium">Por Validar</p>
              <h3 className="text-xs font-bold text-gray-900">Pendentes</h3>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              {acceptedList.length}
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-medium">Ativos</p>
              <h3 className="text-xs font-bold text-gray-900">Atletas</h3>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              {events.length}
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-medium">Criados</p>
              <h3 className="text-xs font-bold text-gray-900">Eventos</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Modernas */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-4 gap-1 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all ${
              activeTab === 'pending' ? 'bg-clubRed text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Pendentes ({pendingList.length})
          </button>
          <button
            onClick={() => setActiveTab('accepted')}
            className={`py-2.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all ${
              activeTab === 'accepted' ? 'bg-clubRed text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Atletas ({acceptedList.length})
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`py-2.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all ${
              activeTab === 'attendance' ? 'bg-clubRed text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Presenças
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`py-2.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all ${
              activeTab === 'events' ? 'bg-clubRed text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Eventos
          </button>
        </div>
      </div>

      {/* Content Area */}
      <main className="max-w-4xl mx-auto px-4 mt-6">
        
        {/* SECÇÃO: PENDENTES */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 text-sm">Fichas de Inscrição Pendentes</h2>
            {pendingList.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center space-y-2">
                <p className="text-sm font-semibold text-gray-700">Tudo em dia!</p>
                <p className="text-xs text-gray-400">Não existem inscrições pendentes de momento.</p>
              </div>
            ) : (
              pendingList.map((reg) => (
                <div key={reg.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{reg.athleteName}</h3>
                    <p className="text-xs text-gray-500">Nascimento: {reg.birthDate} | Sexo: {reg.gender} | CC: {reg.athleteCC}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div>
                      <span className="text-gray-400 block mb-0.5">Encarregado de Educação</span>
                      <strong className="text-gray-800">{reg.parentName}</strong> (CC: {reg.parentCC})
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">Telemóvel</span>
                      <strong className="text-gray-800">{reg.phone}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">Morada</span>
                      <span className="text-gray-700">{reg.address}, {reg.postalCode} {reg.city}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">Sócio nº {reg.memberNumber} ({reg.memberType})</span>
                    </div>
                  </div>

                  <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 space-y-2">
                    <label className="block text-xs font-bold text-gray-700">Atribuir Turma ao Atleta:</label>
                    <select
                      value={selectedClasses[reg.id] || 'Formação geral'}
                      onChange={(e) => handleClassChange(reg.id, e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none"
                    >
                      <option value="Formação infantil">Formação infantil</option>
                      <option value="Formação geral">Formação geral</option>
                      <option value="Formação avançada">Formação avançada</option>
                      <option value="Representação">Representação</option>
                    </select>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleAcceptWithClass(reg.id)}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                    >
                      Aceitar e Atribuir Turma
                    </button>
                    <button
                      onClick={() => updateRegistrationStatus(reg.id, 'rejected')}
                      className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm"
                    >
                      Rejeitar & Eliminar
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
              </div>
            ) : (
              acceptedList.map((reg) => (
                <div key={reg.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-center">
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 text-sm">{reg.athleteName}</h3>
                    <p className="text-xs text-gray-500">
                      Turma: <span className="font-semibold text-clubRed">{reg.assignedClass}</span> | EE: <span className="text-gray-700">{reg.parentName} ({reg.phone})</span>
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">Código Acesso: {reg.accessCode}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200/50">
                      Ativo
                    </span>
                    <button
                      onClick={() => {
                        if (window.confirm(`Tem certeza que pretende remover o atleta ${reg.athleteName}?`)) {
                          removeAcceptedAthlete(reg.id);
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition"
                      title="Remover atleta do clube"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SECÇÃO: PRESENÇAS (Com os 4 Estados) */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">Selecione a Turma:</label>
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-clubRed"
                >
                  <option value="Formação infantil">Formação infantil</option>
                  <option value="Formação geral">Formação geral</option>
                  <option value="Formação avançada">Formação avançada</option>
                  <option value="Formação avançada">Pré-Representação</option>
                  <option value="Representação">Representação</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">Selecione o Dia do Treino:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-medium bg-gray-50 focus:outline-none focus:ring-2 focus:ring-clubRed"
                />
              </div>
            </div>

            <h2 className="font-bold text-gray-800 text-sm">
              Marcação de Presenças — <span className="text-clubRed">{selectedClassFilter}</span>
            </h2>

            {(() => {
              const athletesInSelectedClass = acceptedList.filter(
                (a) => (a.assignedClass || 'Formação geral') === selectedClassFilter
              );

              if (athletesInSelectedClass.length === 0) {
                return (
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
                    <p className="text-xs text-gray-400">Não existem atletas aceites nesta turma atualmente.</p>
                  </div>
                );
              }

              return athletesInSelectedClass.map((reg) => {
                const status = attendances[`${reg.id}_${selectedDate}`];
                
                let buttonStyle = 'bg-gray-100 text-gray-600 hover:bg-gray-200';
                let buttonText = 'Por Marcar';

                if (status === 'presente') {
                  buttonStyle = 'bg-emerald-600 text-white shadow-sm';
                  buttonText = 'Presente ✓';
                } else if (status === 'justificado') {
                  buttonStyle = 'bg-amber-500 text-white shadow-sm';
                  buttonText = 'Faltou com Justificação';
                } else if (status === 'injustificado') {
                  buttonStyle = 'bg-rose-600 text-white shadow-sm';
                  buttonText = 'Faltou sem Justificação ✕';
                } else if (status === 'lesao') {
                  buttonStyle = 'bg-blue-600 text-white shadow-sm';
                  buttonText = 'Lesão 🦿';
                }

                return (
                  <div key={reg.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{reg.athleteName}</h3>
                      <p className="text-xs text-gray-400 font-mono">ID: {reg.accessCode}</p>
                    </div>
                    <button
                      onClick={() => toggleAttendance(reg.id, selectedDate)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${buttonStyle}`}
                      title="Clique para alternar o estado de presença"
                    >
                      {buttonText}
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* SECÇÃO: EVENTOS */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <h2 className="font-bold text-gray-800 text-sm">Criar Novo Evento / Competição</h2>
              <form onSubmit={handleCreateEvent} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Nome do Evento</label>
                  <input
                    type="text"
                    placeholder="Ex: Torneio Regional"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Data do Evento</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Turma Alvo</label>
                  <select
                    value={newEventClass}
                    onChange={(e) => setNewEventClass(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs bg-white"
                  >
                    <option value="Formação infantil">Formação infantil</option>
                    <option value="Formação geral">Formação geral</option>
                    <option value="Formação avançada">Formação avançada</option>
                    <option value="Representação">Representação</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    className="w-full py-3 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition shadow"
                  >
                    Guardar e Criar Evento
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              <h2 className="font-bold text-gray-800 text-sm">Lista de Eventos e Participação</h2>
              {events.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
                  <p className="text-xs text-gray-400">Ainda não existem eventos criados.</p>
                </div>
              ) : (
                events.map((ev) => {
                  const athletesInClass = acceptedList.filter(
                    (a) => (a.assignedClass || 'Formação geral') === ev.targetClass
                  );

                  return (
                    <div key={ev.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                      <div className="flex justify-between items-start border-b pb-3">
                        <div>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                            {ev.targetClass}
                          </span>
                          <h3 className="font-bold text-gray-900 text-base mt-1">{ev.name}</h3>
                          <p className="text-xs text-gray-400">Data: {ev.date}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm(`Pretende eliminar o evento ${ev.name}?`)) {
                              deleteEvent(ev.id);
                            }
                          }}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                        >
                          Eliminar Evento
                        </button>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-700">Controlo de Presença / Participação:</p>
                        {athletesInClass.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Não existem atletas aceites nesta turma atualmente.</p>
                        ) : (
                          athletesInClass.map((athlete) => {
                            const isAttending = eventAttendances[`${ev.id}_${athlete.id}`] || false;
                            return (
                              <div key={athlete.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-medium text-gray-800">{athlete.athleteName}</span>
                                
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => toggleEventAttendance(ev.id, athlete.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                                      isAttending 
                                        ? 'bg-emerald-600 text-white shadow-sm' 
                                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                                    }`}
                                    title="Vai estar / Esteve"
                                  >
                                    <span>✓ Esteve / Vai</span>
                                  </button>

                                  <button
                                    onClick={() => toggleEventAttendance(ev.id, athlete.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                                      !isAttending 
                                        ? 'bg-rose-600 text-white shadow-sm' 
                                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                                    }`}
                                    title="Não vai / Faltou"
                                  >
                                    <span>✕ Faltou / Não vai</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}