import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../services/supabaseClient';

export default function ParentDashboard({ registration, onLogout }) {
  const { 
    updateRegistrationByParent, 
    adultClasses, 
    enrollInAdultClass, 
    cancelAdultClassEnrollment,
    events,
    messages,
    sendMessage
  } = useApp();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'events', 'chat', 'adultClasses'
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(registration);
  const [successMsg, setSuccessMsg] = useState('');

  // Estado do Chat
  const [chatText, setChatText] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  const parentEmail = registration.email || registration.parentEmail || registration.parent_email;

  // Turma atribuída ao filho/atleta
  const athleteClass = registration.assignedClass || registration.assigned_class || 'Formação geral';

  // Filtrar eventos associados à turma do atleta
  const allEventsList = events || [];
  const myClassEvents = allEventsList.filter((event) => {
    const targetClasses = event.targetClasses || [event.targetClass];
    // Se não tiver turmas especificadas, exibe por defeito ou compara diretamente
    if (!targetClasses || targetClasses.length === 0) return true;
    
    // Verifica se a turma do atleta está incluída na lista do evento
    return targetClasses.some(tc => 
      tc && tc.toLowerCase().trim() === athleteClass.toLowerCase().trim()
    );
  });

  // Filtrar conversas: Mensagens do Canal Geral + Mensagens Privadas deste pai
  const allMessagesList = messages || [];
  const myChatMessages = allMessagesList.filter(
    (m) => m.recipientEmail === 'all' || m.recipientEmail === parentEmail || m.senderEmail === parentEmail
  );

  const activeAdultClasses = adultClasses || [];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = (e) => {
    e.preventDefault();
    updateRegistrationByParent(registration.id, formData);
    setSuccessMsg('Dados atualizados com sucesso!');
    setIsEditing(false);
  };

  const handleEnroll = (classId) => {
    const parentIdentifier = {
      id: registration.id,
      name: registration.parentName || formData.parentName,
      email: parentEmail,
      timestamp: new Date().toISOString()
    };

    if (enrollInAdultClass) {
      enrollInAdultClass(classId, parentIdentifier);
    }
  };

  const handleCancelEnrollment = (classId) => {
    if (window.confirm('Tem certeza que pretende cancelar a sua inscrição nesta aula?')) {
      if (cancelAdultClassEnrollment) {
        cancelAdultClassEnrollment(classId, registration.id);
      }
    }
  };

  // Enviar Mensagem no Chat do Encarregado
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;

    setIsSendingChat(true);

    const msgObj = {
      id: Date.now().toString(),
      sender: 'Parent',
      senderName: registration.parentName || formData.parentName,
      senderEmail: parentEmail,
      recipientEmail: 'Coach',
      text: chatText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('pt-PT')
    };

    // 1. Guardar no contexto local da app
    if (sendMessage) {
      sendMessage(msgObj);
    }

    // 2. Disparar notificação por email ao treinador
    try {
      await supabase.functions.invoke('send-club-email', {
        body: {
          email: 'treinador@clube.com',
          senderName: registration.parentName || formData.parentName,
          athleteName: registration.athleteName || formData.athleteName,
          subject: `💬 Mensagem do Encarregado (${registration.parentName})`,
          message: chatText,
          type: 'parent_chat'
        }
      });
    } catch (err) {
      console.error('Erro no envio de email ao treinador:', err);
    }

    setChatText('');
    setIsSendingChat(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      
      {/* Header */}
      <header className="bg-clubRed text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center p-0.5">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-bold text-sm">Área do Encarregado de Educação</h1>
        </div>
        <button onClick={onLogout} className="text-xs bg-white text-clubRed px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-100 transition">
          Sair
        </button>
      </header>

      {/* Navegação por Abas */}
      <div className="max-w-2xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-2xl shadow-sm border border-gray-200 text-center">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 text-[11px] sm:text-xs font-bold rounded-xl transition ${
              activeTab === 'overview' ? 'bg-clubRed text-white shadow' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Ficha Atleta
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`py-2 text-[11px] sm:text-xs font-bold rounded-xl transition ${
              activeTab === 'events' ? 'bg-clubRed text-white shadow' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Eventos 🏆
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2 text-[11px] sm:text-xs font-bold rounded-xl transition ${
              activeTab === 'chat' ? 'bg-clubRed text-white shadow' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Chat 💬
          </button>
          <button
            onClick={() => setActiveTab('adultClasses')}
            className={`py-2 text-[11px] sm:text-xs font-bold rounded-xl transition ${
              activeTab === 'adultClasses' ? 'bg-clubRed text-white shadow' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Aulas Pais
          </button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        
        {successMsg && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs font-medium">
            {successMsg}
          </div>
        )}

        {/* ABA 1: FICHA E DADOS */}
        {activeTab === 'overview' && (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-2">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-gray-800">Estado da Inscrição</h2>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                  registration.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {registration.status === 'accepted' ? 'Aceite ✓' : 'Pendente de Validação'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Turma Atribuída: <strong className="text-clubRed font-bold">{athleteClass}</strong>
              </p>
              <p className="text-xs text-gray-500">
                Código de Acesso: <strong className="text-gray-900 font-mono">{registration.accessCode || registration.access_code}</strong>
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-gray-800 text-sm">Dados da Inscrição</h2>
                {!isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-semibold"
                  >
                    Editar Dados
                  </button>
                )}
              </div>

              {!isEditing ? (
                <div className="text-xs text-gray-600 space-y-2 bg-gray-50 p-4 rounded-xl">
                  <p><strong>Atleta:</strong> {formData.athleteName || formData.athlete_name}</p>
                  <p><strong>Data de Nascimento:</strong> {formData.birthDate || formData.birth_date}</p>
                  <p><strong>Encarregado de Educação:</strong> {formData.parentName || formData.parent_name}</p>
                  <p><strong>Email:</strong> {formData.email}</p>
                  <p><strong>Telemóvel:</strong> {formData.phone}</p>
                </div>
              ) : (
                <form onSubmit={handleSave} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nome do Atleta</label>
                    <input type="text" name="athleteName" value={formData.athleteName || formData.athlete_name || ''} onChange={handleChange} className="w-full p-2.5 border rounded-xl text-xs" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Telemóvel</label>
                    <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full p-2.5 border rounded-xl text-xs" required />
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <button type="button" onClick={() => setIsEditing(false)} className="w-1/2 py-2 bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold">Cancelar</button>
                    <button type="submit" className="w-1/2 py-2 bg-clubRed text-white rounded-xl text-xs font-semibold">Guardar Alterações</button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}

        {/* ABA 2: EVENTOS E COMPETIÇÕES DA TURMA DO ATLETA */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-800 text-sm">Eventos e Convocatórias</h2>
                <p className="text-xs text-gray-500">
                  Eventos agendados para a turma: <strong className="text-clubRed">{athleteClass}</strong>
                </p>
              </div>
              <span className="bg-red-50 text-clubRed font-bold text-xs px-2.5 py-1 rounded-lg border border-red-100">
                {myClassEvents.length} {myClassEvents.length === 1 ? 'Evento' : 'Eventos'}
              </span>
            </div>

            {myClassEvents.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center space-y-2">
                <p className="text-sm font-semibold text-gray-700">Sem eventos agendados</p>
                <p className="text-xs text-gray-400">Não existem convocações ativas para a turma {athleteClass} de momento.</p>
              </div>
            ) : (
              myClassEvents.map((ev) => (
                <div key={ev.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3">
                  <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{ev.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        📅 Data: <strong className="text-gray-800">{ev.date}</strong>
                      </p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-700 font-bold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-100">
                      Convocado
                    </span>
                  </div>

                  <div className="space-y-2 pt-1 text-xs">
                    <div>
                      <span className="text-gray-400 font-semibold uppercase text-[10px] block mb-1">
                        Turmas Abrangidas:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(ev.targetClasses || [ev.targetClass]).map((tc, idx) => (
                          <span 
                            key={idx} 
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                              tc === athleteClass 
                                ? 'bg-red-50 text-clubRed border-red-200' 
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}
                          >
                            {tc}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mt-2">
                      <span className="text-gray-400 font-semibold uppercase text-[10px] block mb-1">
                        Horários Programados:
                      </span>
                      <ul className="list-disc list-inside text-gray-800 font-medium space-y-1">
                        {(ev.schedules || ['Horário a confirmar pelo treinador']).map((sch, idx) => (
                          <li key={idx}>{sch}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ABA 3: CHAT COM O TREINADOR */}
        {activeTab === 'chat' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[500px] overflow-hidden">
            
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-xs text-gray-800">💬 Chat com o Treinador do Clube</h2>
              <p className="text-[10px] text-gray-500">Histórico de conversas privadas e comunicados gerais.</p>
            </div>

            {/* Mensagens */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {myChatMessages.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400">
                  Nenhuma mensagem trocada ainda. Escreva uma mensagem abaixo!
                </div>
              ) : (
                myChatMessages.map((msg, idx) => {
                  const isParent = msg.sender === 'Parent';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isParent ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-2xl text-xs space-y-1 ${
                          isParent
                            ? 'bg-clubRed text-white rounded-tr-none'
                            : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
                        }`}
                      >
                        <span className="text-[10px] font-bold block opacity-80">
                          {isParent ? 'Você' : 'Treinador'}
                        </span>
                        <p className="leading-relaxed whitespace-pre-line">{msg.text || msg.message}</p>
                        <span className="text-[9px] block text-right opacity-70">
                          {msg.timestamp || msg.date}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Form de Envio */}
            <form onSubmit={handleSendChatMessage} className="p-3 bg-white border-t border-gray-200 flex space-x-2">
              <input
                type="text"
                placeholder="Escreva a mensagem para o treinador..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                className="flex-1 p-3 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-clubRed"
                required
              />
              <button
                type="submit"
                disabled={isSendingChat}
                className="px-5 py-3 bg-clubRed hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow"
              >
                Enviar
              </button>
            </form>

          </div>
        )}

        {/* ABA 4: AULAS PAIS */}
        {activeTab === 'adultClasses' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="font-bold text-gray-800 text-sm">Aulas de Adultos (Segundas-Feiras)</h2>
            {activeAdultClasses.length === 0 ? (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                <p className="text-xs text-gray-400">Não existem aulas agendadas de momento pelo treinador.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeAdultClasses.map((classItem) => {
                  const enrolledList = classItem.enrolledParents || [];
                  const myIndex = enrolledList.findIndex((p) => p.id === registration.id || p.name === registration.parentName);
                  const isEnrolled = myIndex !== -1;
                  const isFull = enrolledList.length >= classItem.maxSeats;

                  return (
                    <div key={classItem.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-gray-900 block">📅 Data: {classItem.date}</span>
                          <span className="text-[11px] text-gray-500 block">⏰ Horário: {classItem.time}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                        {isEnrolled ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold text-emerald-700">✓ Inscrito (Lugar #{myIndex + 1})</span>
                            <button onClick={() => handleCancelEnrollment(classItem.id)} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold">
                              Cancelar Inscrição
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEnroll(classItem.id)}
                            disabled={isFull}
                            className={`w-full py-2.5 rounded-xl text-xs font-bold ${
                              isFull ? 'bg-gray-200 text-gray-400' : 'bg-clubRed text-white'
                            }`}
                          >
                            {isFull ? 'Vagas Preenchidas' : 'Reservar Minha Vaga'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}