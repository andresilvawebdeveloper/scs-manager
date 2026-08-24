import React, { createContext, useContext, useState, useEffect } from 'react';
import OneSignal from 'react-onesignal';
import { supabase } from '../services/supabaseClient';

const AppContext = createContext();

// Função auxiliar para converter qualquer tipo de dado num Array válido de texto
const ensureArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    // Se for uma string separada por vírgulas ou texto simples
    if (val.includes(',')) {
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [val.trim()];
  }
  return [];
};

// Função auxiliar para invocar a Edge Function de envio de Push Notifications
const triggerPushNotification = async ({ playerIds, title, message, url }) => {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: { playerIds, title, message, url }
    });
    if (error) {
      console.error('Erro ao invocar Edge Function de Notificação Push:', error.message);
    }
  } catch (err) {
    console.error('Falha de ligação ao enviar notificação Push:', err);
  }
};

export function AppProvider({ children }) {
  const [registrations, setRegistrations] = useState([]);
  const [events, setEvents] = useState([]);
  const [currentCoach, setCurrentCoach] = useState(null);

  const [attendances, setAttendances] = useState(() => {
    const saved = localStorage.getItem('scs_attendances');
    return saved ? JSON.parse(saved) : {};
  });

  const [eventAttendances, setEventAttendances] = useState(() => {
    const saved = localStorage.getItem('scs_event_attendances');
    return saved ? JSON.parse(saved) : {};
  });

  const [adultClasses, setAdultClasses] = useState(() => {
    const saved = localStorage.getItem('scs_adult_classes');
    return saved ? JSON.parse(saved) : [];
  });

  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('scs_messages');
    return saved ? JSON.parse(saved) : [];
  });

  // Inicialização do OneSignal para Notificações Push no Telemóvel
  useEffect(() => {
    const initOneSignal = async () => {
      try {
        const appId = import.meta.env.VITE_ONESIGNAL_APP_ID || "a9ae2382-1991-495c-9f01-650eb76397d5";

        await OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: false,
          },
        });

        // Pedir permissão ao utilizador
        await OneSignal.Notifications.requestPermission();

        // Escutar alterações na subscrição para guardar o Player ID do dispositivo
        OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
          const playerId = event.current.id;
          if (playerId) {
            console.log("OneSignal Player ID do Dispositivo:", playerId);
            localStorage.setItem('scs_onesignal_player_id', playerId);
            
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.email) {
              await supabase
                .from('registrations')
                .update({ onesignal_player_id: playerId })
                .eq('email', session.user.email);
            }
          }
        });
      } catch (err) {
        console.error("Erro na inicialização do OneSignal:", err);
      }
    };

    initOneSignal();
  }, []);

  // Carregar dados iniciais e subscrever a alterações de sessão no Supabase
  useEffect(() => {
    fetchRegistrations();
    fetchEvents();
    fetchEventAttendances();

    // 1. Verificar sessão ativa no Supabase Auth
    const checkActiveSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchCoachProfile(session.user);
      }
    };

    checkActiveSession();

    // 2. Escutar alterações do estado de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchCoachProfile(session.user);
      } else {
        setCurrentCoach(null);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Procurar o perfil/role do treinador na tabela 'coaches'
  const fetchCoachProfile = async (authUser) => {
    try {
      const { data: coachProfile, error } = await supabase
        .from('coaches')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao procurar perfil na tabela coaches:', error.message);
      }

      const coachData = {
        id: authUser.id,
        email: authUser.email,
        name: coachProfile?.email || authUser.email,
        role: coachProfile?.role || (authUser.email === 'joana.meireles@gmail.com' ? 'admin' : 'coach'),
      };

      setCurrentCoach(coachData);
    } catch (err) {
      console.error('Erro ao carregar dados do treinador:', err.message);
    }
  };

  useEffect(() => {
    localStorage.setItem('scs_attendances', JSON.stringify(attendances));
  }, [attendances]);

  useEffect(() => {
    localStorage.setItem('scs_event_attendances', JSON.stringify(eventAttendances));
  }, [eventAttendances]);

  useEffect(() => {
    localStorage.setItem('scs_adult_classes', JSON.stringify(adultClasses));
  }, [adultClasses]);

  useEffect(() => {
    localStorage.setItem('scs_messages', JSON.stringify(messages));
  }, [messages]);

  // Função para procurar todas as inscrições no Supabase
  const fetchRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro no Supabase:', error.message);
        return;
      }
      if (data) {
        setRegistrations(data);
      }
    } catch (err) {
      console.error('Erro ao carregar atletas:', err.message);
    }
  };

  // Carregar presenças a eventos guardadas na base de dados
  const fetchEventAttendances = async () => {
    try {
      const { data, error } = await supabase.from('event_attendances').select('*');
      if (error) throw error;
      
      if (data) {
        const loadedMap = {};
        data.forEach((item) => {
          const key = `${item.event_id}_${item.athlete_id}`;
          loadedMap[key] = { status: item.status };
        });
        setEventAttendances(loadedMap);
      }
    } catch (err) {
      console.error('Erro ao carregar presenças a eventos:', err.message);
    }
  };

  // 100% SUPABASE: Leitura ultra-segura e imune a erros de formato
  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*');

      if (error) {
        console.error('Erro ao procurar na tabela events:', error.message);
        return;
      }

      console.log("Dados puros recebidos do Supabase:", data);

      if (data && Array.isArray(data)) {
        const formattedEvents = data.map((ev) => {
          if (!ev) return null;

          // 1. Obter Nome do Evento
          let eventName = ev.name || ev.title || ev.nome || ev.event_name || ev.description || ev.nome_evento;
          if (!eventName) {
            const textKey = Object.keys(ev).find(
              k => k !== 'id' && k !== 'created_at' && typeof ev[k] === 'string' && ev[k].trim() !== ''
            );
            eventName = textKey ? ev[textKey] : `Evento #${ev.id || 'Sem ID'}`;
          }

          // 2. Obter Data do Evento
          const eventDate = ev.date || ev.data || ev.event_date || ev.created_at || 'Sem data';

          // 3. Obter Local e Horários (Mapeamento flexível)
          const location = ev.location || ev.local || ev.place || '';
          const eventTime = ev.event_time || ev.time || ev.startTime || ev.start_time || '';
          const meetingTime = ev.meeting_time || ev.meetingTime || ev.pontoEncontro || '';

          // 4. Obter Turmas Convocadas
          let rawClasses = ev.target_classes || ev.targetClasses || ev.target_class || ev.targetClass;
          let parsedClasses = ensureArray(rawClasses);
          if (parsedClasses.length === 0) {
            parsedClasses = ['Todas as Turmas'];
          }

          // 5. Obter Treinadores Convocados
          let rawCoaches = ev.coaches || ev.coach_names || ev.coachesList;
          let parsedCoaches = ensureArray(rawCoaches);

          // 6. Obter Horários Genéricos
          let rawSchedules = ev.schedules || ev.horario || ev.horarios;
          let parsedSchedules = ensureArray(rawSchedules);
          if (parsedSchedules.length === 0 && !eventTime && !meetingTime) {
            parsedSchedules = ['Horário a definir'];
          }

          return {
            id: ev.id || Math.random().toString(),
            name: String(eventName),
            date: String(eventDate),
            location: location,
            time: eventTime,
            event_time: eventTime,
            meetingTime: meetingTime,
            meeting_time: meetingTime,
            created_at: ev.created_at,
            targetClasses: parsedClasses,
            coaches: parsedCoaches,
            schedules: parsedSchedules,
            raw: ev
          };
        }).filter(Boolean);

        console.log("Eventos formatados e prontos:", formattedEvents);
        setEvents(formattedEvents);
      }
    } catch (err) {
      console.error('Erro ao processar eventos:', err);
    }
  };

  // Gerador de Código de Acesso no formato SCS-XXXXXX
  const generateSCSCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `SCS-${randomPart}`;
  };

  // Submeter nova inscrição no Supabase
  const addRegistration = async (formData) => {
    const assignedCode = generateSCSCode();
    const generatedId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `reg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newReg = {
      id: generatedId,
      status: 'pending',
      assigned_class: 'Formação geral',
      access_code: assignedCode,
      athlete_name: formData.athlete_name || formData.athleteName || '',
      birth_date: formData.birth_date || formData.birthDate || '',
      gender: formData.gender || 'Masculino',
      athlete_cc: formData.athlete_cc || formData.athleteCC || '',
      athlete_nif: formData.athlete_nif || formData.athleteNIF || '',
      parent_name: formData.parent_name || formData.parentName || '',
      parent_cc: formData.parent_cc || formData.parentCC || '',
      email: formData.email || '',
      phone: formData.phone || '',
      address: formData.address || '',
      postal_code: formData.postal_code || formData.postalCode || '',
      city: formData.city || '',
      member_number: formData.member_number || formData.memberNumber || '',
      member_type: formData.member_type || formData.memberType || 'Atleta',
      tracksuitSize: formData.tracksuitSize || 'Não pretendo / Não preciso',
      officialTshirtSize: formData.officialTshirtSize || 'Não pretendo / Não preciso',
      redTshirtSize: formData.redTshirtSize || 'Não pretendo / Não preciso',
      yellowTshirtSize: formData.yellowTshirtSize || 'Não pretendo / Não preciso',
      adultClassesInterest: formData.adultClassesInterest || 'Não',
      adultClassesParticipants: formData.adultClassesParticipants || 'Pai',
      adultClassesPaymentMode: formData.adultClassesPaymentMode || 'Avulso',
    };

    try {
      const { data, error } = await supabase
        .from('registrations')
        .insert([newReg])
        .select();

      if (error) {
        console.error('Erro ao inserir no Supabase:', error.message);
        return { success: false, message: 'Erro na base de dados: ' + error.message };
      }

      await fetchRegistrations();

      return { 
        success: true, 
        message: 'Inscrição submetida com sucesso! Aguarde a validação do treinador.',
        accessCode: assignedCode
      };
    } catch (err) {
      console.error('Falha de ligação:', err.message);
      return { 
        success: false, 
        message: 'Erro ao conectar à base de dados: ' + err.message 
      };
    }
  };

  // Treinador aceita ou rejeita
  const updateRegistrationStatus = async (id, status, reason = '', assignedClass = 'Formação geral') => {
    if (status === 'rejected') {
      try {
        const { error } = await supabase.from('registrations').delete().eq('id', id);
        if (error) throw error;
        setRegistrations((prev) => prev.filter((reg) => reg.id !== id));
      } catch (err) {
        console.error('Erro ao rejeitar no Supabase:', err.message);
      }
    } else {
      const athlete = registrations.find((r) => r.id === id);
      const finalCode = athlete?.access_code || athlete?.accessCode || generateSCSCode();

      const updates = {
        status: 'accepted',
        assigned_class: assignedClass,
        access_code: finalCode,
      };

      try {
        const { error } = await supabase.from('registrations').update(updates).eq('id', id);
        if (error) throw error;

        setRegistrations((prev) =>
          prev.map((reg) => (reg.id === id ? { ...reg, ...updates } : reg))
        );
      } catch (err) {
        console.error('Erro ao aceitar atleta no Supabase:', err.message);
      }
    }
  };

  // Remover atleta do plantel
  const removeAcceptedAthlete = async (id) => {
    try {
      const { error } = await supabase.from('registrations').delete().eq('id', id);
      if (error) throw error;
      setRegistrations((prev) => prev.filter((reg) => reg.id !== id));
    } catch (err) {
      console.error('Erro ao remover atleta:', err.message);
    }
  };

  // Encarregado de Educação atualiza os seus dados
  const updateRegistrationByParent = async (id, updatedData) => {
    const payload = {
      ...updatedData,
      athlete_nif: updatedData.athlete_nif || updatedData.athleteNIF || '',
    };

    try {
      const { error } = await supabase.from('registrations').update(payload).eq('id', id);
      if (error) throw error;

      setRegistrations((prev) =>
        prev.map((reg) => (reg.id === id ? { ...reg, ...payload } : reg))
      );
    } catch (err) {
      console.error('Erro ao atualizar dados pelo encarregado:', err.message);
    }
  };

  // Login do Encarregado de Educação via Código de Acesso
  const loginParentByCode = (code) => {
    if (!code) {
      return { success: false, message: 'Por favor, insira o código de acesso.' };
    }

    const cleanInput = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    const registration = registrations.find((reg) => {
      const dbCodeRaw = reg.access_code || reg.accessCode || '';
      const cleanDbCode = dbCodeRaw.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return cleanDbCode === cleanInput && cleanDbCode.length > 0;
    });

    if (!registration) {
      return { 
        success: false, 
        message: 'Código de acesso não encontrado. Confirme se escreveu exatamente como aparece no painel do treinador.' 
      };
    }

    if (registration.status !== 'accepted') {
      return { 
        success: false, 
        message: 'A sua inscrição ainda está pendente de validação pelo treinador.' 
      };
    }

    // 🔔 Associar o OneSignal Player ID do dispositivo ao atleta no Supabase em segundo plano
    try {
      let playerId = localStorage.getItem('scs_onesignal_player_id');
      if (!playerId && typeof OneSignal !== 'undefined' && OneSignal.User?.PushSubscription?.id) {
        playerId = OneSignal.User.PushSubscription.id;
      }

      if (playerId) {
        supabase
          .from('registrations')
          .update({ onesignal_player_id: playerId })
          .eq('id', registration.id)
          .then(() => {
            console.log(`OneSignal Player ID (${playerId}) associado à inscrição ${registration.id}`);
            setRegistrations((prev) =>
              prev.map((r) => (r.id === registration.id ? { ...r, onesignal_player_id: playerId } : r))
            );
          });
      }
    } catch (err) {
      console.error("Erro ao guardar OneSignal Player ID no login do pai:", err);
    }

    return { success: true, registration };
  };

  // Login do Treinador via Supabase Auth
  const loginCoach = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, message: 'Email ou password incorretos.' };
      }

      await fetchCoachProfile(data.user);

      return { success: true, coach: data.user };
    } catch (err) {
      console.error('Erro na autenticação:', err.message);
      return { success: false, message: 'Erro ao efetuar login: ' + err.message };
    }
  };

  // Terminar Sessão do Treinador
  const logoutCoach = async () => {
    await supabase.auth.signOut();
    setCurrentCoach(null);
  };

  // Marcação de Presenças (Aceita definição direta de estado ou modo ciclo)
  const toggleAttendance = (athleteId, date, forcedStatus = undefined) => {
    const key = `${athleteId}_${date}`;
    
    setAttendances((prev) => {
      let nextState;

      if (forcedStatus !== undefined) {
        nextState = forcedStatus;
      } else {
        const current = prev[key];
        if (current === 'presente') nextState = 'justificado';
        else if (current === 'justificado') nextState = 'injustificado';
        else if (current === 'injustificado') nextState = 'lesao';
        else if (current === 'lesao') nextState = null;
        else nextState = 'presente';
      }

      return {
        ...prev,
        [key]: nextState,
      };
    });
  };

  // 100% SUPABASE: Criar Evento + Disparo de Notificação Push
  const addEvent = async (eventData) => {
    const targetClassesList = ensureArray(eventData.targetClasses || eventData.target_classes);
    const coachesList = ensureArray(eventData.coaches || eventData.coaches_list);
    const schedulesList = ensureArray(eventData.schedules);
    const fallbackTargetClass = targetClassesList.join(', ') || 'Formação geral';

    const locationValue = eventData.location || '';
    const timeValue = eventData.time || eventData.event_time || '';
    const meetingTimeValue = eventData.meetingTime || eventData.meeting_time || '';

    // Enviar estritamente as colunas existentes na base de dados
    const insertPayload = {
      name: eventData.name,
      date: eventData.date,
      location: locationValue,
      event_time: timeValue,
      meeting_time: meetingTimeValue,
      target_class: fallbackTargetClass,
      target_classes: targetClassesList,
      coaches: coachesList,
      schedules: schedulesList
    };

    if (eventData.id) {
      insertPayload.id = String(eventData.id);
    }

    try {
      const { error } = await supabase
        .from('events')
        .insert([insertPayload]);

      if (error) {
        console.error('Erro ao gravar evento no Supabase:', error.message);
        alert('Erro ao gravar evento no Supabase: ' + error.message);
      } else {
        await fetchEvents();

        // 🔔 NOTIFICAÇÃO PUSH AUTO: Obter Player IDs dos pais das turmas alvo
        const eligibleParents = registrations.filter((r) => {
          if (r.status !== 'accepted') return false;
          const assigned = r.assigned_class || r.assignedClass || 'Flame';
          if (targetClassesList.includes('Todas as Turmas')) return true;
          return targetClassesList.includes(assigned);
        });

        const targetPlayerIds = eligibleParents
          .map((p) => p.onesignal_player_id)
          .filter(Boolean);

        triggerPushNotification({
          playerIds: targetPlayerIds.length > 0 ? targetPlayerIds : undefined,
          title: `🏆 Novo Evento: ${eventData.name}`,
          message: `Foi agendado um novo evento para o dia ${eventData.date}. Confirme já a presença do seu educando!`
        });
      }
    } catch (err) {
      console.error('Falha na ligação:', err.message);
    }
  };

  // 100% SUPABASE: Eliminar Evento
  const deleteEvent = async (eventId) => {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) {
        console.error('Erro ao eliminar evento no Supabase:', error.message);
      } else {
        await fetchEvents();
      }
    } catch (err) {
      console.error('Falha ao eliminar evento:', err.message);
    }
  };

  // Função ligada ao Supabase para sincronizar a confirmação de presença a eventos
  const toggleEventAttendance = async (eventId, athleteId, forcedStatus = undefined) => {
    const key = `${eventId}_${athleteId}`;
    
    const current = eventAttendances[key];
    const currentStatus = typeof current === 'object' ? current?.status : current;
    
    const newStatus = forcedStatus !== undefined ? forcedStatus : !currentStatus;

    // 1. Atualização imediata do estado local
    setEventAttendances((prev) => ({
      ...prev,
      [key]: { status: newStatus },
    }));

    // 2. Gravação imediata na tabela do Supabase
    try {
      const { error } = await supabase
        .from('event_attendances')
        .upsert({
          event_id: String(eventId),
          athlete_id: String(athleteId),
          status: newStatus,
        }, { onConflict: 'event_id, athlete_id' });

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao sincronizar presença no Supabase:', err.message);
    }
  };

  // Gestão de Aulas de Adultos
  const addAdultClass = (classData) => {
    setAdultClasses((prev) => [classData, ...prev]);
  };

  const deleteAdultClass = (classId) => {
    setAdultClasses((prev) => prev.filter((c) => c.id !== classId));
  };

  const enrollInAdultClass = (classId, parentInfo) => {
    setAdultClasses((prev) =>
      prev.map((c) => {
        if (c.id === classId) {
          const alreadyEnrolled = (c.enrolledParents || []).some(
            (p) => p.id === parentInfo.id || p.email === parentInfo.email
          );
          if (alreadyEnrolled) return c;
          if ((c.enrolledParents || []).length >= c.maxSeats) return c;

          return {
            ...c,
            enrolledParents: [...(c.enrolledParents || []), parentInfo]
          };
        }
        return c;
      })
    );
  };

  const cancelAdultClassEnrollment = (classId, parentId) => {
    setAdultClasses((prev) =>
      prev.map((c) => {
        if (c.id === classId) {
          return {
            ...c,
            enrolledParents: (c.enrolledParents || []).filter((p) => p.id !== parentId)
          };
        }
        return c;
      })
    );
  };

  // Enviar Mensagem no Chat + Guardar no Supabase + Notificação Push (WhatsApp Style)
  const sendMessage = async (msgObj) => {
    setMessages((prev) => [...prev, msgObj]);

    // 1. Gravar mensagem na tabela 'messages' do Supabase
    try {
      await supabase.from('messages').insert([{
        sender: msgObj.sender,
        sender_name: msgObj.senderName || msgObj.sender,
        recipient_email: msgObj.recipientEmail || 'all',
        text: msgObj.text || msgObj.message || '',
        timestamp: msgObj.timestamp || new Date().toISOString(),
        date: msgObj.date || new Date().toLocaleDateString('pt-PT')
      }]);
    } catch (err) {
      console.error('Erro ao guardar mensagem na base de dados:', err);
    }

    // 2. DISPARAR NOTIFICAÇÃO PUSH AUTOMÁTICA
    const isFromCoach = msgObj.sender === 'Coach';
    let targetPlayerIds = [];

    if (isFromCoach) {
      if (msgObj.recipientEmail === 'all') {
        // Enviar para todos os pais subscritos
        targetPlayerIds = registrations
          .filter((r) => r.status === 'accepted' && r.onesignal_player_id)
          .map((r) => r.onesignal_player_id);
      } else {
        // Enviar para o encarregado específico
        const targetParent = registrations.find(
          (r) => (r.email || r.parentEmail || r.parent_email) === msgObj.recipientEmail
        );
        if (targetParent?.onesignal_player_id) {
          targetPlayerIds = [targetParent.onesignal_player_id];
        }
      }

      triggerPushNotification({
        playerIds: targetPlayerIds.length > 0 ? targetPlayerIds : undefined,
        title: `💬 Mensagem do Treinador`,
        message: msgObj.text || msgObj.message || 'Nova mensagem do clube'
      });
    } else {
      // Se for o Pai a enviar mensagem para o Treinador
      triggerPushNotification({
        title: `💬 Nova mensagem de ${msgObj.senderName || 'Encarregado'}`,
        message: msgObj.text || msgObj.message || 'Respondeu no chat do clube'
      });
    }
  };

  return (
    <AppContext.Provider
      value={{
        registrations,
        attendances,
        events,
        eventAttendances,
        adultClasses,
        messages,
        currentCoach,
        addRegistration,
        updateRegistrationStatus,
        removeAcceptedAthlete,
        updateRegistrationByParent,
        loginParentByCode,
        loginCoach,
        logoutCoach,
        toggleAttendance,
        addEvent,
        deleteEvent,
        fetchEvents,
        toggleEventAttendance,
        addAdultClass,
        deleteAdultClass,
        enrollInAdultClass,
        cancelAdultClassEnrollment,
        sendMessage,
        fetchRegistrations
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}