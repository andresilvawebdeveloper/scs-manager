import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../services/supabaseClient';

export default function AdultAthleteDashboard({ registration, onLogout }) {
  const { 
    updateAdultRegistration,
    adultClasses, 
    bookAdultClass, 
    cancelAdultClassEnrollment,
    messages,
    sendMessage
  } = useApp();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'adultClasses', 'chat'
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(registration);
  const [successMsg, setSuccessMsg] = useState('');

  // Estado do Chat
  const [chatText, setChatText] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  const userEmail = registration.email;

  // Filtrar mensagens privadas ou do canal geral relativas a este adulto
  const allMessagesList = messages || [];
  const myChatMessages = allMessagesList.filter(
    (m) => m.recipientEmail === 'all' || m.recipientEmail === userEmail || m.senderEmail === userEmail
  );

  const activeAdultClasses = adultClasses || [];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    const payload = {
      full_name: formData.full_name || formData.fullName || formData.athleteName || formData.athlete_name,
      phone: formData.phone,
      address: formData.address,
      nif: formData.nif || formData.athleteNIF || formData.athlete_nif,
      cc: formData.cc || formData.athleteCC || formData.athlete_cc,
      payment_mode: formData.payment_mode || formData.adultClassesPaymentMode || 'Mensal'
    };

    if (updateAdultRegistration) {
      await updateAdultRegistration(registration.id, payload);
    }

    setFormData({ ...formData, ...payload });
    setSuccessMsg('Dados atualizados com sucesso!');
    setIsEditing(false);
  };

  const handleEnroll = async (classId) => {
    const participantInfo = {
      id: registration.id,
      name: formData.full_name || formData.fullName || formData.athleteName || formData.athlete_name,
      email: userEmail,
      timestamp: new Date().toISOString()
    };

    if (bookAdultClass) {
      const res = await bookAdultClass(classId, participantInfo);
      if (res && res.message) {
        setSuccessMsg(res.message);
      }
    }
  };

  const handleCancelEnrollment = async (classId) => {
    if (window.confirm('Tem certeza que pretende cancelar a sua inscrição nesta aula?')) {
      if (cancelAdultClassEnrollment) {
        const res = await cancelAdultClassEnrollment(classId, registration.id);
        if (res && res.message) {
          setSuccessMsg(res.message);
        }
      }
    }
  };

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;

    setIsSendingChat(true);

    const msgObj = {
      id: Date.now().toString(),
      sender: 'Parent',
      senderName: formData.full_name || formData.fullName || formData.athleteName || formData.athlete_name,
      senderEmail: userEmail,
      recipientEmail: 'Coach',
      text: chatText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('pt-PT')
    };

    if (sendMessage) {
      sendMessage(msgObj);
    }

    setChatText('');
    setIsSendingChat(false);
  };

  const displayName = formData.full_name || formData.fullName || formData.athleteName || formData.athlete_name || 'Aluno';
  const displayBirth = formData.birth_date || formData.birthDate || 'Não preenchido';
  const displayCC = formData.cc || formData.athleteCC || formData.athlete_cc || 'Não preenchido';
  const displayNif = formData.nif || formData.athleteNIF || formData.athlete_nif || 'Não preenchido';
  const displayAddress = formData.address || 'Não preenchida';
  const displayPayment = formData.payment_mode || formData.adultClassesPaymentMode || 'Mensal';

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      
      {/* Header com o logotipo solicitado */}
      <header className="bg-amber-600 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1 shadow">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-bold text-sm">Área de Aulas de Adultos</h1>
        </div>
        <button onClick={onLogout} className="text-xs bg-white text-amber-800 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-100 transition">
          Sair
        </button>
      </header>

      {/* Navegação por Abas */}
      <div className="max-w-2xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-2xl shadow-sm border border-gray-200 text-center">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 text-xs font-bold rounded-xl transition ${
              activeTab === 'overview' ? 'bg-amber-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Ficha Pessoal
          </button>
          <button
            onClick={() => setActiveTab('adultClasses')}
            className={`py-2.5 text-xs font-bold rounded-xl transition ${
              activeTab === 'adultClasses' ? 'bg-amber-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Aulas 📅
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2.5 text-xs font-bold rounded-xl transition ${
              activeTab === 'chat' ? 'bg-amber-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Chat Treinador 💬
          </button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        
        {successMsg && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs font-medium flex justify-between items-center shadow-xs">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="font-bold text-amber-900 ml-2">✕</button>
          </div>
        )}

        {/* ABA 1: FICHA E DADOS */}
        {activeTab === 'overview' && (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-2">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-gray-800">Estado da Inscrição</h2>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                  registration.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {registration.status === 'accepted' ? 'Aceite ✓' : 'Pendente de Validação'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Modalidade: <strong className="text-amber-700 font-bold">Aulas de Adultos</strong>
              </p>
              <p className="text-xs text-gray-500">
                Código de Acesso: <strong className="text-gray-900 font-mono">{registration.accessCode || registration.access_code}</strong>
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-gray-800 text-sm">Dados da Ficha de Aluno</h2>
                {!isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-semibold"
                  >
                    Editar Dados
                  </button>
                )}
              </div>

              {!isEditing ? (
                <div className="space-y-4 text-xs text-gray-700">
                  <div className="bg-gray-50 p-4 rounded-xl space-y-1.5 border border-gray-100">
                    <p><strong>Nome Completo:</strong> {displayName}</p>
                    <p><strong>Data de Nascimento:</strong> {displayBirth}</p>
                    <p><strong>Cartão de Cidadão:</strong> {displayCC}</p>
                    <p><strong>NIF:</strong> {displayNif}</p>
                    <p><strong>Morada:</strong> {displayAddress}</p>
                    <p><strong>Email:</strong> {formData.email}</p>
                    <p><strong>Telemóvel:</strong> {formData.phone}</p>
                    <p><strong>Tipo de Pagamento:</strong> {displayPayment}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSave} className="space-y-4 text-xs">
                  <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">Nome Completo</label>
                      <input type="text" name="full_name" value={formData.full_name || formData.fullName || formData.athleteName || formData.athlete_name || ''} onChange={handleChange} className="w-full p-2.5 border rounded-xl" required />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">Telemóvel</label>
                      <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full p-2.5 border rounded-xl" required />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">Morada</label>
                      <input type="text" name="address" value={formData.address || ''} onChange={handleChange} className="w-full p-2.5 border rounded-xl" />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">NIF</label>
                      <input type="text" name="nif" value={formData.nif || formData.athleteNIF || formData.athlete_nif || ''} onChange={handleChange} className="w-full p-2.5 border rounded-xl" />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">Cartão de Cidadão</label>
                      <input type="text" name="cc" value={formData.cc || formData.athleteCC || formData.athlete_cc || ''} onChange={handleChange} className="w-full p-2.5 border rounded-xl" />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">Tipo de Pagamento</label>
                      <select name="payment_mode" value={formData.payment_mode || formData.adultClassesPaymentMode || 'Mensal'} onChange={handleChange} className="w-full p-2 border rounded-xl bg-white">
                        <option value="Mensal">Mensal</option>
                        <option value="Avulso">Avulso</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <button type="button" onClick={() => setIsEditing(false)} className="w-1/2 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold">Cancelar</button>
                    <button type="submit" className="w-1/2 py-2.5 bg-amber-600 text-white rounded-xl font-semibold shadow">Guardar Alterações</button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}

        {/* ABA 2: AULAS DE ADULTOS */}
        {activeTab === 'adultClasses' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="font-bold text-gray-800 text-sm">Aulas de Adultos Disponíveis</h2>
            {activeAdultClasses.length === 0 ? (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                <p className="text-xs text-gray-400">Não existem aulas agendadas de momento pelo treinador.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeAdultClasses.map((classItem) => {
                  const enrolledList = classItem.enrolledParents || [];
                  const myIndex = enrolledList.findIndex((p) => p.id === registration.id || p.email === userEmail);
                  const isEnrolled = myIndex !== -1;
                  const isFull = enrolledList.length >= classItem.maxSeats;

                  return (
                    <div key={classItem.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-gray-900 block">📅 Data: {classItem.date}</span>
                          <span className="text-[11px] text-gray-500 block">⏰ Horário: {classItem.time}</span>
                          <span className="text-[10px] text-gray-400 block mt-1">Lugares: {enrolledList.length} / {classItem.maxSeats}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                        {isEnrolled ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold text-emerald-700">✓ Inscrito (Lugar #{myIndex + 1})</span>
                            <button onClick={() => handleCancelEnrollment(classItem.id)} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold">
                              Cancelar Inscrição
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEnroll(classItem.id)}
                            disabled={isFull}
                            className={`w-full py-2.5 rounded-xl text-xs font-bold ${
                              isFull ? 'bg-gray-200 text-gray-400' : 'bg-amber-600 text-white hover:bg-amber-700'
                            }`}
                          >
                            {isFull ? 'Vagas Preenchidas' : 'Reservar Minha Vaga'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 3: CHAT */}
        {activeTab === 'chat' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[500px] overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-xs text-gray-800">💬 Chat com o Treinador</h2>
              <p className="text-[10px] text-gray-500">Histórico de mensagens privadas e comunicados gerais.</p>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {myChatMessages.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400">
                  Nenhuma mensagem trocada ainda. Escreva uma mensagem abaixo!
                </div>
              ) : (
                myChatMessages.map((msg, idx) => {
                  const isMe = msg.senderEmail === userEmail || msg.sender === 'Parent';
                  return (
                    <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-2xl text-xs space-y-1 ${
                        isMe ? 'bg-amber-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
                      }`}>
                        <span className="text-[10px] font-bold block opacity-80">{isMe ? 'Você' : 'Treinador'}</span>
                        <p className="leading-relaxed whitespace-pre-line">{msg.text || msg.message}</p>
                        <span className="text-[9px] block text-right opacity-70">{msg.timestamp || msg.date}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendChatMessage} className="p-3 bg-white border-t border-gray-200 flex space-x-2">
              <input
                type="text"
                placeholder="Escreva a mensagem para o treinador..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                className="flex-1 p-3 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-600"
                required
              />
              <button
                type="submit"
                disabled={isSendingChat}
                className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow"
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