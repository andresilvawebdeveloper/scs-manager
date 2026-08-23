import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../services/supabaseClient';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function Dashboard({ onLogout }) {
  const { 
    currentCoach,
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

  const isAdmin = currentCoach?.role === 'admin';

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
  const [expandedEventId, setExpandedEventId] = useState(null);

  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventMeetingTime, setNewEventMeetingTime] = useState('');
  const [newEventClasses, setNewEventClasses] = useState(['Flame']);
  const [newEventCoaches, setNewEventCoaches] = useState([]);

  const availableCoaches = [
    'Joana', 'Susana', 'Ricardo', 'Pedro', 'Marta', 'Sofia', 'Inês', 'Maria'
  ];

  const [parentClassDate, setParentClassDate] = useState('');
  const [parentClassTime, setParentClassTime] = useState('18:15 - 19:00');
  const [parentClassMaxSeats, setParentClassMaxSeats] = useState(15);

  const [chatTarget, setChatTarget] = useState('all');
  const [chatText, setChatText] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Estados para Gestão do Perfil do Treinador
  const [profileEmail, setProfileEmail] = useState(currentCoach?.email || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Estado do Modal/Popup de Novas Respostas a Eventos
  const [showEventResponsesModal, setShowEventResponsesModal] = useState(false);
  const [newResponsesSummary, setNewResponsesSummary] = useState([]);

  useEffect(() => {
    if (currentCoach?.email) {
      setProfileEmail(currentCoach.email);
    }
  }, [currentCoach]);

  // Lógica de verificação de novas respostas a eventos (AJUSTADA PARA APARECER Apenas 1 VEZ)
  useEffect(() => {
    if (!events || events.length === 0 || !eventAttendances) return;

    // Obter IDs de eventos já visualizados a partir do localStorage
    const seenEventIds = JSON.parse(localStorage.getItem('scs_seen_event_responses') || '[]');
    const unseenSummaries = {};

    Object.entries(eventAttendances).forEach(([key, attendanceData]) => {
      const [eventId, athleteId] = key.split('_');
      
      // Se este evento já foi visualizado pelo treinador, ignora
      if (seenEventIds.includes(String(eventId))) return;

      const event = events.find((e) => String(e.id) === String(eventId));
      const athlete = registrations.find((r) => String(r.id) === String(athleteId));

      if (event && athlete) {
        const isAttending = typeof attendanceData === 'object' ? attendanceData.status : attendanceData;
        const athleteClass = athlete.assignedClass || athlete.assigned_class || 'Flame';

        if (!unseenSummaries[event.name]) {
          unseenSummaries[event.name] = {
            id: event.id,
            date: event.date,
            classes: {}
          };
        }

        if (!unseenSummaries[event.name].classes[athleteClass]) {
          unseenSummaries[event.name].classes[athleteClass] = [];
        }

        unseenSummaries[event.name].classes[athleteClass].push({
          athleteName: athlete.athleteName || athlete.athlete_name || athlete.fullName,
          parentName: athlete.parentName || athlete.parent_name || 'Encarregado',
          isAttending: !!isAttending
        });
      }
    });

    if (Object.keys(unseenSummaries).length > 0) {
      setNewResponsesSummary(unseenSummaries);
      setShowEventResponsesModal(true);
    }
  }, [events, eventAttendances, registrations]);

  // Função para fechar o modal e registar que já foi visto
  const handleCloseResponsesModal = () => {
    const seenEventIds = JSON.parse(localStorage.getItem('scs_seen_event_responses') || '[]');
    const newSeenIds = Object.values(newResponsesSummary).map((ev) => String(ev.id));
    const updatedSeen = Array.from(new Set([...seenEventIds, ...newSeenIds]));

    localStorage.setItem('scs_seen_event_responses', JSON.stringify(updatedSeen));
    setShowEventResponsesModal(false);
  };

  // Estado para o Switch no separador de Atletas Ativos ('athletes' | 'birthdays')
  const [acceptedSubView, setAcceptedSubView] = useState('athletes');

  // Estado para filtro de aniversários (0 = Todos, 1 a 12 = Meses)
  const [selectedBirthdayMonth, setSelectedBirthdayMonth] = useState('all');

  // Estado local sincronizado para garantir fidelidade visual e na exportação
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

  const toggleExpandEvent = (eventId) => {
    setExpandedEventId((prev) => (prev === eventId ? null : eventId));
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
    const assignedClass = selectedClasses[regId] || 'Spark';
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

  const handleToggleEventClass = (className) => {
    setNewEventClasses((prev) =>
      prev.includes(className)
        ? prev.filter((c) => c !== className)
        : [...prev, className]
    );
  };

  const handleToggleEventCoach = (coachName) => {
    setNewEventCoaches((prev) =>
      prev.includes(coachName)
        ? prev.filter((c) => c !== coachName)
        : [...prev, coachName]
    );
  };

  const handleCreateEvent = (e) => {
    e.preventDefault();
    if (!newEventName.trim() || !newEventDate) return;
    if (newEventClasses.length === 0) {
      alert('Selecione pelo menos uma turma para o evento.');
      return;
    }
    
    addEvent({
      name: newEventName.trim(),
      date: newEventDate,
      location: newEventLocation.trim(),
      time: newEventTime,
      event_time: newEventTime,
      meetingTime: newEventMeetingTime,
      meeting_time: newEventMeetingTime,
      targetClasses: newEventClasses,
      targetClass: newEventClasses.join(', '),
      coaches: newEventCoaches,
    });

    setNewEventName('');
    setNewEventDate('');
    setNewEventLocation('');
    setNewEventTime('');
    setNewEventMeetingTime('');
    setNewEventClasses(['Flame']);
    setNewEventCoaches([]);
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

  // Função para Atualizar os Dados Pessoais do Treinador no Supabase
  const handleUpdateCoachProfile = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);

    try {
      const updates = {};
      
      if (profileEmail && profileEmail !== currentCoach?.email) {
        updates.email = profileEmail;
      }
      if (profilePassword.trim()) {
        if (profilePassword.length < 6) {
          alert('A nova password deve conter pelo menos 6 caracteres.');
          setIsUpdatingProfile(false);
          return;
        }
        updates.password = profilePassword;
      }

      if (Object.keys(updates).length === 0) {
        alert('Nenhuma alteração detetada.');
        setIsUpdatingProfile(false);
        return;
      }

      const { data, error } = await supabase.auth.updateUser(updates);

      if (error) {
        throw error;
      }

      if (updates.email && currentCoach?.id) {
        await supabase
          .from('coaches')
          .update({ email: updates.email })
          .eq('id', currentCoach.id);
      }

      alert('Dados atualizados com sucesso! ' + (updates.email ? 'Se alterou o email, confirme o novo endereço na caixa de entrada.' : ''));
      setProfilePassword('');
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err.message);
      alert('Erro ao atualizar perfil: ' + err.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleOpenPrivateChat = (email) => {
    setChatTarget(email);
    setActiveTab('communication');
  };

  const activeParentClassesList = adultClasses || localAdultClasses;

  const allMessagesList = messages || [];
  const currentChatMessages = allMessagesList.filter(
    (m) => chatTarget === 'all' ? m.recipientEmail === 'all' : (m.recipientEmail === chatTarget || m.senderEmail === chatTarget || m.recipient_email === chatTarget)
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

  // Nomes dos meses em Português
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Agrupar Aniversários dos Atletas Ativos por Mês
  const birthdaysByMonth = acceptedList.reduce((acc, athlete) => {
    const birthDateRaw = athlete.birthDate || athlete.birth_date;
    if (!birthDateRaw) return acc;

    const parts = birthDateRaw.split('-'); // Esperado AAAA-MM-DD
    if (parts.length >= 2) {
      const monthIdx = parseInt(parts[1], 10) - 1; // 0-11
      if (!isNaN(monthIdx) && monthIdx >= 0 && monthIdx < 12) {
        if (!acc[monthIdx]) acc[monthIdx] = [];
        acc[monthIdx].push(athlete);
      }
    }
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
      
      {/* POPUP / MODAL DE NOVAS RESPOSTAS A EVENTOS */}
      {showEventResponsesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🔔</span>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Novas Respostas a Eventos</h3>
                  <p className="text-xs text-gray-500">Respostas submetidas pelos encarregados de educação</p>
                </div>
              </div>
              <button
                onClick={handleCloseResponsesModal}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-4 pr-1">
              {Object.entries(newResponsesSummary).map(([eventName, eventInfo]) => (
                <div key={eventName} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider">{eventName}</h4>
                    <span className="text-[10px] font-semibold text-gray-500 bg-white px-2 py-0.5 rounded border">
                      📅 {eventInfo.date}
                    </span>
                  </div>

                  {Object.entries(eventInfo.classes).map(([className, responses]) => (
                    <div key={className} className="space-y-1.5 pl-1">
                      <span className="text-[11px] font-bold text-clubRed block">
                        Turma: {className}
                      </span>
                      <ul className="space-y-1">
                        {responses.map((resp, idx) => (
                          <li key={idx} className="text-xs flex justify-between items-center bg-white p-2 rounded-lg border border-gray-100">
                            <span className="font-medium text-gray-800">
                              {resp.athleteName} <span className="text-gray-400 font-normal">({resp.parentName})</span>
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              resp.isAttending ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {resp.isAttending ? '✓ Presente' : '✕ Ausente'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={handleCloseResponsesModal}
                className="w-full py-3 bg-clubRed hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow"
              >
                Compreendido
              </button>
            </div>
          </div>
        </div>
      )}

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
              <h3 className="text-xs font-bold text-gray-900">Pais</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-7 gap-1 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200 text-center">
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
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all ${
              activeTab === 'profile' ? 'bg-clubRed text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Perfil 👤
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

                    {isAdmin ? (
                      <>
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
                      </>
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-xl text-center border border-gray-200">
                        <span className="text-xs text-gray-500 font-medium">
                          🔒 Modo Leitura: Apenas a Treinadora Principal pode aprovar ou rejeitar fichas.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* SECÇÃO: ATLETAS ACEITES ORGANIZADOS POR TURMA OU ANIVERSÁRIOS (COM SWITCH) */}
        {activeTab === 'accepted' && (
          <div className="space-y-6">
            
            {/* SWITCH DE NAVEGAÇÃO ENTRE VISTAS */}
            <div className="flex bg-gray-200/80 p-1 rounded-xl w-full sm:w-auto self-start border border-gray-300">
              <button
                onClick={() => setAcceptedSubView('athletes')}
                className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  acceptedSubView === 'athletes'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🏃‍♂️ Atletas Ativos na Equipa
              </button>
              <button
                onClick={() => setAcceptedSubView('birthdays')}
                className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  acceptedSubView === 'birthdays'
                    ? 'bg-clubRed text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🎂 Aniversários
              </button>
            </div>

            {/* VISTA 1: LISTA DE ATLETAS ATIVOS ORGANIZADOS POR TURMA */}
            {acceptedSubView === 'athletes' && (
              <div className="space-y-6">
                <h2 className="font-bold text-gray-800 text-sm">Atletas Ativos na Equipa</h2>
                
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

                                  {isAdmin && (
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
                                  )}
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
                                      👨‍gsub‍👧 Encarregado de Educação & Contactos
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

            {/* VISTA 2: PAINEL DE ANIVERSÁRIOS */}
            {acceptedSubView === 'birthdays' && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">🎂</span>
                    <div>
                      <h2 className="font-bold text-gray-900 text-sm">Aniversários dos Atletas</h2>
                      <p className="text-[11px] text-gray-500">Lista organizada e filtrável por mês</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Filtrar Mês:</label>
                    <select
                      value={selectedBirthdayMonth}
                      onChange={(e) => setSelectedBirthdayMonth(e.target.value)}
                      className="p-2 border border-gray-300 rounded-xl text-xs font-semibold bg-gray-50 focus:outline-none w-full sm:w-auto"
                    >
                      <option value="all">📅 Todos os Meses</option>
                      {monthNames.map((name, idx) => (
                        <option key={idx} value={idx}>
                          {name} ({birthdaysByMonth[idx]?.length || 0})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Lista de Aniversários */}
                <div className="space-y-4">
                  {(() => {
                    const monthsToDisplay = selectedBirthdayMonth === 'all' 
                      ? Array.from({ length: 12 }, (_, i) => i) 
                      : [parseInt(selectedBirthdayMonth, 10)];

                    const hasBirthdays = monthsToDisplay.some(m => birthdaysByMonth[m] && birthdaysByMonth[m].length > 0);

                    if (!hasBirthdays) {
                      return (
                        <p className="text-xs text-gray-400 py-2 text-center">
                          Nenhum aniversário registado para o período selecionado.
                        </p>
                      );
                    }

                    return monthsToDisplay.map((mIdx) => {
                      const list = birthdaysByMonth[mIdx] || [];
                      if (list.length === 0) return null;

                      const sortedList = [...list].sort((a, b) => {
                        const dayA = parseInt((a.birthDate || a.birth_date || '').split('-')[2] || 0, 10);
                        const dayB = parseInt((b.birthDate || b.birth_date || '').split('-')[2] || 0, 10);
                        return dayA - dayB;
                      });

                      return (
                        <div key={mIdx} className="space-y-2">
                          <h3 className="text-xs font-bold text-clubRed uppercase tracking-wider bg-red-50 px-3 py-1.5 rounded-lg inline-block">
                            {monthNames[mIdx]}
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {sortedList.map((athlete) => {
                              const name = athlete.athleteName || athlete.athlete_name || athlete.fullName;
                              const birth = athlete.birthDate || athlete.birth_date || 'N/D';
                              const parts = birth.split('-');
                              const formattedDayMonth = parts.length === 3 ? `${parts[2]}/${parts[1]}` : birth;

                              return (
                                <div key={athlete.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex justify-between items-center">
                                  <div className="truncate pr-2">
                                    <p className="font-bold text-xs text-gray-800 truncate">{name}</p>
                                    <p className="text-[10px] text-gray-500">Nascimento: {birth}</p>
                                  </div>
                                  <span className="text-xs font-extrabold text-clubRed bg-white px-2 py-1 rounded-md border border-gray-200 whitespace-nowrap shadow-2xs">
                                    🎂 {formattedDayMonth}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
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
              <form onSubmit={handleCreateEvent} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Local do Evento</label>
                  <input
                    type="text"
                    placeholder="Ex: Pavilhão Municipal de Sintra"
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Hora de Início do Evento</label>
                  <input
                    type="time"
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Hora do Ponto de Encontro</label>
                  <input
                    type="time"
                    value={newEventMeetingTime}
                    onChange={(e) => setNewEventMeetingTime(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs bg-white"
                  />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-[11px] font-medium text-gray-600">Turmas Alvo (Selecione uma ou mais)</label>
                  <div className="flex flex-wrap gap-2">
                    {['Spark', 'Flame', 'Fusion', 'Thunder', 'Firestorm'].map((cls) => {
                      const isSelected = newEventClasses.includes(cls);
                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => handleToggleEventClass(cls)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                            isSelected
                              ? 'bg-clubRed text-white border-clubRed shadow-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{cls}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-[11px] font-medium text-gray-600">Treinadores Convocados / Presentes</label>
                  <div className="flex flex-wrap gap-2">
                    {availableCoaches.map((coach) => {
                      const isSelected = newEventCoaches.includes(coach);
                      return (
                        <button
                          key={coach}
                          type="button"
                          onClick={() => handleToggleEventCoach(coach)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{coach}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2 pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-clubRed hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition shadow"
                  >
                    Guardar e Criar Evento
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h2 className="font-bold text-gray-800 text-sm">📅 Eventos Agendados</h2>
                <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-lg">
                  {events.length} {events.length === 1 ? 'Evento' : 'Eventos'}
                </span>
              </div>

              {events.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">
                  Ainda não existem eventos ou competições agendadas.
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((ev) => {
                    const classesList = ev.targetClasses 
                      ? (Array.isArray(ev.targetClasses) ? ev.targetClasses : [ev.targetClasses])
                      : (ev.targetClass ? ev.targetClass.split(', ') : []);

                    let coachesList = [];
                    if (Array.isArray(ev.coaches)) {
                      coachesList = ev.coaches;
                    } else if (typeof ev.coaches === 'string' && ev.coaches.trim() !== '') {
                      coachesList = ev.coaches.split(',').map((c) => c.trim());
                    }

                    const eventLocation = ev.location || ev.event_location;
                    const eventTime = ev.time || ev.event_time;
                    const meetingTime = ev.meetingTime || ev.meeting_time;

                    const isEventExpanded = expandedEventId === ev.id;

                    const eligibleAthletes = acceptedList.filter((athlete) => {
                      const athleteClass = athlete.assignedClass || athlete.assigned_class || 'Flame';
                      if (classesList.includes('Todas as Turmas')) return true;
                      return classesList.some((target) => {
                        if (target === 'Spark') return athleteClass === 'Spark' || athleteClass === 'Formação infantil';
                        if (target === 'Flame') return athleteClass === 'Flame' || athleteClass === 'Formação geral';
                        if (target === 'Fusion') return athleteClass === 'Fusion' || athleteClass === 'Formação avançada';
                        if (target === 'Thunder') return athleteClass === 'Thunder' || athleteClass === 'Pré-Representação';
                        if (target === 'Firestorm') return athleteClass === 'Firestorm' || athleteClass === 'Representação';
                        return athleteClass === target;
                      });
                    });

                    const eventAthletesByClass = eligibleAthletes.reduce((acc, athlete) => {
                      const cls = athlete.assignedClass || athlete.assigned_class || 'Flame';
                      if (!acc[cls]) acc[cls] = [];
                      acc[cls].push(athlete);
                      return acc;
                    }, {});

                    const confirmedCount = eligibleAthletes.filter(
                      (a) => eventAttendances[`${ev.id}_${a.id}`]
                    ).length;

                    return (
                      <div key={ev.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <h3 className="font-bold text-gray-900 text-sm">{ev.name}</h3>
                              <span className="text-[10px] bg-white border border-gray-300 font-semibold px-2 py-0.5 rounded-md text-gray-600">
                                📅 {ev.date}
                              </span>
                              {eventTime && (
                                <span className="text-[10px] bg-blue-50 border border-blue-200 font-semibold px-2 py-0.5 rounded-md text-blue-700">
                                  ⏰ Início: {eventTime}
                                </span>
                              )}
                              {meetingTime && (
                                <span className="text-[10px] bg-amber-50 border border-amber-200 font-semibold px-2 py-0.5 rounded-md text-amber-700">
                                  📍 Encontro: {meetingTime}
                                </span>
                              )}
                            </div>

                            {eventLocation && (
                              <p className="text-[11px] text-gray-600 font-medium">
                                📍 <span className="font-semibold text-gray-800">{eventLocation}</span>
                              </p>
                            )}

                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                              <span className="text-[11px] font-medium text-gray-500">Turmas:</span>
                              {classesList.map((cls, idx) => (
                                <span key={idx} className="text-[10px] bg-red-100 text-clubRed font-bold px-2 py-0.5 rounded-md">
                                  {cls}
                                </span>
                              ))}
                            </div>

                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 pt-0.5">
                              <span className="text-[11px] font-medium text-gray-500">Treinadores:</span>
                              {coachesList.length > 0 ? (
                                coachesList.map((coach, idx) => (
                                  <span key={idx} className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                                    {coach}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-gray-400 italic">Nenhum definido</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 self-end sm:self-center">
                            <button
                              onClick={() => toggleExpandEvent(ev.id)}
                              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1"
                            >
                              <span>📋 Presenças ({confirmedCount}/{eligibleAthletes.length})</span>
                            </button>

                            {isAdmin && deleteEvent && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Tem a certeza que pretende eliminar o evento "${ev.name}"?`)) {
                                    deleteEvent(ev.id);
                                  }
                                }}
                                className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-lg font-bold transition"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>

                        {isEventExpanded && (
                          <div className="pt-3 border-t border-gray-200 space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
                            <div className="flex justify-between items-center border-b pb-2">
                              <h4 className="font-bold text-xs text-gray-800 uppercase tracking-wider">
                                🏃 Chamada de Atletas para o Evento
                              </h4>
                              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                                {confirmedCount} Presentes de {eligibleAthletes.length} Convocados
                              </span>
                            </div>

                            {eligibleAthletes.length === 0 ? (
                              <p className="text-xs text-gray-400 py-2 text-center">
                                Não existem atletas ativos nas turmas convocadas para este evento.
                              </p>
                            ) : (
                              <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                                {Object.entries(eventAthletesByClass).map(([className, athletesInGroup]) => (
                                  <div key={className} className="space-y-2">
                                    <div className="bg-gray-100 px-3 py-1.5 rounded-lg flex justify-between items-center">
                                      <span className="text-xs font-bold text-gray-800 flex items-center space-x-1.5">
                                        <span className="w-2 h-2 rounded-full bg-clubRed"></span>
                                        <span>Turma {className}</span>
                                      </span>
                                      <span className="text-[10px] text-gray-500 font-medium">
                                        {athletesInGroup.filter(a => eventAttendances[`${ev.id}_${a.id}`]).length} / {athletesInGroup.length}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                                      {athletesInGroup.map((athlete) => {
                                        const key = `${ev.id}_${athlete.id}`;
                                        const isAttending = !!eventAttendances[key];
                                        const name = athlete.athleteName || athlete.athlete_name || athlete.fullName;

                                        return (
                                          <div
                                            key={athlete.id}
                                            className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition"
                                          >
                                            <div className="truncate pr-2">
                                              <p className="font-bold text-xs text-gray-800 truncate">{name}</p>
                                            </div>

                                            <div className="flex items-center space-x-1.5">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (!isAttending) toggleEventAttendance(ev.id, athlete.id);
                                                }}
                                                title="Marcar como Presente / Vai"
                                                className={`w-8 h-8 rounded-lg font-extrabold text-sm flex items-center justify-center transition border ${
                                                  isAttending
                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-105'
                                                    : 'bg-white text-emerald-600 border-gray-200 hover:bg-emerald-50 opacity-60'
                                                }`}
                                              >
                                                ✓
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (isAttending) toggleEventAttendance(ev.id, athlete.id);
                                                }}
                                                title="Marcar como Faltou / Não vai"
                                                className={`w-8 h-8 rounded-lg font-extrabold text-sm flex items-center justify-center transition border ${
                                                  !isAttending
                                                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm scale-105'
                                                    : 'bg-white text-rose-600 border-gray-200 hover:bg-rose-50 opacity-60'
                                                }`}
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
                          {isCoach ? 'Treinador' : msg.senderName || msg.sender_name || 'Encarregado'}
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

        {/* SECÇÃO: PERFIL DO TREINADOR */}
        {activeTab === 'profile' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900 text-base">Dados Pessoais do Treinador</h2>
                <p className="text-xs text-gray-500">Atualize o seu endereço de email ou a sua palavra-passe de acesso</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                {isAdmin ? '👑 Administrador' : '👟 Treinador'}
              </span>
            </div>

            <form onSubmit={handleUpdateCoachProfile} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Endereço de Email:
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-clubRed"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nova Palavra-passe:
                </label>
                <input
                  type="password"
                  placeholder="Deixe em branco para não alterar"
                  value={profilePassword}
                  onChange={(e) => setProfilePassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-clubRed"
                />
                <span className="text-[10px] text-gray-400 block mt-1">
                  Mínimo de 6 caracteres se desejar alterar.
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="w-full sm:w-auto px-6 py-3 bg-clubRed hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow disabled:opacity-50"
                >
                  {isUpdatingProfile ? 'A guardar alterações...' : 'Guardar Dados Pessoais'}
                </button>
              </div>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}