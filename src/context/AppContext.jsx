import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [registrations, setRegistrations] = useState(() => {
    const saved = localStorage.getItem('scs_registrations');
    return saved ? JSON.parse(saved) : [];
  });

  const [attendances, setAttendances] = useState(() => {
    const saved = localStorage.getItem('scs_attendances');
    return saved ? JSON.parse(saved) : {};
  });

  // Estado para os Eventos do Clube
  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('scs_events');
    return saved ? JSON.parse(saved) : [];
  });

  // Estado para o controlo de presença/participação nos eventos
  const [eventAttendances, setEventAttendances] = useState(() => {
    const saved = localStorage.getItem('scs_event_attendances');
    return saved ? JSON.parse(saved) : {};
  });

  // Estado para Aulas de Pais/Adultos
  const [adultClasses, setAdultClasses] = useState(() => {
    const saved = localStorage.getItem('scs_adult_classes');
    return saved ? JSON.parse(saved) : [];
  });

  // Estado para Mensagens do Chat
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('scs_messages');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('scs_registrations', JSON.stringify(registrations));
  }, [registrations]);

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

  // Função utilitária para gerar código de acesso
  const generateSCSCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `SCS-${randomPart}`;
  };

  // Submeter nova inscrição
  const addRegistration = (formData) => {
    const exists = registrations.some(
      (reg) =>
        reg.athleteName?.trim().toLowerCase() === formData.athleteName?.trim().toLowerCase() &&
        reg.birthDate === formData.birthDate
    );

    if (exists) {
      return { 
        success: false, 
        message: `O atleta ${formData.athleteName} já se encontra inscrito no sistema.` 
      };
    }

    const assignedCode = generateSCSCode();

    const newReg = {
      id: Date.now().toString(),
      ...formData,
      status: 'pending', // pending, accepted, rejected
      accessCode: assignedCode,
      access_code: assignedCode,
      createdAt: new Date().toISOString(),
    };

    setRegistrations((prev) => {
      const updated = [newReg, ...prev];
      localStorage.setItem('scs_registrations', JSON.stringify(updated));
      return updated;
    });

    return { 
      success: true, 
      message: 'Inscrição submetida com sucesso! Aguarde a validação do treinador.',
      accessCode: assignedCode
    };
  };

  // Treinador aceita ou rejeita
  const updateRegistrationStatus = (id, status, reason = '', assignedClass = 'Formação geral') => {
    if (status === 'rejected') {
      setRegistrations((prev) => {
        const updated = prev.filter((reg) => reg.id !== id);
        localStorage.setItem('scs_registrations', JSON.stringify(updated));
        return updated;
      });
    } else {
      setRegistrations((prev) => {
        const updated = prev.map((reg) => {
          if (reg.id === id) {
            const finalCode = reg.accessCode || reg.access_code || generateSCSCode();
            return { 
              ...reg, 
              status: 'accepted', 
              accessCode: finalCode,
              access_code: finalCode,
              rejectionReason: reason,
              assignedClass: assignedClass 
            };
          }
          return reg;
        });

        // Gravação síncrona imediata no localStorage
        localStorage.setItem('scs_registrations', JSON.stringify(updated));
        return updated;
      });
    }
  };

  // Remover atleta aceite do clube
  const removeAcceptedAthlete = (id) => {
    setRegistrations((prev) => {
      const updated = prev.filter((reg) => reg.id !== id);
      localStorage.setItem('scs_registrations', JSON.stringify(updated));
      return updated;
    });
  };

  // Encarregado de Educação atualiza dados
  const updateRegistrationByParent = (id, updatedData) => {
    setRegistrations((prev) => {
      const updated = prev.map((reg) => {
        if (reg.id === id) {
          return {
            ...reg,
            ...updatedData,
            status: 'accepted',
          };
        }
        return reg;
      });
      localStorage.setItem('scs_registrations', JSON.stringify(updated));
      return updated;
    });
  };

  // Login do Encarregado de Educação via Código de Acesso
  const loginParentByCode = (code) => {
    if (!code) {
      return { success: false, message: 'Por favor, insira o código de acesso.' };
    }

    // Normalização: Converte para maiúsculas e remove tudo o que não for letras e números (elimina hífens e espaços)
    const cleanInput = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Combina os dados do localStorage e do estado local para garantir que nada se perde
    const stored = JSON.parse(localStorage.getItem('scs_registrations') || '[]');
    const sourceList = stored.length > 0 ? stored : registrations;

    const registration = sourceList.find((reg) => {
      const dbCodeRaw = reg.accessCode || reg.access_code || reg.access_Code || '';
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

  // Gestão das Aulas de Adultos
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

  // Enviar Mensagem no Chat
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
        sendMessage
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}