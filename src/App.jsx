import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import RoleSelector from './components/parent/RoleSelector';
import RegistrationWizard from './components/parent/RegistrationWizard';
import ParentDashboard from './components/parent/ParentDashboard';
import CoachLogin from './components/coach/CoachLogin';
import Dashboard from './components/coach/Dashboard';

export default function App() {
  const [view, setView] = useState('selector'); // 'selector', 'parent_form', 'parent_dashboard', 'coach_login', 'coach_dashboard'
  const [activeParentRegistration, setActiveParentRegistration] = useState(null);

  return (
    <AppProvider>
      <div className="min-h-screen bg-gray-50">
        
        {/* Seletor Inicial e Opções de Encarregado de Educação */}
        {view === 'selector' && (
          <RoleSelector
            onSelectRole={(role) => {
              if (role === 'coach') setView('coach_login');
            }}
            onNewRegistration={() => setView('parent_form')}
            onLoginWithCode={(registrationData) => {
              setActiveParentRegistration(registrationData);
              setView('parent_dashboard');
            }}
          />
        )}

        {/* Formulário Passo a Passo (Nova Inscrição) */}
        {view === 'parent_form' && (
          <RegistrationWizard onBack={() => setView('selector')} />
        )}

        {/* Área Pessoal do Encarregado de Educação (Com Código de Acesso) */}
        {view === 'parent_dashboard' && activeParentRegistration && (
          <ParentDashboard
            registration={activeParentRegistration}
            onLogout={() => {
              setActiveParentRegistration(null);
              setView('selector');
            }}
          />
        )}

        {/* Login do Treinador */}
        {view === 'coach_login' && (
          <CoachLogin
            onLoginSuccess={() => setView('coach_dashboard')}
            onBack={() => setView('selector')}
          />
        )}

        {/* Painel de Gestão do Treinador */}
        {view === 'coach_dashboard' && (
          <Dashboard onLogout={() => setView('selector')} />
        )}

      </div>
    </AppProvider>
  );
}