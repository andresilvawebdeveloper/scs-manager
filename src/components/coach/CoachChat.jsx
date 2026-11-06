import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';

const ALL_KEY = 'all|club';

const formatTime = (m) => {
  const d = new Date(m.created_at || m.timestamp || '');
  if (Number.isNaN(d.getTime())) return m.timestamp || m.date || '';
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
};

// Chat do treinador: comunicado geral, caixa do clube (partilhada por todos os treinadores)
// e conversas privadas (só o próprio treinador as vê).
export default function CoachChat({ families, initialFamily }) {
  const {
    currentCoach, messages, sendMessage, conversationKey, messageConversationKey,
    markConversationRead, unreadCount, isMyMessage,
  } = useApp();

  const familyByEmail = useMemo(() => {
    const map = {};
    families.forEach((f) => { map[f.email] = f; });
    return map;
  }, [families]);

  const [selected, setSelected] = useState(() =>
    initialFamily ? { family: initialFamily.toLowerCase(), coachId: currentCoach?.id || null } : { family: 'all', coachId: null });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [newFamily, setNewFamily] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (initialFamily) setSelected({ family: initialFamily.toLowerCase(), coachId: currentCoach?.id || null });
  }, [initialFamily]);

  const selectedKey = conversationKey(selected.family, selected.coachId);

  // Lista de conversas: comunicado geral + todas as conversas com mensagens + a que está aberta
  const conversations = useMemo(() => {
    const byKey = {};
    (messages || []).forEach((m) => {
      if (!m.familyEmail) return;
      const key = messageConversationKey(m);
      const prev = byKey[key];
      if (!prev || new Date(m.created_at || 0) >= new Date(prev.last.created_at || 0)) {
        byKey[key] = { key, family: m.familyEmail, coachId: m.coachId, last: m };
      }
    });
    if (!byKey[selectedKey] && selected.family !== 'all') {
      byKey[selectedKey] = { key: selectedKey, family: selected.family, coachId: selected.coachId, last: null };
    }
    delete byKey[ALL_KEY];
    return Object.values(byKey).sort((a, b) =>
      new Date(b.last?.created_at || 0) - new Date(a.last?.created_at || 0));
  }, [messages, selectedKey]);

  const currentMessages = (messages || []).filter((m) => messageConversationKey(m) === selectedKey);

  useEffect(() => {
    markConversationRead(selectedKey);
    bottomRef.current?.scrollIntoView?.({ block: 'end' });
  }, [selectedKey, currentMessages.length]);

  const labelFor = (family) => {
    if (family === 'all') return '📢 Comunicado geral (todas as famílias)';
    const f = familyByEmail[family];
    return f ? f.label : family;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const result = await sendMessage({ text, familyEmail: selected.family, coachId: selected.coachId });
    setSending(false);
    if (!result.success) {
      alert('A mensagem não foi enviada: ' + (result.message || 'erro desconhecido'));
      return;
    }
    setText('');
  };

  const openNew = (email) => {
    if (!email) return;
    setSelected({ family: email.toLowerCase(), coachId: currentCoach?.id || null });
    setNewFamily('');
  };

  const ConversationButton = ({ conv, title, subtitle }) => {
    const unread = unreadCount(conv.key);
    const active = conv.key === selectedKey;
    return (
      <button
        type="button"
        data-testid="conversation"
        onClick={() => setSelected({ family: conv.family, coachId: conv.coachId })}
        className={`w-full text-left p-2.5 rounded-xl border transition flex items-start justify-between gap-2 ${
          active ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 hover:bg-gray-50'
        }`}
      >
        <span className="min-w-0">
          <span className="block text-xs font-bold text-gray-900 truncate">{title}</span>
          <span className="block text-[10px] text-gray-500 truncate">{subtitle}</span>
        </span>
        {unread > 0 && (
          <span data-testid="unread" className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-clubRed text-white text-[10px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr] md:h-[560px]">
      {/* Lista de conversas */}
      <aside className="border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 p-3 space-y-2 max-h-72 md:max-h-none overflow-y-auto">
        <ConversationButton
          conv={{ key: ALL_KEY, family: 'all', coachId: null }}
          title="📢 Comunicado geral"
          subtitle="Mensagem para todas as famílias"
        />

        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nova conversa privada</label>
          <select
            value={newFamily}
            onChange={(e) => openNew(e.target.value)}
            aria-label="Nova conversa privada"
            className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs"
          >
            <option value="">Escolher família…</option>
            {families.map((f) => (
              <option key={f.email} value={f.email}>{f.label}</option>
            ))}
          </select>
        </div>

        {conversations.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-4">Ainda não há conversas.</p>
        ) : (
          conversations.map((conv) => (
            <ConversationButton
              key={conv.key}
              conv={conv}
              title={labelFor(conv.family)}
              subtitle={`${conv.coachId ? '🔒 Privada' : '🏟️ Caixa do clube'}${conv.last ? ' · ' + String(conv.last.text || '').slice(0, 40) : ''}`}
            />
          ))
        )}
      </aside>

      {/* Conversa aberta */}
      <section className="flex flex-col min-h-[420px] md:min-h-0">
        <header className="p-3 border-b border-gray-200 bg-white">
          <h3 className="text-xs font-bold text-gray-900" data-testid="conversation-title">{labelFor(selected.family)}</h3>
          <p className="text-[10px] text-gray-500">
            {selected.family === 'all'
              ? 'Todas as famílias recebem esta mensagem e uma notificação.'
              : selected.coachId
                ? '🔒 Conversa privada — só você e a família a veem.'
                : '🏟️ Caixa do clube — todos os treinadores veem esta conversa.'}
          </p>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 max-h-[420px] md:max-h-none">
          {currentMessages.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-400">Nenhuma mensagem nesta conversa. Escreva a primeira abaixo!</div>
          ) : (
            currentMessages.map((msg) => {
              const mine = isMyMessage(msg);
              const isCoach = msg.sender === 'Coach';
              return (
                <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-xs space-y-1 ${
                    mine ? 'bg-clubRed text-white rounded-tr-none'
                      : isCoach ? 'bg-red-50 text-gray-800 border border-red-100 rounded-tl-none'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
                  }`}>
                    <span className="text-[10px] font-bold block opacity-80">
                      {mine ? 'Eu' : isCoach ? `Treinador(a) ${msg.senderName}` : msg.senderName || 'Encarregado'}
                    </span>
                    <p className="leading-relaxed whitespace-pre-line break-words">{msg.text}</p>
                    <span className="text-[9px] block text-right opacity-70">{formatTime(msg)}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200 flex gap-2">
          <input
            type="text"
            placeholder="Escreva a mensagem..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 min-w-0 p-3 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-clubRed"
            required
          />
          <button type="submit" disabled={sending} className="px-5 py-3 bg-clubRed hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow disabled:opacity-60">
            {sending ? 'A enviar…' : 'Enviar'}
          </button>
        </form>
      </section>
    </div>
  );
}
