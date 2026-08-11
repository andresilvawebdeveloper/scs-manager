import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [registrations, setRegistrations] = useState([]);
  const [attendances, setAttendances] = useState(() => {
    const saved = localStorage.getItem('scs_attendances');
    return saved ? JSON.parse(saved) : {};
  });

  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('scs_events');
    return saved ? JSON.parse(saved) : [];
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

  // Carregar atletas do Supabase ao iniciar a app
  useEffect(() => {
    fetchRegistrations();
  }, []);

  useEffect(() => {
    localStorage.setItem('scs_attendances', JSON.stringify(attendances));
  }, [attendances]);

  useEffect(() => {
    localStorage.setItem('scs_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('scs_event_attendances', JSON.stringify(eventAttendances));
  }, [eventAttendances]);

  useEffect(() => {
    localStorage.setItem('scs_adult_classes', JSON.stringify(adultClasses));
  }, [adultClasses]);

  useEffect(() => {
    localStorage.setItem('scs_messages', JSON.stringify(messages));
  }, [messages]);

  // Função para procurar todos os atletas na base de dados
  const fetchRegistrations = async () => {
    try {
      const { data, error } = await supabase.from('registrations').select('*');
      if (error) throw error;
      if (data) setRegistrations(data);
    } catch (err) {
      console.error('Erro ao carregar atletas do Supabase:', err.message);
    }
  };

  const generateSCSCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `SCS-${randomPart}`;
  };

  // Submeter nova inscrição na nuvem
  const addRegistration = async (formData) => {
    const assignedCode = generateSCSCode();
    const newId = Date.now().toString();

    const newReg = {
      id: newId,
      ...formData,
      status: 'pending',
      accessCode: assignedCode,
      access_code: assignedCode,
    };

    try {
      const { error } = await supabase.from('registrations').insert([newReg]);
      if (error) throw error;

      setRegistrations((prev) => [newReg, ...prev]);
      return { 
        success: true, 
        message: 'Inscrição submetida com sucesso! Aguarde a validação do treinador.',
        accessCode: assignedCode
      };
    } catch (err) {
      console.error('Erro ao salvar inscrição no Supabase:', err.message);
      return { success: false, message: 'Erro ao conectar ao servidor: ' + err.message };
    }
  };

  // Treinador aceita ou rejeita no Supabase
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
      const finalCode = athlete?.accessCode || athlete?.access_code || generateSCSCode();

      const updates = {
        status: 'accepted',
        assignedClass: assignedClass,
        accessCode: finalCode,
        access_code: finalCode,
      };

      try {
        const { error } = await supabase.from('registrations').update(updates).eq('id', id);
        if (error) throw error;

        setRegistrations((prev) =>
          prev.map((reg) => (reg.id === id ? { ...reg, ...updates } : reg))
        );
      } catch (err) {
        console.error('Erro ao atualizar no Supabase:', err.message);
      }
    }
  };

  // Remover atleta aceite
  const removeAcceptedAthlete = async (id) => {
    try {
      await supabase.from('registrations').delete().eq('id', id);
      setRegistrations((prev) => prev.filter((reg) => reg.id !== id));
    } catch (err) {
      console.error('Erro ao remover atleta:', err.message);
    }
  };

  // Encarregado atualiza dados
  const updateRegistrationByParent = async (id, updatedData) => {
    try {
      const { error } = await supabase.from('registrations').update(updatedData).eq('id', id);
      if (error) throw error;

      setRegistrations((prev) =>
        prev.map((reg) => (reg.id === id ? { ...reg, ...updatedData } : reg))
      );
    } catch (err) {
      console.error('Erro ao atualizar dados pelo pai:', err.message);
    }
  };

  // Login do Encarregado via Supabase
  const loginParentByCode = (code) => {
    if (!code) {
      return { success: false, message: 'Por favor, insira o código de acesso.' };
    }

    const cleanInput = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    const registration = registrations.find((reg) => {
      const dbCodeRaw = reg.accessCode || reg.access_code || '';
      const cleanDbCode = dbCodeRaw.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return cleanDbCode === cleanInput && cleanDbCode.length > 0;
    });

    if (!registration) {
      return { 
        success: false, 
        message: 'Código de acesso não encontrado no sistema.' 
      };
    }

    if (registration.status !== 'accepted') {
      return { 
        success: false, 
        message: 'A sua inscrição ainda está pendente de validação pelo treinador.' 
      };
    }

    return { success: true, registration };
  };

  // Login do Treinador
  const loginCoach = (email, password) => {
    const authorizedCoaches = [
      { email: "treinador@ginastica.com", password: "password123", name: "Treinador Principal" }
    ];

    const coach = authorizedCoaches.find(
      (c) => c.email.toLowerCase() === email.toLowerCase() && c.password === password
    );

    if (coach) {
      return { success: true, coach };
    }
    return { success: false, message: "Email ou password incorretos." };
  };

  // Presenças
  const toggleAttendance = (athleteId, date) => {
    const key = `${athleteId}_${date}`;
    const current = attendances[key];
    
    let nextState = 'presente';
    if (current === 'presente') nextState = 'justificado';
    else if (current === 'justificado') nextState = 'injustificado';
    else if (current === 'injustificado') nextState = 'lesao';
    else if (current === 'lesao') nextState = null;

    setAttendances((prev) => ({
      ...prev,
      [key]: nextState,
    }));
  };

  // Eventos
  const addEvent = (eventData) => {
    const newEvent = {
      id: Date.now().toString(),
      ...eventData,
    };
    setEvents((prev) => [newEvent, ...prev]);
  };

  const deleteEvent = (eventId) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
  };

  const toggleEventAttendance = (eventId, athleteId) => {
    const key = `${eventId}_${athleteId}`;
    setEventAttendances((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Aulas Adultos
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

  // Chat
  const sendMessage = (msgObj) => {
    setMessages((prev) => [...prev, msgObj]);
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
        addRegistration,
        updateRegistrationStatus,
        removeAcceptedAthlete,
        updateRegistrationByParent,
        loginParentByCode,
        loginCoach,
        toggleAttendance,
        addEvent,
        deleteEvent,
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