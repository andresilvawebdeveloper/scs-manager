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

  // Submeter nova inscrição
  const addRegistration = (formData) => {
    const exists = registrations.some(
      (reg) =>
        reg.athleteName.trim().toLowerCase() === formData.athleteName.trim().toLowerCase() &&
        reg.birthDate === formData.birthDate
    );

    if (exists) {
      return { 
        success: false, 
        message: `O atleta ${formData.athleteName} já se encontra inscrito no sistema.` 
      };
    }

    const newReg = {
      id: Date.now().toString(),
      ...formData,
      status: 'pending', // pending, accepted, rejected
      accessCode: null,
      createdAt: new Date().toISOString(),
    };

    setRegistrations((prev) => [newReg, ...prev]);
    return { success: true, message: 'Inscrição submetida com sucesso! Aguarde a validação do treinador.' };
  };

  // Treinador aceita ou rejeita
  const updateRegistrationStatus = (id, status, reason = '', assignedClass = 'Formação geral') => {
    if (status === 'rejected') {
      setRegistrations((prev) => prev.filter((reg) => reg.id !== id));
    } else {
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randomPart = '';
      for (let i = 0; i < 6; i++) {
        randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      const secureRandomCode = `SCS-${randomPart}`;

      setRegistrations((prev) =>
        prev.map((reg) => 
          reg.id === id 
            ? { 
                ...reg, 
                status, 
                accessCode: reg.accessCode || secureRandomCode, 
                rejectionReason: reason,
                assignedClass: assignedClass 
              } 
            : reg
        )
      );
    }
  };

  // Remover atleta aceite do clube
  const removeAcceptedAthlete = (id) => {
    setRegistrations((prev) => prev.filter((reg) => reg.id !== id));
  };

  // Encarregado de Educação atualiza dados de uma inscrição aceite
  const updateRegistrationByParent = (id, updatedData) => {
    setRegistrations((prev) =>
      prev.map((reg) => {
        if (reg.id === id) {
          return {
            ...reg,
            ...updatedData,
            status: 'pending',
          };
        }
        return reg;
      })
    );
  };

  // Login do Encarregado de Educação via Código de Acesso
  const loginParentByCode = (code) => {
    const registration = registrations.find(
      (reg) => reg.accessCode && reg.accessCode.trim().toUpperCase() === code.trim().toUpperCase()
    );
    if (registration) {
      return { success: true, registration };
    }
    return { success: false, message: 'Código de acesso inválido ou inscrição ainda não aceite.' };
  };

  // Login do Treinador (Email e Password)
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

  // Ciclo de presenças: 'presente' -> 'justificado' -> 'injustificado' -> 'lesao' -> null
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

  // Criar novo Evento
  const addEvent = (eventData) => {
    const newEvent = {
      id: Date.now().toString(),
      ...eventData,
    };
    setEvents((prev) => [newEvent, ...prev]);
  };

  // Eliminar Evento
  const deleteEvent = (eventId) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
  };

  // Participação no evento
  const toggleEventAttendance = (eventId, athleteId) => {
    const key = `${eventId}_${athleteId}`;
    setEventAttendances((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <AppContext.Provider
      value={{
        registrations,
        attendances,
        events,
        eventAttendances,
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}