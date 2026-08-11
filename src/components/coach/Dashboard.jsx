import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../services/supabaseClient';

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
    toggleEventAttendance,
    adultClasses,
    addAdultClass,
    deleteAdultClass,
    messages,
    sendMessage
  } = useApp();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'accepted', 'attendance', 'events', 'parentClasses', 'communication'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClassFilter, setSelectedClassFilter] = useState('Formação infantil');
  const [selectedClasses, setSelectedClasses] = useState({});

  // Estado para expandir/colapsar detalhes do atleta na aba 'Atletas'
  const [expandedAthletes, setExpandedAthletes] = useState({});

  // Formulário para novo evento
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventClass, setNewEventClass] = useState('Formação geral');

  // Formulário para nova Aula de Pais
  const [parentClassDate, setParentClassDate] = useState('');
  const [parentClassTime, setParentClassTime] = useState('18:15 - 19:00');
  const [parentClassMaxSeats, setParentClassMaxSeats] = useState(15);

  // Estados para o CHAT
  const [chatTarget, setChatTarget] = useState('all'); // 'all' ou email de um encarregado
  const [chatText, setChatText] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  const pendingList = registrations.filter((r) => r.status === 'pending');
  const acceptedList = registrations.filter((r) => r.status === 'accepted');

  const [localAdultClasses, setLocalAdultClasses] = useState(adultClasses || []);

  const handleClassChange = (id, className) => {
    setSelectedClasses({ ...selectedClasses, [id]: className });
  };

  const toggleExpandAthlete = (id) => {
    setExpandedAthletes((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleAcceptWithClass = async (regId) => {
    const assignedClass = selectedClasses[regId] || 'Formação geral';
    
    const athlete = pendingList.find((r) => r.id === regId);
    if (!athlete) return;

    const accessCodeToSend = athlete.access_code || athlete.accessCode;

    try {
      updateRegistrationStatus(regId, 'accepted', '', assignedClass);

      const { data, error } = await supabase.functions.invoke('send-club-email', {
        body: { 
          email: athlete.email || athlete.parentEmail || athlete.parent_email,
          athleteName: athlete.athleteName || athlete.fullName || athlete.name,
          status: 'accepted',
          accessCode: accessCodeToSend
        }
      });

      if (error) throw error;
      
      alert(`Inscrição aceite e email de acesso enviado para ${athlete.email || athlete.parentEmail}!`);

    } catch (err) {
      console.error("Erro ao enviar email:", err.message);
      alert("Inscrição aceite, mas ocorreu um erro ao enviar o email: " + err.message);
    }
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

  const handleCreateParentClass = (e) => {
    e.preventDefault();
    if (!parentClassDate || !parentClassMaxSeats) return;

    const newClass = {
      id: Date.now().toString(),
      date: parentClassDate,
      time: parentClassTime,
      maxSeats: parseInt(parentClassMaxSeats, 10),
      enrolledParents: [],
    };

    if (addAdultClass) {
      addAdultClass(newClass);
    } else {
      setLocalAdultClasses([...localAdultClasses, newClass]);
    }

    setParentClassDate('');
    setParentClassMaxSeats(15);
    alert('Aula para Encarregados criada com sucesso!');
  };

  const handleDeleteParentClass = (classId) => {
    if (window.confirm('Tem certeza que pretende cancelar esta aula de adultos?')) {
      if (deleteAdultClass) {
        deleteAdultClass(classId);
      } else {
        setLocalAdultClasses(localAdultClasses.filter((c) => c.id !== classId));
      }
    }
  };

  // Enviar Mensagem no CHAT
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;

    setIsSendingChat(true);

    const msgObj = {
      id: Date.now().toString(),
      sender: 'Coach',
      recipientEmail: chatTarget,
      text: chatText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('pt-PT')
    };

    if (sendMessage) {
      sendMessage(msgObj);
    }

    try {
      let recipients = [];
      if (chatTarget === 'all') {
        recipients = acceptedList
          .map((r) => r.email || r.parentEmail || r.parent_email)
          .filter(Boolean);
        recipients = [...new Set(recipients)];
      } else {
        recipients = [chatTarget];
      }

      for (const email of recipients) {
        // Encontra o atleta correspondente para incluir o nome no email
        const targetAthlete = acceptedList.find(
          (r) => (r.email || r.parentEmail || r.parent_email) === email
        );

        await supabase.functions.invoke('send-club-email', {
          body: {
            email,
            subject: '💬 Nova mensagem do Treinador',
            message: chatText,
            athleteName: targetAthlete ? (targetAthlete.athleteName || targetAthlete.fullName) : 'Clube',
            type: 'chat_notification'
          }
        });
      }
    } catch (err) {
      console.error('Notificação por email falhou:', err);
    }

    setChatText('');
    setIsSendingChat(false);
  };

  const handleOpenPrivateChat = (email) => {
    setChatTarget(email);
    setActiveTab('communication');
  };

  const activeParentClassesList = adultClasses || localAdultClasses;

  const allMessagesList = messages || [];
  const currentChatMessages = allMessagesList.filter(
    (m) => chatTarget === 'all' ? m.recipientEmail === 'all' : (m.recipientEmail === chatTarget || m.senderEmail === chatTarget)
  );

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      
      {/* Header */}
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
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              {pendingList.length}
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium">Pendentes</p>
              <h3 className="text-xs font-bold text-gray-900">Validação</h3>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              {acceptedList.length}
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium">Ativos</p>
              <h3 className="text-xs font-bold text-gray-900">Atletas</h3>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              {events.length}
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium">Criados</p>
              <h3 className="text-xs font-bold text-gray-900">Eventos</h3>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
              {activeParentClassesList.length}
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium">Aulas</p>
              <h3 className="text-xs font-bold text-gray-900">Encarregados</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-6 gap-1 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200 text-center">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all ${
              activeTab === 'pending' ? 'bg-clubRed text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Pendentes ({pendingList.length})
          </button>
          <button
            onClick={() => setActiveTab('accepted')}
            className={`py-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all ${
              activeTab === 'accepted' ? 'bg-clubRed text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Atletas ({acceptedList.length})
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`py-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all ${
              activeTab === 'attendance' ? 'bg-clubRed text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Presenças
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`py-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all ${
              activeTab === 'events' ? 'bg-clubRed text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Eventos
          </button>
          <button
            onClick={() => setActiveTab('parentClasses')}
            className={`py-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all ${
              activeTab === 'parentClasses' ? 'bg-clubRed text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Aulas Pais
          </button>
          <button
            onClick={() => setActiveTab('communication')}
            className={`py-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all ${
              activeTab === 'communication' ? 'bg-clubRed text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Chat 💬
          </button>
        </div>
      </div>

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
                    <h3 className="font-bold text-gray-900 text-base">{reg.athleteName || reg.fullName}</h3>
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

        {/* SECÇÃO: ATLETAS ACEITES (COM EXPANSÃO DE DADOS COMPLETOS) */}
        {activeTab === 'accepted' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 text-sm">Atletas Ativos no Plantel</h2>
            {acceptedList.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center space-y-2">
                <p className="text-sm font-semibold text-gray-700">Nenhum atleta ativo</p>
              </div>
            ) : (
              acceptedList.map((reg) => {
                const parentEmail = reg.email || reg.parentEmail || reg.parent_email;
                const isExpanded = expandedAthletes[reg.id] || false;

                return (
                  <div key={reg.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                    
                    {/* Linha Principal de Informação */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="font-bold text-gray-900 text-base">{reg.athleteName || reg.fullName}</h3>
                        <p className="text-xs text-gray-500">
                          Turma: <span className="font-semibold text-clubRed">{reg.assignedClass || 'Formação geral'}</span> | EE: <span className="text-gray-800 font-medium">{reg.parentName} ({reg.phone})</span>
                        </p>
                        <p className="text-[11px] text-gray-400 font-mono">
                          Código de Acesso: <span className="font-semibold text-gray-700">{reg.access_code || reg.accessCode || 'N/A'}</span>
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleExpandAthlete(reg.id)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                        >
                          <span>{isExpanded ? '▲ Ocultar Ficha' : '▼ Ver Ficha Completa'}</span>
                        </button>

                        {parentEmail && (
                          <button
                            onClick={() => handleOpenPrivateChat(parentEmail)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                            title="Conversar com o encarregado"
                          >
                            <span>💬 Chat</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (window.confirm(`Tem certeza que pretende remover o atleta ${reg.athleteName || reg.fullName}?`)) {
                              removeAcceptedAthlete(reg.id);
                            }
                          }}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition"
                          title="Remover do clube"
                        >
                          Remover
                        </button>
                      </div>
                    </div>

                    {/* Ficha Completa Expandida */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-gray-100 text-xs space-y-4 bg-gray-50/80 p-4 rounded-xl">
                        
                        {/* Dados Pessoais do Atleta */}
                        <div className="space-y-1">
                          <h4 className="font-bold text-gray-800 border-b pb-1 text-[11px] uppercase tracking-wider text-clubRed">
                            👤 Dados do Atleta
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-gray-700">
                            <p><strong>Nascimento:</strong> {reg.birthDate || 'N/D'}</p>
                            <p><strong>Sexo:</strong> {reg.gender || 'N/D'}</p>
                            <p><strong>Cartão de Cidadão:</strong> {reg.athleteCC || 'N/D'}</p>
                          </div>
                        </div>

                        {/* Encarregado de Educação e Contactos */}
                        <div className="space-y-1">
                          <h4 className="font-bold text-gray-800 border-b pb-1 text-[11px] uppercase tracking-wider text-clubRed">
                            👨‍👩‍👧 Encarregado de Educação & Contactos
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-gray-700">
                            <p><strong>Nome do EE:</strong> {reg.parentName || 'N/D'}</p>
                            <p><strong>CC do EE:</strong> {reg.parentCC || 'N/D'}</p>
                            <p><strong>Email:</strong> {parentEmail || 'N/D'}</p>
                            <p><strong>Telemóvel:</strong> {reg.phone || 'N/D'}</p>
                            <p className="sm:col-span-2">
                              <strong>Morada:</strong> {reg.address || 'N/D'}, {reg.postalCode} {reg.city}
                            </p>
                          </div>
                        </div>

                        {/* Dados de Sócio */}
                        <div className="space-y-1">
                          <h4 className="font-bold text-gray-800 border-b pb-1 text-[11px] uppercase tracking-wider text-clubRed">
                            💳 Estatuto de Sócio
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-gray-700">
                            <p><strong>Nº de Sócio:</strong> {reg.memberNumber || 'N/D'}</p>
                            <p><strong>Sócio Titular:</strong> {reg.memberType || 'Atleta'}</p>
                          </div>
                        </div>

                        {/* Tamanhos do Equipamento */}
                        <div className="space-y-1">
                          <h4 className="font-bold text-gray-800 border-b pb-1 text-[11px] uppercase tracking-wider text-clubRed">
                            🎽 Equipamento e Vestuário
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-gray-700">
                            <p><strong>Fato de Treino:</strong> {reg.tracksuitSize || 'Não pretendo'}</p>
                            <p><strong>T-shirt Oficial:</strong> {reg.officialTshirtSize || 'Não pretendo'}</p>
                            <p><strong>T-shirt Vermelha:</strong> {reg.redTshirtSize || 'Não pretendo'}</p>
                            <p><strong>T-shirt Amarela:</strong> {reg.yellowTshirtSize || 'Não pretendo'}</p>
                          </div>
                        </div>

                        {/* Aulas de Adultos */}
                        <div className="space-y-1">
                          <h4 className="font-bold text-gray-800 border-b pb-1 text-[11px] uppercase tracking-wider text-clubRed">
                            🤸 Aulas para Encarregados
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-gray-700">
                            <p><strong>Interesse:</strong> {reg.adultClassesInterest || 'Não'}</p>
                            <p><strong>Participantes:</strong> {reg.adultClassesParticipants || 'N/D'}</p>
                            <p><strong>Pagamento:</strong> {reg.adultClassesPaymentMode || 'N/D'}</p>
                          </div>
                        </div>

                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        )}

        {/* SECÇÃO: PRESENÇAS */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">Selecione a Turma:</label>
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value="Formação infantil">Formação infantil</option>
                  <option value="Formação geral">Formação geral</option>
                  <option value="Formação avançada">Formação avançada</option>
                  <option value="Representação">Representação</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">Selecione o Dia do Treino:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-medium bg-gray-50"
                />
              </div>
            </div>

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
                let buttonStyle = 'bg-gray-100 text-gray-600';
                let buttonText = 'Por Marcar';

                if (status === 'presente') {
                  buttonStyle = 'bg-emerald-600 text-white';
                  buttonText = 'Presente ✓';
                } else if (status === 'justificado') {
                  buttonStyle = 'bg-amber-500 text-white';
                  buttonText = 'Faltou com Justificação';
                } else if (status === 'injustificado') {
                  buttonStyle = 'bg-rose-600 text-white';
                  buttonText = 'Faltou sem Justificação ✕';
                }

                return (
                  <div key={reg.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{reg.athleteName || reg.fullName}</h3>
                    </div>
                    <button
                      onClick={() => toggleAttendance(reg.id, selectedDate)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${buttonStyle}`}
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
                    <option value="Formação infantil">Formação infantil - Spark</option>
                    <option value="Formação geral">Formação geral - Flame</option>
                    <option value="Formação avançada">Formação avançada - Fusion </option>
                    <option value="Representação">Pré-Representação - Thunder</option>
                    <option value="Representação">Representação - Firestorm</option>
                    <option value="Representação">Adultos - Stormfit</option>
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
          </div>
        )}

        {/* SECÇÃO: AULAS DE PAIS */}
        {activeTab === 'parentClasses' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <h2 className="font-bold text-gray-800 text-sm">Abertura de Aula para Encarregados (Adultos)</h2>
              <form onSubmit={handleCreateParentClass} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Data da Aula</label>
                  <input
                    type="date"
                    value={parentClassDate}
                    onChange={(e) => setParentClassDate(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Horário</label>
                  <input
                    type="text"
                    value={parentClassTime}
                    onChange={(e) => setParentClassTime(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Vagas</label>
                  <input
                    type="number"
                    value={parentClassMaxSeats}
                    onChange={(e) => setParentClassMaxSeats(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs bg-gray-50"
                    required
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    className="w-full py-3 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition shadow"
                  >
                    + Criar Aula
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SECÇÃO: CHAT ESTILO WHATSAPP */}
        {activeTab === 'communication' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[500px] overflow-hidden">
            
            {/* Header do Chat / Seleção de Conversa */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Conversar Com:</span>
                <select
                  value={chatTarget}
                  onChange={(e) => setChatTarget(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl p-2 text-xs font-bold text-gray-800 focus:outline-none"
                >
                  <option value="all">📢 Canal Geral (Todos os Pais)</option>
                  {acceptedList.map((athlete) => {
                    const email = athlete.email || athlete.parentEmail || athlete.parent_email;
                    return (
                      <option key={athlete.id} value={email}>
                        👤 EE: {athlete.parentName} ({athlete.athleteName || athlete.fullName})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Balões de Mensagem (Área de Scroll) */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {currentChatMessages.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400">
                  Nenhuma mensagem trocada nesta conversa. Escreva a primeira mensagem abaixo!
                </div>
              ) : (
                currentChatMessages.map((msg, idx) => {
                  const isCoach = msg.sender === 'Coach';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isCoach ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-2xl text-xs space-y-1 ${
                          isCoach
                            ? 'bg-clubRed text-white rounded-tr-none'
                            : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
                        }`}
                      >
                        <span className="text-[10px] font-bold block opacity-80">
                          {isCoach ? 'Treinador' : msg.senderName || 'Encarregado'}
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

            {/* Input para Escrever Mensagem */}
            <form onSubmit={handleSendChatMessage} className="p-3 bg-white border-t border-gray-200 flex space-x-2">
              <input
                type="text"
                placeholder="Escreva a mensagem..."
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

      </main>
    </div>
  );
}