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
    if (val.includes(',')) {
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [val.trim()];
  }
  return [];
};

export function AppProvider({ children }) {
  const [registrations, setRegistrations] = useState([]);
  const [adultRegistrations, setAdultRegistrations] = useState([]);
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

  const [adultClasses, setAdultClasses] = useState([]);

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
          notifyButton: { enable: false },
        });

        await OneSignal.Notifications.requestPermission();

        OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
          const playerId = event.current.id;
          if (playerId) {
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
    fetchAdultRegistrations();
    fetchEvents();
    fetchEventAttendances();
    fetchAdultClasses();

    const checkActiveSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchCoachProfile(session.user);
      }
    };

    checkActiveSession();

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
    localStorage.setItem('scs_messages', JSON.stringify(messages));
  }, [messages]);

  const fetchRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setRegistrations(data);
    } catch (err) {
      console.error('Erro ao carregar atletas:', err.message);
    }
  };

  const fetchAdultRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('adult_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const normalizedAdults = data.map((item) => ({
          ...item,
          fullName: item.full_name || item.fullName || '',
          full_name: item.full_name || item.fullName || '',
          birthDate: item.birth_date || item.birthDate || '',
          birth_date: item.birth_date || item.birthDate || '',
          athleteCC: item.cc || item.athleteCC || item.athlete_cc || '',
          cc: item.cc || item.athleteCC || item.athlete_cc || '',
          postalCode: item.postal_code || item.postalCode || '',
          postal_code: item.postal_code || item.postalCode || '',
          paymentMode: item.payment_mode || item.paymentMode || 'Mensal',
          payment_mode: item.payment_mode || item.paymentMode || 'Mensal',
          accessCode: item.access_code || item.accessCode || '',
          access_code: item.access_code || item.accessCode || '',
        }));
        setAdultRegistrations(normalizedAdults);
      }
    } catch (err) {
      console.error('Erro ao carregar inscrições de adultos:', err.message);
    }
  };

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

  const fetchAdultClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('adult_classes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const formatted = data.map((c) => ({
          id: c.id,
          date: c.date,
          time: c.time,
          maxSeats: c.max_seats || c.maxSeats || 15,
          daysBefore: c.days_before || c.daysBefore || 1,
          enrolledParents: c.enrolled_parents || c.enrolledParents || []
        }));
        setAdultClasses(formatted);
      }
    } catch (err) {
      console.error('Erro ao processar aulas de adultos:', err.message);
    }
  };

  const addAdultClass = async (classData) => {
    try {
      const insertPayload = {
        date: classData.date,
        time: classData.time,
        max_seats: classData.max_seats || 15,
        days_before: classData.days_before || 1,
        enrolled_parents: classData.enrolled_parents || []
      };
      const { error } = await supabase.from('adult_classes').insert([insertPayload]);
      if (error) throw error;
      await fetchAdultClasses();
      return { success: true };
    } catch (err) {
      console.error('Erro ao adicionar aula de adultos:', err);
      return { success: false, message: err.message };
    }
  };

  const deleteAdultClass = async (classId) => {
    try {
      const { error } = await supabase.from('adult_classes').delete().eq('id', classId);
      if (error) throw error;
      await fetchAdultClasses();
    } catch (err) {
      console.error('Erro ao eliminar aula de adultos:', err);
    }
  };

  const bookAdultClass = async (classId, adultUserData, paymentMode = 'Mensal') => {
    try {
      const { data: currentClass, error: fetchError } = await supabase
        .from('adult_classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (fetchError) throw fetchError;

      // Se for Avulso, verificar se já atingiu o período de abertura permitido
      if (paymentMode !== 'Mensal') {
        const classDate = new Date(`${currentClass.date}T${currentClass.time || '00:00'}:00`);
        const allowedDaysBefore = currentClass.days_before || currentClass.daysBefore || 1;
        
        const openingDate = new Date(classDate.getTime());
        openingDate.setDate(openingDate.getDate() - allowedDaysBefore);
        openingDate.setHours(0, 0, 0, 0);

        const now = new Date();
        if (now < openingDate) {
          return { 
            success: false, 
            message: `Inscrição indisponível. Alunos avulso só podem inscrever-se ${allowedDaysBefore} dia(s) antes.` 
          };
        }
      }

      const currentEnrolled = Array.isArray(currentClass.enrolled_parents) 
        ? currentClass.enrolled_parents 
        : [];

      const alreadyEnrolled = currentEnrolled.some(p => p.id === adultUserData.id || p.email === adultUserData.email);
      if (alreadyEnrolled) {
        return { success: false, message: "Já se encontra inscrito nesta aula." };
      }

      const maxSeats = currentClass.max_seats || currentClass.maxSeats || 15;
      if (currentEnrolled.length >= maxSeats) {
        return { success: false, message: "Esta aula já atingiu o limite máximo de vagas." };
      }

      const updatedEnrolled = [...currentEnrolled, adultUserData];

      const { error: updateError } = await supabase
        .from('adult_classes')
        .update({ enrolled_parents: updatedEnrolled })
        .eq('id', classId);

      if (updateError) throw updateError;

      await fetchAdultClasses();
      return { success: true, message: "Inscrição efetuada com sucesso!" };

    } catch (err) {
      console.error("Erro ao inscrever na aula de adultos:", err.message);
      return { success: false, message: "Erro ao efetuar inscrição: " + err.message };
    }
  };

  const cancelAdultClassEnrollment = async (classId, adultId) => {
    try {
      const { data: currentClass, error: fetchError } = await supabase
        .from('adult_classes')
        .select('enrolled_parents')
        .eq('id', classId)
        .single();

      if (fetchError) throw fetchError;

      const currentEnrolled = Array.isArray(currentClass.enrolled_parents) 
        ? currentClass.enrolled_parents 
        : [];

      const updatedEnrolled = currentEnrolled.filter(p => p.id !== adultId);

      const { error: updateError } = await supabase
        .from('adult_classes')
        .update({ enrolled_parents: updatedEnrolled })
        .eq('id', classId);

      if (updateError) throw updateError;

      await fetchAdultClasses();
      return { success: true, message: "Inscrição cancelada com sucesso!" };
    } catch (err) {
      console.error("Erro ao cancelar inscrição:", err.message);
      return { success: false, message: err.message };
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase.from('events').select('*');
      if (error) throw error;

      if (data && Array.isArray(data)) {
        const formattedEvents = data.map((ev) => {
          if (!ev) return null;
          let eventName = ev.name || ev.title || ev.nome || ev.event_name;
          const eventDate = ev.date || ev.data || ev.event_date || 'Sem data';
          const location = ev.location || ev.local || '';
          const eventTime = ev.event_time || ev.time || '';
          const meetingTime = ev.meeting_time || ev.meetingTime || '';

          let parsedClasses = ensureArray(ev.target_classes || ev.targetClasses || ev.target_class);
          if (parsedClasses.length === 0) parsedClasses = ['Todas as Turmas'];

          let parsedCoaches = ensureArray(ev.coaches || ev.coach_names);
          let parsedSchedules = ensureArray(ev.schedules);

          return {
            id: ev.id || Math.random().toString(),
            name: String(eventName),
            date: String(eventDate),
            location,
            time: eventTime,
            event_time: eventTime,
            meetingTime,
            meeting_time: meetingTime,
            created_at: ev.created_at,
            targetClasses: parsedClasses,
            coaches: parsedCoaches,
            schedules: parsedSchedules,
            raw: ev
          };
        }).filter(Boolean);

        setEvents(formattedEvents);
      }
    } catch (err) {
      console.error('Erro ao processar eventos:', err);
    }
  };

  const generateSCSCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = '';
    for (let i = 0; i < 6; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return `SCS-${res}`;
  };

  const generateAdultSCSCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = '';
    for (let i = 0; i < 7; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return `SCS-${res}`;
  };

  const addRegistration = async (formData) => {
    const assignedCode = generateSCSCode();
    const generatedId = crypto.randomUUID ? crypto.randomUUID() : `reg_${Date.now()}`;

    const newReg = {
      id: generatedId,
      status: 'pending',
      assigned_class: formData.assigned_class || 'Formação geral',
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
    };

    try {
      const { error } = await supabase.from('registrations').insert([newReg]);
      if (error) throw error;
      await fetchRegistrations();
      return { success: true, message: 'Inscrição submetida com sucesso!', accessCode: assignedCode };
    } catch (err) {
      return { success: false, message: 'Erro: ' + err.message };
    }
  };

  const addAdultRegistration = async (formData) => {
    const assignedCode = generateAdultSCSCode();
    const generatedId = crypto.randomUUID ? crypto.randomUUID() : `adult_${Date.now()}`;

    const newAdultReg = {
      id: generatedId,
      status: 'pending',
      access_code: assignedCode,
      full_name: formData.athlete_name || formData.fullName || '',
      birth_date: formData.birth_date || formData.birthDate || '',
      gender: formData.gender || 'Masculino',
      cc: formData.athlete_cc || formData.cc || '',
      nif: formData.athlete_nif || formData.nif || '',
      address: formData.address || '',
      city: formData.city || '',
      postal_code: formData.postal_code || formData.postalCode || '',
      phone: formData.phone || '',
      email: formData.email || '',
      payment_mode: formData.adultClassesPaymentMode || formData.paymentMode || 'Mensal',
    };

    try {
      const { error } = await supabase.from('adult_registrations').insert([newAdultReg]);
      if (error) throw error;
      await fetchAdultRegistrations();
      return { success: true, message: 'Inscrição de adulto submetida com sucesso!', accessCode: assignedCode };
    } catch (err) {
      return { success: false, message: 'Erro: ' + err.message };
    }
  };

  const updateRegistrationStatus = async (id, status, reason = '', assignedClass = 'Formação geral') => {
    if (status === 'rejected') {
      try {
        await supabase.from('registrations').delete().eq('id', id);
        setRegistrations((prev) => prev.filter((reg) => reg.id !== id));
      } catch (err) {
        console.error('Erro ao rejeitar:', err);
      }
    } else {
      const athlete = registrations.find((r) => r.id === id);
      const finalCode = athlete?.access_code || generateSCSCode();
      const updates = { status: 'accepted', assigned_class: assignedClass, access_code: finalCode };

      try {
        await supabase.from('registrations').update(updates).eq('id', id);
        setRegistrations((prev) => prev.map((reg) => (reg.id === id ? { ...reg, ...updates } : reg)));
      } catch (err) {
        console.error('Erro ao aceitar:', err);
      }
    }
  };

  const removeAcceptedAthlete = async (id) => {
    try {
      await supabase.from('registrations').delete().eq('id', id);
      setRegistrations((prev) => prev.filter((reg) => reg.id !== id));
    } catch (err) {
      console.error('Erro ao remover atleta:', err);
    }
  };

  const updateRegistrationByParent = async (id, updatedData) => {
    try {
      await supabase.from('registrations').update(updatedData).eq('id', id);
      setRegistrations((prev) => prev.map((reg) => (reg.id === id ? { ...reg, ...updatedData } : reg)));
    } catch (err) {
      console.error('Erro ao atualizar:', err);
    }
  };

  const updateAdultRegistration = async (id, updatedData) => {
    try {
      await supabase.from('adult_registrations').update(updatedData).eq('id', id);
      await fetchAdultRegistrations();
    } catch (err) {
      console.error('Erro ao atualizar adulto:', err);
    }
  };

  const loginParentByCode = (code) => {
    if (!code) return { success: false, message: 'Insira o código.' };
    const cleanInput = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const registration = registrations.find((reg) => {
      const dbCode = (reg.access_code || reg.accessCode || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return dbCode === cleanInput;
    });

    if (!registration) return { success: false, message: 'Código de acesso não encontrado.' };
    if (registration.status !== 'accepted') return { success: false, message: 'Inscrição pendente de validação.' };
    return { success: true, registration };
  };

  const loginAdultByCode = (code) => {
    if (!code) return { success: false, message: 'Insira o código.' };
    const cleanInput = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const registration = adultRegistrations.find((reg) => {
      const dbCode = (reg.access_code || reg.accessCode || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return dbCode === cleanInput;
    });

    if (!registration) return { success: false, message: 'Código de acesso não encontrado.' };
    if (registration.status && registration.status !== 'accepted') return { success: false, message: 'Inscrição pendente de validação.' };
    return { success: true, registration };
  };

  const loginCoach = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, message: 'Email ou password incorretos.' };
      await fetchCoachProfile(data.user);
      return { success: true, coach: data.user };
    } catch (err) {
      return { success: false, message: 'Erro no login: ' + err.message };
    }
  };

  const logoutCoach = async () => {
    await supabase.auth.signOut();
    setCurrentCoach(null);
  };

  const toggleAttendance = (athleteId, date, forcedStatus = undefined) => {
    const key = `${athleteId}_${date}`;
    setAttendances((prev) => {
      let nextState;
      if (forcedStatus !== undefined) nextState = forcedStatus;
      else {
        const current = prev[key];
        if (current === 'presente') nextState = 'justificado';
        else if (current === 'justificado') nextState = 'injustificado';
        else if (current === 'injustificado') nextState = 'lesao';
        else if (current === 'lesao') nextState = null;
        else nextState = 'presente';
      }
      return { ...prev, [key]: nextState };
    });
  };

  const addEvent = async (eventData) => {
    try {
      const insertPayload = {
        name: eventData.name,
        date: eventData.date,
        location: eventData.location || '',
        event_time: eventData.time || '',
        meeting_time: eventData.meetingTime || '',
        target_class: eventData.targetClasses?.join(', ') || 'Formação geral',
        target_classes: ensureArray(eventData.targetClasses),
        coaches: ensureArray(eventData.coaches),
      };
      const { error } = await supabase.from('events').insert([insertPayload]);
      if (!error) await fetchEvents();
    } catch (err) {
      console.error('Erro ao adicionar evento:', err);
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      await supabase.from('events').delete().eq('id', eventId);
      await fetchEvents();
    } catch (err) {
      console.error('Erro ao eliminar evento:', err);
    }
  };

  const toggleEventAttendance = async (eventId, athleteId, forcedStatus = undefined) => {
    const key = `${eventId}_${athleteId}`;
    const newStatus = forcedStatus !== undefined ? forcedStatus : true;

    // Atualização otimista e imediata do estado local
    setEventAttendances((prev) => ({ ...prev, [key]: { status: newStatus } }));

    try {
      const payload = {
        event_id: String(eventId),
        athlete_id: String(athleteId),
        status: Boolean(newStatus),
      };

      const { error } = await supabase
        .from('event_attendances')
        .upsert(payload, { onConflict: 'event_id,athlete_id' });

      if (error) {
        console.error('Erro no Supabase ao atualizar presença:', error.message);
      }
    } catch (err) {
      console.error('Erro crítico na submissão da presença:', err);
    }
  };

  const sendMessage = async (msgObj) => {
    setMessages((prev) => [...prev, msgObj]);
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
      console.error('Erro ao enviar mensagem:', err);
    }
  };

  return (
    <AppContext.Provider
      value={{
        registrations,
        adultRegistrations,
        attendances,
        events,
        eventAttendances,
        adultClasses,
        messages,
        currentCoach,
        addRegistration,
        addAdultRegistration,
        updateRegistrationStatus,
        removeAcceptedAthlete,
        updateRegistrationByParent,
        updateAdultRegistration,
        loginParentByCode,
        loginAdultByCode,
        loginCoach,
        logoutCoach,
        toggleAttendance,
        addEvent,
        deleteEvent,
        fetchEvents,
        toggleEventAttendance,
        sendMessage,
        fetchRegistrations,
        fetchAdultRegistrations,
        addAdultClass,
        deleteAdultClass,
        fetchAdultClasses,
        bookAdultClass,
        cancelAdultClassEnrollment
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}