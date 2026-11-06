import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import OneSignal from 'react-onesignal';
import { supabase } from '../services/supabaseClient';

const AppContext = createContext();

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

// Função para garantir que os números de telemóvel ficam no formato E.164 (+351...)
const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, ''); // Remove tudo o que não for dígito
  if (cleaned.length === 9) return `+351${cleaned}`;
  if (cleaned.startsWith('351') && cleaned.length === 12) return `+${cleaned}`;
  return phone.startsWith('+') ? phone : `+${cleaned}`;
};

export function AppProvider({ children }) {
  const [registrations, setRegistrations] = useState([]);
  const [adultRegistrations, setAdultRegistrations] = useState([]);
  const [events, setEvents] = useState([]);
  
  // Recupera o treinador do localStorage instantaneamente para sobreviver ao swipe no iPhone
  const [currentCoach, setCurrentCoach] = useState(() => {
    const saved = localStorage.getItem('scs_current_coach');
    return saved ? JSON.parse(saved) : null;
  });

  const [attendances, setAttendances] = useState({});

  const [eventAttendances, setEventAttendances] = useState({});

  const [adultClasses, setAdultClasses] = useState([]);

  const [messages, setMessages] = useState([]);

  // Perfis de treinador (lista pública para todos com sessão) e equipa completa (só treinadores)
  const [coachProfiles, setCoachProfiles] = useState([]);
  const [coachTeam, setCoachTeam] = useState([]);

  // Família com sessão iniciada (encarregado ou aluno adulto) — para saber que mensagens são "minhas"
  const [memberEmail, setMemberEmail] = useState(null);

  // Mensagens lidas por conversa (guardado no dispositivo)
  const [readMap, setReadMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem('scs_chat_read') || '{}'); } catch (e) { return {}; }
  });

  // refs para os callbacks de tempo real (evitam valores desatualizados)
  const identityRef = useRef({ coachId: null, memberEmail: null });
  const knownMessageIdsRef = useRef(null);

  // Função auxiliar para associar o utilizador ao OneSignal de forma persistente
  const setupOneSignalUser = async (user) => {
    try {
      if (user?.id) {
        await OneSignal.login(user.id);
        if (user.email) {
          OneSignal.User.setEmail(user.email);
        }
      }
    } catch (err) {
      console.error("Erro ao associar utilizador no OneSignal:", err);
    }
  };

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

        // Se já houver sessão ativa ao inicializar o OneSignal, associa o utilizador
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await setupOneSignalUser(session.user);
        }

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

  // Carrega os dados a que a sessão atual tem acesso. As permissões (RLS) são
  // aplicadas no Supabase: um visitante sem sessão não recebe dados pessoais,
  // um encarregado/adulto só recebe os seus e um treinador recebe tudo.
  const refreshData = () => {
    fetchRegistrations();
    fetchAdultRegistrations();
    fetchEvents();
    fetchEventAttendances();
    fetchAdultClasses();
    fetchAttendances();
    fetchMessages();
    fetchCoachProfiles();
  };

  const clearPrivateData = () => {
    setRegistrations([]);
    setAdultRegistrations([]);
    setEventAttendances({});
    setAdultClasses([]);
    setAttendances({});
    setMessages([]);
    setCoachProfiles([]);
    setCoachTeam([]);
    knownMessageIdsRef.current = null;
  };

  // Carregar dados iniciais e subscrever a alterações
  useEffect(() => {
    // Limpa caches antigas que guardavam dados no dispositivo
    localStorage.removeItem('scs_messages');
    localStorage.removeItem('scs_event_attendances');

    fetchEvents();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      // Não fazer chamadas ao Supabase diretamente dentro deste callback (pode bloquear o cliente)
      setTimeout(async () => {
        if (session?.user) {
          if (event === 'TOKEN_REFRESHED') return;
          await fetchCoachProfile(session.user);
          await setupOneSignalUser(session.user);
          refreshData();
        } else {
          setCurrentCoach(null);
          localStorage.removeItem('scs_current_coach');
          clearPrivateData();
          try {
            await OneSignal.logout();
          } catch (e) {}
        }
      }, 0);
    });

    const attendancesSubscription = supabase
      .channel('public:attendances')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, () => {
        fetchAttendances();
      })
      .subscribe();

    const messagesSubscription = supabase
      .channel('public:messages:context')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchMessages();
      })
      .subscribe();

    // Recurso caso o tempo real falhe: verifica mensagens novas a cada 30 s
    const poll = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) fetchMessages();
    }, 30000);

    return () => {
      authListener?.subscription?.unsubscribe();
      supabase.removeChannel(attendancesSubscription);
      supabase.removeChannel(messagesSubscription);
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    identityRef.current = { coachId: currentCoach?.id || null, memberEmail: memberEmail ? memberEmail.toLowerCase() : null };
  }, [currentCoach, memberEmail]);

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

      // Só é treinador quem tem perfil ativo na tabela coaches (encarregados entram por SMS e não têm)
      if (!coachProfile || coachProfile.active === false) {
        setCurrentCoach(authUser.email ? { id: authUser.id, email: authUser.email, noProfile: true } : null);
        localStorage.removeItem('scs_current_coach');
        return;
      }

      const coachData = {
        id: authUser.id,
        email: authUser.email,
        name: coachProfile?.name || '',
        displayName: coachProfile?.name || coachProfile?.email || authUser.email,
        bio: coachProfile?.bio || '',
        photo_url: coachProfile?.photo_url || '',
        classes: Array.isArray(coachProfile?.classes) ? coachProfile.classes : [],
        role: coachProfile?.role || (authUser.email === 'joana.meireles@gmail.com' ? 'admin' : 'coach'),
      };
      
      setCurrentCoach(coachData);
      localStorage.setItem('scs_current_coach', JSON.stringify(coachData)); // Guarda no localStorage para persistir após swipe
    } catch (err) {
      console.error('Erro ao carregar dados do treinador:', err.message);
    }
  };

  const normalizeMessage = (m) => {
    const familyEmail = (m.family_email || (m.sender === 'Coach' ? m.recipient_email : m.sender_email) || '').toLowerCase() || null;
    return {
      ...m,
      senderName: m.sender_name || m.senderName || m.sender,
      senderEmail: m.sender_email || m.senderEmail || '',
      recipientEmail: m.recipient_email || m.recipientEmail || 'all',
      familyEmail,
      coachId: m.coach_id || null,
      senderCoachId: m.sender_coach_id || null,
    };
  };

  // Chave da conversa: família + treinador (ou "club" = caixa do clube, todos os treinadores)
  const conversationKey = (familyEmail, coachId) => `${(familyEmail || '').toLowerCase()}|${coachId || 'club'}`;
  const messageConversationKey = (m) => conversationKey(m.familyEmail, m.coachId);

  const isMyMessage = (m, identity = identityRef.current) => {
    if (m.sender === 'Coach') return !!identity.coachId && String(m.senderCoachId) === String(identity.coachId);
    return !!identity.memberEmail && (m.senderEmail || '').toLowerCase() === identity.memberEmail;
  };

  const showMessageNotification = (m) => {
    try {
      if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
      const title = m.sender === 'Coach' && m.familyEmail === 'all'
        ? `📢 Comunicado do clube (${m.senderName})`
        : `💬 Nova mensagem de ${m.senderName || (m.sender === 'Coach' ? 'Treinador' : 'Encarregado')}`;
      new Notification(title, { body: String(m.text || '').slice(0, 140), icon: '/logo.png', tag: `scs-msg-${m.id}` });
    } catch (e) {}
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (data) {
        const list = data.map(normalizeMessage);
        // Notificação no dispositivo para mensagens novas que não são minhas
        const known = knownMessageIdsRef.current;
        if (known) {
          list.filter((m) => !known.has(String(m.id)) && !isMyMessage(m)).forEach(showMessageNotification);
        }
        knownMessageIdsRef.current = new Set(list.map((m) => String(m.id)));
        setMessages(list);
      }
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err.message);
    }
  };

  const markConversationRead = (key) => {
    setReadMap((prev) => {
      const next = { ...prev, [key]: new Date().toISOString() };
      try { localStorage.setItem('scs_chat_read', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const unreadCount = (key) => {
    const since = readMap[key] ? new Date(readMap[key]).getTime() : 0;
    return messages.filter((m) =>
      messageConversationKey(m) === key && !isMyMessage(m) &&
      new Date(m.created_at || 0).getTime() > since
    ).length;
  };

  // ---------- Perfis de treinador ----------
  const fetchCoachProfiles = async () => {
    try {
      const { data, error } = await supabase.rpc('scs_list_coaches');
      if (error) throw error;
      setCoachProfiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao carregar treinadores:', err.message);
    }
  };

  const fetchCoachTeam = async () => {
    try {
      const { data, error } = await supabase.from('coaches').select('*').order('name', { ascending: true });
      if (error) throw error;
      setCoachTeam(data || []);
    } catch (err) {
      console.error('Erro ao carregar equipa técnica:', err.message);
    }
  };

  const updateMyCoachProfile = async (fields) => {
    if (!currentCoach?.id) return { success: false, message: 'Sem sessão de treinador.' };
    const payload = {};
    ['name', 'bio', 'photo_url', 'classes'].forEach((k) => { if (fields[k] !== undefined) payload[k] = fields[k]; });
    if (payload.name !== undefined) payload.name = String(payload.name).trim();
    try {
      const { error } = await supabase.from('coaches').update(payload).eq('id', currentCoach.id);
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await fetchCoachProfile(user);
      fetchCoachProfiles();
      fetchCoachTeam();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const addCoachByEmail = async (email, name) => {
    try {
      const { error } = await supabase.rpc('scs_add_coach', { p_email: email, p_name: name || null });
      if (error) throw error;
      await fetchCoachTeam();
      fetchCoachProfiles();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const setCoachActive = async (coachId, active) => {
    try {
      const { error } = await supabase.from('coaches').update({ active }).eq('id', coachId);
      if (error) throw error;
      await fetchCoachTeam();
      fetchCoachProfiles();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const fetchAttendances = async () => {
    try {
      const { data, error } = await supabase.from('attendances').select('*');
      if (error) throw error;

      if (data) {
        const loadedMap = {};
        data.forEach((item) => {
          const key = `${item.athlete_id}_${item.date}`;
          loadedMap[key] = item.status;
        });
        setAttendances(loadedMap);
      }
    } catch (err) {
      console.error('Erro ao carregar presenças:', err.message);
    }
  };

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
          photo_url: item.photo_url || item.photoUrl || '',
          photoUrl: item.photo_url || item.photoUrl || '',
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
          loadedMap[key] = { status: item.status, present: item.present };
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

      const currentEnrolled = Array.isArray(currentClass.enrolled_parents) ? currentClass.enrolled_parents : [];
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

      const currentEnrolled = Array.isArray(currentClass.enrolled_parents) ? currentClass.enrolled_parents : [];
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
      phone: formatPhoneNumber(formData.phone || ''),
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
      phone: formatPhoneNumber(formData.phone || ''),
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

  // Mapeia os nomes do formulário (camelCase) para as colunas da base de dados
  const PARENT_FIELD_MAP = {
    athleteName: 'athlete_name', athleteNIF: 'athlete_nif', athleteCC: 'athlete_cc',
    parentName: 'parent_name', postalCode: 'postal_code', photoUrl: 'photo_url',
    tracksuitSize: 'tracksuit_size', officialTshirtSize: 'official_tshirt_size',
    redTshirtSize: 'red_tshirt_size', yellowTshirtSize: 'yellow_tshirt_size',
  };
  const ADULT_FIELD_MAP = {
    fullName: 'full_name', athleteName: 'full_name', athlete_name: 'full_name',
    athleteNIF: 'nif', athlete_nif: 'nif', athleteCC: 'cc', athlete_cc: 'cc',
    postalCode: 'postal_code', photoUrl: 'photo_url', paymentMode: 'payment_mode',
    adultClassesPaymentMode: 'payment_mode',
  };

  const toDbColumns = (data, fieldMap) => {
    const out = {};
    const entries = Object.entries(data || {}).filter(([, value]) => value !== undefined);
    // 1.º as colunas tal como vêm da base de dados (snake_case)...
    entries.filter(([key]) => !fieldMap[key]).forEach(([key, value]) => { out[key] = value; });
    // ...depois os campos do formulário (camelCase), que são os valores editados e têm prioridade
    entries.filter(([key]) => fieldMap[key]).forEach(([key, value]) => { out[fieldMap[key]] = value; });
    if (out.phone) out.phone = formatPhoneNumber(out.phone);
    return out;
  };

  // Edição da ficha pelo próprio encarregado (kind 'parent') ou aluno adulto (kind 'adult').
  // Passa por uma função no Supabase que só aceita campos permitidos e só a própria ficha.
  const updateMyRegistration = async (kind, id, updatedData) => {
    const changes = toDbColumns(updatedData, kind === 'adult' ? ADULT_FIELD_MAP : PARENT_FIELD_MAP);
    try {
      const { data, error } = await supabase.rpc('scs_update_my_registration', {
        p_id: String(id),
        p_kind: kind,
        p_changes: changes,
      });
      if (error) throw error;
      if (!data) throw new Error('A ficha não foi encontrada.');
      return { success: true, registration: data };
    } catch (err) {
      console.error('Erro ao atualizar ficha:', err);
      return { success: false, message: err.message || 'Não foi possível guardar as alterações.' };
    }
  };

  const updateRegistrationByParent = (id, updatedData) => updateMyRegistration('parent', id, updatedData);

  // Usado pelo treinador (ex.: aceitar inscrição de adulto)
  const updateAdultRegistration = async (id, updatedData) => {
    try {
      const payload = toDbColumns(updatedData, ADULT_FIELD_MAP);

      const { error } = await supabase
        .from('adult_registrations')
        .update(payload)
        .eq('id', id);

      if (error) throw error;

      await fetchAdultRegistrations();
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar adulto:', err);
      return { success: false, message: err.message };
    }
  };

  // Passo 1 do login: confirma o código no servidor (só devolve estado e telemóvel)
  const lookupAccessCode = async (code, kind) => {
    if (!code || !code.trim()) return { success: false, message: 'Insira o código.' };
    try {
      const { data, error } = await supabase.rpc('scs_lookup_access_code', { p_code: code.trim(), p_kind: kind });
      if (error) throw error;
      const found = Array.isArray(data) ? data[0] : data;
      if (!found) return { success: false, message: 'Código de acesso não encontrado.' };
      if ((found.status || 'pending') !== 'accepted') return { success: false, message: 'Inscrição pendente de validação.' };
      return { success: true, phone: found.phone };
    } catch (err) {
      console.error('Erro ao validar código:', err);
      return { success: false, message: 'Não foi possível validar o código. Tente novamente.' };
    }
  };

  const loginParentByCode = (code) => lookupAccessCode(code, 'parent');
  const loginAdultByCode = (code) => lookupAccessCode(code, 'adult');

  // Passo 3 (depois do SMS validado): obter a ficha completa
  const getMyRegistration = async (code, kind) => {
    try {
      const { data, error } = await supabase.rpc('scs_get_my_registration', { p_code: code.trim(), p_kind: kind });
      if (error) throw error;
      if (!data) return { success: false, message: 'Não foi possível abrir a ficha. O telemóvel validado não corresponde a esta inscrição.' };
      setMemberEmail(data.email || null);
      identityRef.current = { ...identityRef.current, memberEmail: (data.email || '').toLowerCase() || null };
      return { success: true, registration: data };
    } catch (err) {
      console.error('Erro ao obter ficha:', err);
      return { success: false, message: 'Não foi possível abrir a ficha. Tente novamente.' };
    }
  };

  // Saída do encarregado / aluno adulto: termina a sessão SMS e limpa os dados do dispositivo
  const logoutMember = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    setMemberEmail(null);
    clearPrivateData();
  };

  // Enviar código SMS via Supabase OTP
  const sendSmsVerification = async (phone) => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error("Erro ao enviar SMS:", err);
      return { success: false, message: err.message || "Falha ao enviar SMS de verificação." };
    }
  };

  // Validar código SMS de 6 dígitos inserido pelo utilizador
  const verifySmsCode = async (phone, token) => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: token.trim(),
        type: 'sms'
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error("Erro ao verificar SMS:", err);
      return { success: false, message: err.message || "Código SMS inválido ou expirado." };
    }
  };

  const loginCoach = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, message: 'Email ou password incorretos.' };
      await fetchCoachProfile(data.user);
      await setupOneSignalUser(data.user);
      return { success: true, coach: data.user };
    } catch (err) {
      return { success: false, message: 'Erro no login: ' + err.message };
    }
  };

  const logoutCoach = async () => {
    try {
      await OneSignal.logout();
    } catch (e) {}
    await supabase.auth.signOut();
    setCurrentCoach(null);
    localStorage.removeItem('scs_current_coach');
  };

  const toggleAttendance = async (athleteId, date, forcedStatus = undefined) => {
    const key = `${athleteId}_${date}`;
    const current = attendances[key];
    let nextState;

    if (forcedStatus !== undefined) {
      nextState = forcedStatus;
    } else {
      if (current === 'presente') nextState = 'justificado';
      else if (current === 'justificado') nextState = 'injustificado';
      else if (current === 'injustificado') nextState = 'lesao';
      else if (current === 'lesao') nextState = null;
      else nextState = 'presente';
    }

    setAttendances((prev) => ({ ...prev, [key]: nextState }));

    try {
      if (nextState === null) {
        await supabase
          .from('attendances')
          .delete()
          .match({ athlete_id: String(athleteId), date: String(date) });
      } else {
        await supabase
          .from('attendances')
          .upsert({
            athlete_id: String(athleteId),
            date: String(date),
            status: nextState,
            updated_at: new Date().toISOString()
          }, { onConflict: 'athlete_id,date' });
      }
    } catch (err) {
      console.error('Erro ao salvar presença no Supabase:', err);
    }
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

  // Grava um campo da presença no evento sem tocar no outro:
  //   status  = resposta do encarregado (true = vai, false = não vai)
  //   present = presença real marcada pelo treinador (true / false / null = por marcar)
  const saveEventAttendanceField = async (eventId, athleteId, field, value) => {
    const key = `${eventId}_${athleteId}`;
    let previous;
    setEventAttendances((prev) => {
      previous = prev[key];
      return { ...prev, [key]: { ...(prev[key] || {}), [field]: value } };
    });

    try {
      const { error } = await supabase
        .from('event_attendances')
        .upsert(
          { event_id: String(eventId), athlete_id: String(athleteId), [field]: value },
          { onConflict: 'event_id,athlete_id' }
        );
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('Erro ao gravar presença no evento:', err.message || err);
      // repõe o estado anterior para o ecrã não mostrar algo que não ficou gravado
      setEventAttendances((prev) => {
        const next = { ...prev };
        if (previous === undefined) delete next[key];
        else next[key] = previous;
        return next;
      });
      return { success: false, message: err.message || 'Erro ao gravar.' };
    }
  };

  // Resposta do encarregado de educação
  const toggleEventAttendance = (eventId, athleteId, willAttend) =>
    saveEventAttendanceField(eventId, athleteId, 'status', Boolean(willAttend));

  // Presença real marcada pelo treinador
  const setEventPresence = (eventId, athleteId, present) =>
    saveEventAttendanceField(eventId, athleteId, 'present', present === null ? null : Boolean(present));

  // Envia uma mensagem e pede ao servidor as notificações (push + email) dos destinatários.
  //   familyEmail: email da família da conversa ('all' = comunicado geral)
  //   coachId:     treinador da conversa privada (null = caixa do clube)
  const sendMessage = async ({ text, familyEmail, coachId = null, senderEmail, senderName }) => {
    const fromCoach = !!currentCoach?.id && !currentCoach.noProfile;
    const clean = String(text || '').trim();
    if (!clean) return { success: false, message: 'Mensagem vazia.' };
    const family = (fromCoach ? familyEmail : senderEmail || familyEmail || '').toLowerCase();
    const row = {
      sender: fromCoach ? 'Coach' : 'Parent',
      sender_name: fromCoach ? (currentCoach.name || currentCoach.displayName || 'Treinador') : (senderName || 'Encarregado'),
      sender_email: fromCoach ? null : family,
      sender_coach_id: fromCoach ? currentCoach.id : null,
      recipient_email: fromCoach ? family : 'Coach',
      family_email: family,
      coach_id: coachId || null,
      text: clean,
      timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('pt-PT'),
    };
    const tempId = `local_${Date.now()}`;
    setMessages((prev) => [...prev, normalizeMessage({ ...row, id: tempId, created_at: new Date().toISOString() })]);
    try {
      const { data, error } = await supabase.from('messages').insert([row]).select('id').single();
      if (error) throw error;
      if (knownMessageIdsRef.current) knownMessageIdsRef.current.add(String(data.id));
      // As notificações não bloqueiam o envio
      supabase.functions.invoke('notify-new-message', { body: { message_id: data.id } })
        .catch((e) => console.error('Notificação não enviada:', e));
      await fetchMessages();
      return { success: true, id: data.id };
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return { success: false, message: err.message || 'Erro ao enviar mensagem.' };
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
        sendSmsVerification,
        verifySmsCode,
        loginCoach,
        logoutCoach,
        toggleAttendance,
        addEvent,
        deleteEvent,
        fetchEvents,
        toggleEventAttendance,
        setEventPresence,
        fetchEventAttendances,
        sendMessage,
        fetchMessages,
        coachProfiles,
        fetchCoachProfiles,
        coachTeam,
        fetchCoachTeam,
        updateMyCoachProfile,
        addCoachByEmail,
        setCoachActive,
        conversationKey,
        messageConversationKey,
        isMyMessage,
        markConversationRead,
        unreadCount,
        memberEmail,
        getMyRegistration,
        updateMyRegistration,
        logoutMember,
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