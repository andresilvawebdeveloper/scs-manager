import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../services/supabaseClient';
import { CoachAvatar } from '../common/FamilyChat';

export const CLUB_CLASSES = ['Spark', 'Flame', 'Fusion', 'Thunder', 'Firestorm', 'Stormfit'];

// Perfil do treinador (visível para as famílias) + conta + equipa técnica (admin)
export default function CoachProfile() {
  const {
    currentCoach, updateMyCoachProfile, coachTeam, fetchCoachTeam, addCoachByEmail, setCoachActive,
  } = useApp();
  const isAdmin = currentCoach?.role === 'admin';

  const [name, setName] = useState(currentCoach?.name || '');
  const [bio, setBio] = useState(currentCoach?.bio || '');
  const [classes, setClasses] = useState(currentCoach?.classes || []);
  const [photoUrl, setPhotoUrl] = useState(currentCoach?.photo_url || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const [email, setEmail] = useState(currentCoach?.email || '');
  const [password, setPassword] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  const [newCoachEmail, setNewCoachEmail] = useState('');
  const [newCoachName, setNewCoachName] = useState('');
  const [teamMsg, setTeamMsg] = useState('');

  useEffect(() => {
    setName(currentCoach?.name || '');
    setBio(currentCoach?.bio || '');
    setClasses(currentCoach?.classes || []);
    setPhotoUrl(currentCoach?.photo_url || '');
    setEmail(currentCoach?.email || '');
  }, [currentCoach?.id, currentCoach?.name, currentCoach?.photo_url]);

  useEffect(() => { fetchCoachTeam && fetchCoachTeam(); }, []);

  const toggleClass = (c) => setClasses((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setProfileMsg('⚠️ O nome é obrigatório — é assim que as famílias o encontram.'); return; }
    setSavingProfile(true);
    const res = await updateMyCoachProfile({ name, bio, classes, photo_url: photoUrl || null });
    setSavingProfile(false);
    setProfileMsg(res.success ? '✓ Perfil guardado. As famílias já o podem ver.' : '⚠️ Não foi possível guardar: ' + res.message);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Escolha uma imagem (JPG, PNG, WEBP).'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `coach-photos/${currentCoach.id}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setPhotoUrl(publicUrl);
      const res = await updateMyCoachProfile({ photo_url: publicUrl });
      setProfileMsg(res.success ? '✓ Fotografia atualizada.' : '⚠️ ' + res.message);
    } catch (err) {
      alert('Erro ao carregar fotografia: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    const updates = {};
    if (email && email !== currentCoach?.email) updates.email = email;
    if (password.trim()) {
      if (password.length < 6) { alert('A nova password deve conter pelo menos 6 caracteres.'); return; }
      updates.password = password;
    }
    if (Object.keys(updates).length === 0) { alert('Nenhuma alteração detetada.'); return; }
    setSavingAccount(true);
    try {
      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      if (updates.email && currentCoach?.id) {
        await supabase.from('coaches').update({ email: updates.email }).eq('id', currentCoach.id);
      }
      alert('Dados atualizados com sucesso! ' + (updates.email ? 'Se alterou o email, confirme o novo endereço na caixa de entrada.' : ''));
      setPassword('');
    } catch (err) {
      alert('Erro ao atualizar a conta: ' + err.message);
    } finally {
      setSavingAccount(false);
    }
  };

  const handleAddCoach = async (e) => {
    e.preventDefault();
    if (!newCoachEmail.trim()) return;
    const res = await addCoachByEmail(newCoachEmail.trim(), newCoachName.trim());
    setTeamMsg(res.success ? `✓ ${newCoachEmail} adicionado à equipa.` : '⚠️ ' + res.message);
    if (res.success) { setNewCoachEmail(''); setNewCoachName(''); }
  };

  const handleToggleActive = async (coach) => {
    const verb = coach.active === false ? 'reativar' : 'desativar';
    if (!window.confirm(`Pretende ${verb} ${coach.name || coach.email}?`)) return;
    const res = await setCoachActive(coach.id, coach.active === false);
    if (!res.success) setTeamMsg('⚠️ ' + res.message);
  };

  const input = 'w-full p-3 border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-clubRed';

  return (
    <div className="space-y-6">
      {/* PERFIL PÚBLICO */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
        <div className="border-b border-gray-100 pb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900 text-base">O meu perfil de treinador</h2>
            <p className="text-xs text-gray-500">É o que as famílias veem quando escolhem com quem falar.</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase shrink-0 ${isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
            {isAdmin ? '👑 Administrador' : '👟 Treinador'}
          </span>
        </div>

        {profileMsg && <p className="text-xs font-medium bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl">{profileMsg}</p>}

        <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
          <div className="flex items-center gap-4">
            <CoachAvatar coach={{ name, photo_url: photoUrl }} size="w-16 h-16" />
            <label className="text-xs font-bold text-clubRed cursor-pointer">
              {uploading ? 'A carregar…' : photoUrl ? 'Mudar fotografia' : 'Adicionar fotografia'}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
            </label>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Nome (como as famílias o conhecem) *</label>
            <input name="coachName" value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="Ex: Treinadora Joana" />
          </div>
          <div>
            <span className="block text-xs font-bold text-gray-700 mb-1">Turmas que treina</span>
            <div className="flex flex-wrap gap-2">
              {CLUB_CLASSES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={classes.includes(c)}
                  onClick={() => toggleClass(c)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                    classes.includes(c) ? 'bg-clubRed text-white border-clubRed' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {classes.includes(c) ? '✓ ' : ''}{c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Apresentação</label>
            <textarea name="coachBio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className={input} placeholder="Ex: Treinadora de ginástica há 10 anos, responsável pela formação." />
          </div>
          <button type="submit" disabled={savingProfile} className="px-6 py-3 bg-clubRed hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow disabled:opacity-60">
            {savingProfile ? 'A guardar…' : 'Guardar perfil'}
          </button>
        </form>
      </section>

      {/* CONTA */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="font-bold text-gray-900 text-base">Conta de acesso</h2>
          <p className="text-xs text-gray-500">Email e palavra-passe para entrar na app (não são mostrados às famílias).</p>
        </div>
        <form onSubmit={handleSaveAccount} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Endereço de Email:</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Nova Palavra-passe:</label>
            <input type="password" placeholder="Deixe em branco para não alterar" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
            <span className="text-[10px] text-gray-400 block mt-1">Mínimo de 6 caracteres se desejar alterar.</span>
          </div>
          <button type="submit" disabled={savingAccount} className="px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white font-bold text-xs rounded-xl transition shadow disabled:opacity-60">
            {savingAccount ? 'A guardar…' : 'Guardar dados de acesso'}
          </button>
        </form>
      </section>

      {/* EQUIPA TÉCNICA */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="font-bold text-gray-900 text-base">Equipa técnica</h2>
          <p className="text-xs text-gray-500">
            {isAdmin ? 'Acrescente ou desative treinadores.' : 'Treinadores do clube.'} Só aparecem às famílias os que têm nome no perfil.
          </p>
        </div>
        {teamMsg && <p className="text-xs font-medium bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl">{teamMsg}</p>}
        <ul className="divide-y divide-gray-100" data-testid="team-list">
          {(coachTeam || []).map((c) => (
            <li key={c.id} className="py-3 flex items-center gap-3">
              <CoachAvatar coach={c} size="w-9 h-9" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {c.name || <span className="text-amber-700">Sem nome (não aparece às famílias)</span>}
                  {c.role === 'admin' && <span className="ml-1 text-[10px] text-amber-700">👑</span>}
                  {c.active === false && <span className="ml-1 text-[10px] text-gray-400">(desativado)</span>}
                </p>
                <p className="text-[10px] text-gray-500 truncate">{c.email}{c.classes?.length ? ' · ' + c.classes.join(', ') : ''}</p>
              </div>
              {isAdmin && c.id !== currentCoach?.id && (
                <button type="button" onClick={() => handleToggleActive(c)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                  {c.active === false ? 'Reativar' : 'Desativar'}
                </button>
              )}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <form onSubmit={handleAddCoach} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 pt-2 border-t border-gray-100">
            <input type="email" placeholder="Email da conta do treinador" value={newCoachEmail} onChange={(e) => setNewCoachEmail(e.target.value)} className={input} required />
            <input placeholder="Nome (opcional)" value={newCoachName} onChange={(e) => setNewCoachName(e.target.value)} className={input} />
            <button type="submit" className="px-5 py-3 bg-clubRed text-white font-bold text-xs rounded-xl">Acrescentar</button>
            <p className="sm:col-span-3 text-[10px] text-gray-400">
              A conta tem de existir primeiro no Supabase (Authentication → Users → Add user), com este email.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
