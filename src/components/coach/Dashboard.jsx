import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../services/supabaseClient';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function Dashboard({ onLogout }) {
  const { 
    registrations, 
    fetchRegistrations,
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

  useEffect(() => {
    if (fetchRegistrations) {
      fetchRegistrations();
    }
  }, []);

  const [activeTab, setActiveTab] = useState('pending');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClassFilter, setSelectedClassFilter] = useState('Spark');
  const [selectedClasses, setSelectedClasses] = useState({});

  const [expandedAthletes, setExpandedAthletes] = useState({});

  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventClass, setNewEventClass] = useState('Flame');

  const [parentClassDate, setParentClassDate] = useState('');
  const [parentClassTime, setParentClassTime] = useState('18:15 - 19:00');
  const [parentClassMaxSeats, setParentClassMaxSeats] = useState(15);

  const [chatTarget, setChatTarget] = useState('all');
  const [chatText, setChatText] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Estado local sincronizado para garanitr fidelidade visual e na exportação
  const [localAttendances, setLocalAttendances] = useState({});

  useEffect(() => {
    if (attendances) {
      setLocalAttendances(attendances);
    }
  }, [attendances]);

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

  // Função para definir o estado de presença exatamente na tecla pretendida
  const handleSetAthleteStatus = (athleteId, targetStatus) => {
    const key = `${athleteId}_${selectedDate}`;
    const currentStatus = localAttendances[key];
    
    // Se voltar a clicar na opção ativa, limpa o estado
    const newStatus = currentStatus === targetStatus ? null : targetStatus;

    setLocalAttendances((prev) => ({
      ...prev,
      [key]: newStatus
    }));

    if (toggleAttendance) {
      toggleAttendance(athleteId, selectedDate, newStatus);
    }
  };

  const handleAcceptWithClass = async (regId) => {
    const assignedClass = selectedClasses[regId] || 'Flame';
    const athlete = pendingList.find((r) => r.id === regId);
    if (!athlete) return;

    const accessCodeToSend = athlete.access_code || athlete.accessCode;

    try {
      await updateRegistrationStatus(regId, 'accepted', '', assignedClass);

      const parentEmail = athlete.email || athlete.parentEmail || athlete.parent_email;
      const athleteFullName = athlete.athleteName || athlete.athlete_name || athlete.fullName || athlete.name;

      if (parentEmail) {
        const { error } = await supabase.functions.invoke('send-club-email', {
          body: { 
            email: parentEmail,
            athleteName: athleteFullName,
            status: 'accepted',
            accessCode: accessCodeToSend
          }
        });

        if (error) throw error;
      }

      alert(`Inscrição aceite e email de acesso enviado para ${parentEmail || 'o encarregado'}!`);

    } catch (err) {
      console.error("Erro ao aceitar/enviar email:", err.message);
      alert("Inscrição aceite, mas ocorreu um erro no processamento do email: " + err.message);
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
        const targetAthlete = acceptedList.find(
          (r) => (r.email || r.parentEmail || r.parent_email) === email
        );

        await supabase.functions.invoke('send-club-email', {
          body: {
            email,
            subject: '💬 Nova mensagem do Treinador',
            message: chatText,
            athleteName: targetAthlete ? (targetAthlete.athleteName || targetAthlete.athlete_name || targetAthlete.fullName) : 'Clube',
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

  // Agrupar atletas ativos por Turma
  const groupedAcceptedAthletes = acceptedList.reduce((acc, athlete) => {
    const className = athlete.assignedClass || athlete.assigned_class || 'Flame';
    if (!acc[className]) {
      acc[className] = [];
    }
    acc[className].push(athlete);
    return acc;
  }, {});

  // EXPORTAÇÃO PARA EXCEL COM AS SIGLAS REQUISITADAS (P, FJ, FNJ, L)
  const exportAttendancesToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Presenças ');

    worksheet.getColumn(1).width = 6;
    worksheet.getColumn(2).width = 28;

    const months = [
      { name: 'SETEMBRO', days: [2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25, 28, 30] },
      { name: 'OUTUBRO', days: [2, 5, 7, 9, 12, 14, 16, 19, 21, 23, 26, 28, 30] },
      { name: 'NOVEMBRO', days: [2, 4, 6, 9, 11, 13, 16, 18, 20, 23, 25, 27, 30] },
      { name: 'DEZEMBRO', days: [2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25, 28] }
    ];

    let startCol = 3;
    months.forEach((m) => {
      const endCol = startCol + m.days.length - 1;
      worksheet.mergeCells(1, startCol, 1, endCol);
      const cell = worksheet.getCell(1, startCol);
      cell.value = m.name;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { name: 'Arial', size: 10, bold: true };

      m.days.forEach((day, idx) => {
        const colIdx = startCol + idx;
        worksheet.getColumn(colIdx).width = 4.5;
        const dayCell = worksheet.getCell(2, colIdx);
        dayCell.value = day;
        dayCell.alignment = { horizontal: 'center', vertical: 'middle' };
        dayCell.font = { name: 'Arial', size: 9 };
      });

      startCol = endCol + 1;
    });

    let currentRow = 3;

    // Obter fonte de dados mais atual para presenças
    const currentAttendancesMap = { ...attendances, ...localAttendances };

    const classesList = Object.keys(groupedAcceptedAthletes);
    const targetClasses = classesList.length > 0 ? classesList : [selectedClassFilter];

    targetClasses.forEach((className) => {
      const athletes = groupedAcceptedAthletes[className] || [];
      if (athletes.length === 0) return;

      athletes.forEach((athlete, index) => {
        const numCell = worksheet.getCell(currentRow, 1);
        numCell.value = index + 1;
        numCell.alignment = { horizontal: 'center' };
        numCell.font = { name: 'Arial', size: 9 };

        const nameCell = worksheet.getCell(currentRow, 2);
        nameCell.value = athlete.athleteName || athlete.athlete_name || athlete.fullName;
        nameCell.font = { name: 'Arial', size: 9 };

        let colTracker = 3;
        months.forEach((m) => {
          m.days.forEach((day) => {
            const monthNum = m.name === 'SETEMBRO' ? '09' : m.name === 'OUTUBRO' ? '10' : m.name === 'NOVEMBRO' ? '11' : '12';
            const dayStr = day < 10 ? `0${day}` : `${day}`;
            const yearStr = new Date().getFullYear();
            const dateKey = `${yearStr}-${monthNum}-${dayStr}`;

            const status = currentAttendancesMap[`${athlete.id}_${dateKey}`];
            const pCell = worksheet.getCell(currentRow, colTracker);

            // MAPEAMENTO DE SIGLAS
            if (status === 'presente') pCell.value = 'P';
            else if (status === 'justificado') pCell.value = 'FJ';
            else if (status === 'injustificado') pCell.value = 'FNJ';
            else if (status === 'lesao') pCell.value = 'L';

            pCell.alignment = { horizontal: 'center' };
            pCell.font = { name: 'Arial', size: 8 };

            colTracker++;
          });
        });

        currentRow++;
      });

      currentRow += 2;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Presencas_SCS_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      
      {/* Header */}
      <header className="bg-gradient-to-r from-clubRed to-red-700 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 shadow">
              <img src="/logo_clube.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Painel do Treinador</h1>
              <p className="text-xs text-red-100 opacity-90">Gestão e Controlo do Clube</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchRegistrations && fetchRegistrations()}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl font-medium transition"
              title="Atualizar lista de inscrições"
            >
              🔄 Atualizar
            </button>
            <button 
              onClick={onLogout} 
              className="text-xs bg-white/15 hover:bg-white/25 text-white border border-white/20 px-4 py-2 rounded-xl font-semibold transition"
            >
              Terminar Sessão
            </button>
          </div>
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
            onClick={() => { setActiveTab('pending'); fetchRegistrations && fetchRegistrations(); }}
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
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-gray-800 text-sm">Fichas de Inscrição Pendentes</h2>
              <button 
                onClick={() => fetchRegistrations && fetchRegistrations()}
                className="text-xs text-clubRed font-semibold hover:underline"
              >
                🔄 Recarregar Inscrições
              </button>
            </div>

            {pendingList.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center space-y-2">
                <p className="text-sm font-semibold text-gray-700">Tudo em dia!</p>
                <p className="text-xs text-gray-400">Não existem inscrições pendentes de momento.</p>
              </div>
            ) : (
              pendingList.map((reg) => {
                const name = reg.athleteName || reg.athlete_name || reg.fullName;
                const birth = reg.birthDate || reg.birth_date;
                const cc = reg.athleteCC || reg.athlete_cc;
                const parent = reg.parentName || reg.parent_name;
                const parentCc = reg.parentCC || reg.parent_cc;

                return (
                  <div key={reg.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{name}</h3>
                      <p className="text-xs text-gray-500">Nascimento: {birth} | Sexo: {reg.gender} | CC: {cc}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div>
                        <span className="text-gray-400 block mb-0.5">Encarregado de Educação</span>
                        <strong className="text-gray-800">{parent}</strong> (CC: {parentCc})
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Telemóvel e Email</span>
                        <strong className="text-gray-800">{reg.phone}</strong>
                        <span className="block text-gray-500">{reg.email}</span>
                      </div>
                    </div>

                    <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 space-y-2">
                      <label className="block text-xs font-bold text-gray-700">Atribuir Turma ao Atleta:</label>
                      <select
                        value={selectedClasses[reg.id] || 'Spark'}
                        onChange={(e) => handleClassChange(reg.id, e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none"
                      >
                        <option value="Spark">Spark (Formação Infantil)</option>
                        <option value="Flame">Flame (Formação Geral)</option>
                        <option value="Fusion">Fusion (Formação Avançada)</option>
                        <option value="Thunder">Thunder (Pré-Representação)</option>
                        <option value="Firestorm">Firestorm (Representação)</option>
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
                );
              })
            )}
          </div>
        )}

        {/* SECÇÃO: ATLETAS ACEITES ORGANIZADOS POR TURMA */}
        {activeTab === 'accepted' && (
          <div className="space-y-6">
            <h2 className="font-bold text-gray-800 text-sm">Atletas Ativos no Plantel</h2>
            
            {acceptedList.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center space-y-2">
                <p className="text-sm font-semibold text-gray-700">Nenhum atleta ativo</p>
              </div>
            ) : (
              Object.entries(groupedAcceptedAthletes).map(([className, athletes]) => (
                <div key={className} className="space-y-3">
                  
                  {/* Cabeçalho do Grupo da Turma */}
                  <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-5 py-3 rounded-xl flex justify-between items-center shadow-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-clubRed px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                        Turma
                      </span>
                      <h3 className="font-bold text-sm">{className}</h3>
                    </div>
                    <span className="text-xs bg-white/10 px-3 py-1 rounded-lg font-semibold text-gray-200 border border-white/10">
                      {athletes.length} {athletes.length === 1 ? 'Atleta' : 'Atletas'}
                    </span>
                  </div>

                  {/* Lista de Atletas da Turma */}
                  <div className="space-y-3">
                    {athletes.map((reg) => {
                      const parentEmail = reg.email || reg.parentEmail || reg.parent_email;
                      const isExpanded = expandedAthletes[reg.id] || false;
                      const name = reg.athleteName || reg.athlete_name || reg.fullName;

                      return (
                        <div key={reg.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                          
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <h3 className="font-bold text-gray-900 text-base">{name}</h3>
                              <p className="text-xs text-gray-500">
                                Turma: <span className="font-semibold text-clubRed">{className}</span> | EE: <span className="text-gray-800 font-medium">{reg.parentName || reg.parent_name} ({reg.phone})</span>
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
                                >
                                  <span>💬 Chat</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  if (window.confirm(`Tem certeza que pretende remover o atleta ${name}?`)) {
                                    removeAcceptedAthlete(reg.id);
                                  }
                                }}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition"
                              >
                                Remover
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="pt-3 border-t border-gray-100 text-xs space-y-4 bg-gray-50/80 p-4 rounded-xl">
                              <div className="space-y-1">
                                <h4 className="font-bold text-gray-800 border-b pb-1 text-[11px] uppercase tracking-wider text-clubRed">
                                  👤 Dados do Atleta
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-gray-700">
                                  <p><strong>Nascimento:</strong> {reg.birthDate || reg.birth_date || 'N/D'}</p>
                                  <p><strong>Sexo:</strong> {reg.gender || 'N/D'}</p>
                                  <p><strong>Cartão de Cidadão:</strong> {reg.athleteCC || reg.athlete_cc || 'N/D'}</p>
                                  <p><strong>NIF Atleta:</strong> {reg.athleteNIF || reg.athlete_nif || 'N/D'}</p>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <h4 className="font-bold text-gray-800 border-b pb-1 text-[11px] uppercase tracking-wider text-clubRed">
                                  👨‍👩‍👧 Encarregado de Educação & Contactos
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-gray-700">
                                  <p><strong>Nome do EE:</strong> {reg.parentName || reg.parent_name || 'N/D'}</p>
                                  <p><strong>CC do EE:</strong> {reg.parentCC || reg.parent_cc || 'N/D'}</p>
                                  <p><strong>Email:</strong> {parentEmail || 'N/D'}</p>
                                  <p><strong>Telemóvel:</strong> {reg.phone || 'N/D'}</p>
                                  <p className="sm:col-span-2">
                                    <strong>Morada:</strong> {reg.address || 'N/D'}, {reg.postalCode || reg.postal_code} {reg.city}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <h4 className="font-bold text-gray-800 border-b pb-1 text-[11px] uppercase tracking-wider text-clubRed">
                                  💳 Estatuto de Sócio
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-gray-700">
                                  <p><strong>Nº de Sócio:</strong> {reg.memberNumber || reg.member_number || 'N/D'}</p>
                                  <p><strong>Sócio Titular:</strong> {reg.memberType || reg.member_type || 'Atleta'}</p>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <h4 className="font-bold text-gray-800 border-b pb-1 text-[11px] uppercase tracking-wider text-clubRed">
                                  🎽 Equipamento e Vestuário
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-gray-700">
                                  <p><strong>Fato de Treino:</strong> {reg.tracksuitSize || reg.tracksuit_size || 'Não pretendo'}</p>
                                  <p><strong>T-shirt Oficial:</strong> {reg.officialTshirtSize || reg.official_tshirt_size || 'Não pretendo'}</p>
                                  <p><strong>T-shirt Vermelha:</strong> {reg.redTshirtSize || reg.red_tshirt_size || 'Não pretendo'}</p>
                                  <p><strong>T-shirt Amarela:</strong> {reg.yellowTshirtSize || reg.yellow_tshirt_size || 'Não pretendo'}</p>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <h4 className="font-bold text-gray-800 border-b pb-1 text-[11px] uppercase tracking-wider text-clubRed">
                                  🤸 Aulas para Encarregados
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-gray-700">
                                  <p><strong>Interesse:</strong> {reg.adultClassesInterest || reg.adult_classes_interest || 'Não'}</p>
                                  <p><strong>Participantes:</strong> {reg.adultClassesParticipants || reg.adult_classes_participants || 'N/D'}</p>
                                  <p><strong>Pagamento:</strong> {reg.adultClassesPaymentMode || reg.adult_classes_payment_mode || 'N/D'}</p>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SECÇÃO: PRESENÇAS */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full sm:w-auto">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">Selecione a Turma:</label>
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="Spark">Spark</option>
                    <option value="Flame">Flame</option>
                    <option value="Fusion">Fusion</option>
                    <option value="Thunder">Thunder</option>
                    <option value="Firestorm">Firestorm</option>
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

              <button
                onClick={exportAttendancesToExcel}
                className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow flex items-center justify-center space-x-2"
              >
                <span>📊 Exportar Presenças (Excel)</span>
              </button>
            </div>

            {(() => {
              const athletesInSelectedClass = acceptedList.filter((a) => {
                const assigned = a.assignedClass || a.assigned_class || 'Flame';
                if (selectedClassFilter === 'Spark') return assigned === 'Spark' || assigned === 'Formação infantil';
                if (selectedClassFilter === 'Flame') return assigned === 'Flame' || assigned === 'Formação geral';
                if (selectedClassFilter === 'Fusion') return assigned === 'Fusion' || assigned === 'Formação avançada';
                if (selectedClassFilter === 'Thunder') return assigned === 'Thunder' || assigned === 'Pré-Representação';
                if (selectedClassFilter === 'Firestorm') return assigned === 'Firestorm' || assigned === 'Representação';
                return assigned === selectedClassFilter;
              });

              if (athletesInSelectedClass.length === 0) {
                return (
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
                    <p className="text-xs text-gray-400">Não existem atletas aceites nesta turma atualmente.</p>
                  </div>
                );
              }

              return athletesInSelectedClass.map((reg) => {
                const currentStatus = localAttendances[`${reg.id}_${selectedDate}`];

                return (
                  <div key={reg.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">
                        {reg.athleteName || reg.athlete_name || reg.fullName}
                      </h3>
                    </div>

                    <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end flex-wrap gap-y-1">
                      {/* Botão Presente (P) */}
                      <button
                        type="button"
                        onClick={() => handleSetAthleteStatus(reg.id, 'presente')}
                        className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                          currentStatus === 'presente'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        ✓ Presente (P)
                      </button>

                      {/* Botão Falta Justificada (FJ) */}
                      <button
                        type="button"
                        onClick={() => handleSetAthleteStatus(reg.id, 'justificado')}
                        className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                          currentStatus === 'justificado'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        FJ Justificada
                      </button>

                      {/* Botão Falta Não Justificada (FNJ) */}
                      <button
                        type="button"
                        onClick={() => handleSetAthleteStatus(reg.id, 'injustificado')}
                        className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                          currentStatus === 'injustificado'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        ✕ FNJ Não Justificada
                      </button>

                      {/* Botão Lesão (L) */}
                      <button
                        type="button"
                        onClick={() => handleSetAthleteStatus(reg.id, 'lesao')}
                        className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                          currentStatus === 'lesao'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        🤕 Lesão (L)
                      </button>
                    </div>
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
                    <option value="Spark">Spark</option>
                    <option value="Flame">Flame</option>
                    <option value="Fusion">Fusion</option>
                    <option value="Thunder">Thunder</option>
                    <option value="Firestorm">Firestorm</option>
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

        {/* SECÇÃO: CHAT */}
        {activeTab === 'communication' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[500px] overflow-hidden">
            
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
                    const name = athlete.athleteName || athlete.athlete_name || athlete.fullName;
                    return (
                      <option key={athlete.id} value={email}>
                        👤 EE: {athlete.parentName || athlete.parent_name} ({name})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

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