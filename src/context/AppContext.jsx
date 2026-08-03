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

  useEffect(() => {
    localStorage.setItem('scs_registrations', JSON.stringify(registrations));
  }, [registrations]);

  useEffect(() => {
    localStorage.setItem('scs_attendances', JSON.stringify(attendances));
  }, [attendances]);

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
  const updateRegistrationStatus = (id, status, reason = '') => {
    if (status === 'rejected') {
      setRegistrations((prev) => prev.filter((reg) => reg.id !== id));
    } else {
      // Geração de código totalmente aleatório e seguro (ex: SCS-9K4M2X)
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randomPart = '';
      for (let i = 0; i < 6; i++) {
        randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      const secureRandomCode = `SCS-${randomPart}`;

      setRegistrations((prev) =>
        prev.map((reg) => 
          reg.id === id 
            ? { ...reg, status, accessCode: reg.accessCode || secureRandomCode, rejectionReason: reason } 
            : reg
        )
      );
    }
  };

  // Encarregado de Educação atualiza dados de uma inscrição aceite
  const updateRegistrationByParent = (id, updatedData) => {
    setRegistrations((prev) =>
      prev.map((reg) => {
        if (reg.id === id) {
          return {
            ...reg,
            ...updatedData,
            status: 'pending', // Volta a ser necessário aceitação do treinador
            // Mantém o código de acesso que já tinha
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

  // Marcar presença
  const toggleAttendance = (athleteId, date) => {
    const key = `${athleteId}_${date}`;
    setAttendances((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <AppContext.Provider
      value={{
        registrations,
        attendances,
        addRegistration,
        updateRegistrationStatus,
        updateRegistrationByParent,
        loginParentByCode,
        loginCoach,
        toggleAttendance,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}