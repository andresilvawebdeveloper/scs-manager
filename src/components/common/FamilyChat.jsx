import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import StoredImage from './StoredImage';

const formatTime = (m) => {
  const d = new Date(m.created_at || m.timestamp || '');
  if (Number.isNaN(d.getTime())) return m.timestamp || m.date || '';
  return new Date().toDateString() === d.toDateString()
    ? d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
};

export const initialsOf = (name) =>
  String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';

export function CoachAvatar({ coach, size = 'w-10 h-10' }) {
  return coach?.photo_url ? (
    <StoredImage src={coach.photo_url} alt={coach.name} className={`${size} rounded-full object-cover border border-gray-200`} />
  ) : (
    <span className={`${size} rounded-full bg-red-100 text-clubRed font-bold text-xs flex items-center justify-center`}>
      {initialsOf(coach?.name)}
    </span>
  );
}

// Chat das famílias (encarregados e alunos adultos): comunicados, caixa do clube
// ou conversa privada com um treinador à escolha.
export default function FamilyChat({ myEmail, myName, accent = 'bg-clubRed' }) {
  const {
    messages, sendMessage, coachProfiles, fetchCoachProfiles, conversationKey,
    messageConversationKey, markConversationRead, unreadCount, isMyMessage,
  } = useApp();
  const email = (myEmail || '').toLowerCase();

  // 'all' = comunicados · null = caixa do clube · id = treinador
  const [target, setTarget] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { fetchCoachProfiles && fetchCoachProfiles(); }, []);

  const key = target === 'all' ? 'all|club' : conversationKey(email, target);
  const current = (messages || []).filter((m) => messageConversationKey(m) === key);
  const selectedCoach = coachProfiles.find((c) => String(c.id) === String(target));

  useEffect(() => {
    markConversationRead(key);
    bottomRef.current?.scrollIntoView?.({ block: 'end' });
  }, [key, current.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending || target === 'all') return;
    setSending(true);
    const result = await sendMessage({ text, senderEmail: email, senderName: myName, coachId: target });
    setSending(false);
    if (!result.success) {
      alert('A mensagem não foi enviada. Tente novamente.');
      return;
    }
    setText('');
  };

  const Option = ({ value, title, subtitle, avatar }) => {
    const optKey = value === 'all' ? 'all|club' : conversationKey(email, value);
    const unread = unreadCount(optKey);
    const active = String(target) === String(value);
    return (
      <button
        type="button"
        data-testid="chat-target"
        onClick={() => setTarget(value)}
        className={`shrink-0 md:w-full text-left p-2.5 rounded-xl border flex items-center gap-2 transition ${
          active ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 hover:bg-gray-50'
        }`}
      >
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-gray-900 truncate">{title}</span>
          {subtitle && <span className="block text-[10px] text-gray-500 truncate">{subtitle}</span>}
        </span>
        {unread > 0 && (
          <span data-testid="unread" className="min-w-[20px] h-5 px-1.5 rounded-full bg-clubRed text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>
        )}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden grid grid-cols-1 md:grid-cols-[230px_1fr] md:h-[560px]">
      <aside className="border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 p-3 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto">
        <Option value={null} title="🏟️ Clube" subtitle="Todos os treinadores" />
        <Option value="all" title="📢 Comunicados" subtitle="Avisos para todos" />
        {coachProfiles.map((c) => (
          <Option
            key={c.id}
            value={c.id}
            title={c.name}
            subtitle={c.classes?.length ? c.classes.join(', ') : 'Treinador(a)'}
            avatar={<CoachAvatar coach={c} size="w-8 h-8" />}
          />
        ))}
      </aside>

      <section className="flex flex-col min-h-[420px] md:min-h-0">
        <header className="p-3 border-b border-gray-200 bg-white">
          {selectedCoach ? (
            <div className="flex items-start gap-3" data-testid="coach-card">
              <CoachAvatar coach={selectedCoach} size="w-12 h-12" />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-900">{selectedCoach.name}</h3>
                {selectedCoach.classes?.length > 0 && (
                  <p className="text-[10px] font-semibold text-clubRed">Turmas: {selectedCoach.classes.join(', ')}</p>
                )}
                {selectedCoach.bio && <p className="text-[11px] text-gray-600 mt-1 whitespace-pre-line">{selectedCoach.bio}</p>}
                <p className="text-[10px] text-gray-400 mt-1">🔒 Conversa privada — só este treinador a vê.</p>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-xs font-bold text-gray-900">{target === 'all' ? '📢 Comunicados do clube' : '🏟️ Clube — todos os treinadores'}</h3>
              <p className="text-[10px] text-gray-500">
                {target === 'all' ? 'Avisos enviados pelos treinadores a todas as famílias.' : 'Qualquer treinador do clube pode ler e responder.'}
              </p>
            </>
          )}
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 max-h-[420px] md:max-h-none">
          {current.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-400">
              {target === 'all' ? 'Ainda não há comunicados.' : 'Nenhuma mensagem trocada ainda. Escreva uma mensagem abaixo!'}
            </div>
          ) : (
            current.map((msg) => {
              const mine = isMyMessage(msg);
              return (
                <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-xs space-y-1 ${
                    mine ? `${accent} text-white rounded-tr-none` : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
                  }`}>
                    <span className="text-[10px] font-bold block opacity-80">
                      {mine ? 'Eu' : msg.sender === 'Coach' ? `Treinador(a) ${msg.senderName}` : msg.senderName}
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

        {target !== 'all' && (
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200 flex gap-2">
            <input
              type="text"
              placeholder={selectedCoach ? `Mensagem para ${selectedCoach.name}...` : 'Escreva a mensagem para o clube...'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 min-w-0 p-3 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-clubRed"
              required
            />
            <button type="submit" disabled={sending} className={`px-5 py-3 ${accent} text-white rounded-xl text-xs font-bold transition shadow disabled:opacity-60`}>
              {sending ? 'A enviar…' : 'Enviar'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
