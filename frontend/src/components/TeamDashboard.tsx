import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Team {
  id: number;
  name: string;
  policy_name: string;
  member_count: number;
  created_at: string;
}

interface Member {
  id: number;
  name: string;
  role: string;
  avg_strength: number;
  breach_exposed: boolean;
  added_at: string;
}

export default function TeamDashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');
  const [loading, setLoading] = useState(false);

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams');
      if (res.ok) setTeams(await res.json());
    } catch {}
  };

  const fetchMembers = async (teamId: number) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`);
      if (res.ok) setMembers(await res.json());
    } catch {}
  };

  useEffect(() => { fetchTeams(); }, []);
  useEffect(() => { if (selectedTeam) fetchMembers(selectedTeam); }, [selectedTeam]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName }),
      });
      if (res.ok) {
        setNewTeamName('');
        fetchTeams();
      }
    } finally { setLoading(false); }
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim() || !selectedTeam) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMemberName, role: newMemberRole }),
      });
      if (res.ok) {
        setNewMemberName('');
        fetchMembers(selectedTeam);
        fetchTeams();
      }
    } finally { setLoading(false); }
  };

  const handleDeleteTeam = async (teamId: number) => {
    await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
    if (selectedTeam === teamId) setSelectedTeam(null);
    fetchTeams();
  };

  const handleSetPolicy = async (teamId: number, policy: string) => {
    await fetch(`/api/teams/${teamId}/policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy_name: policy }),
    });
    fetchTeams();
  };

  const getStrengthColor = (s: number) => {
    if (s < 25) return 'text-red-400';
    if (s < 50) return 'text-orange-400';
    if (s < 75) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Create Team */}
      <div className="glass p-5">
        <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-3">Create Team</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
            placeholder="Team name..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-indigo-500/50"
          />
          <button onClick={handleCreateTeam} disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50">
            Create
          </button>
        </div>
      </div>

      {/* Team List */}
      {teams.length === 0 ? (
        <div className="glass p-8 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-slate-400 text-sm">No teams yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map(team => (
            <motion.div key={team.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`glass p-5 cursor-pointer transition-all ${selectedTeam === team.id ? 'ring-2 ring-indigo-500/50' : ''}`}
              onClick={() => setSelectedTeam(team.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-bold">{team.name}</h4>
                  <p className="text-xs text-slate-500">{team.member_count} members · Policy: {team.policy_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={team.policy_name}
                    onChange={(e) => { e.stopPropagation(); handleSetPolicy(team.id, e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                    {['NIST', 'PCI-DSS', 'Corporate', 'Basic'].map(p => (
                      <option key={p} value={p} className="bg-slate-800">{p}</option>
                    ))}
                  </select>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteTeam(team.id); }}
                    className="text-slate-500 hover:text-red-400 text-sm">✕</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Members */}
      {selectedTeam && (
        <div className="glass p-5">
          <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-3">Team Members</h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
              placeholder="Member name..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-indigo-500/50"
            />
            <select value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm">
              <option value="member" className="bg-slate-800">Member</option>
              <option value="admin" className="bg-slate-800">Admin</option>
            </select>
            <button onClick={handleAddMember} disabled={loading}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm disabled:opacity-50">Add</button>
          </div>

          {members.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No members yet</p>
          ) : (
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${m.role === 'admin' ? 'bg-indigo-400' : 'bg-slate-500'}`} />
                    <span className="text-white text-sm">{m.name}</span>
                    <span className="text-xs text-slate-500 capitalize">({m.role})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-mono ${getStrengthColor(m.avg_strength)}`}>
                      {m.avg_strength}%
                    </span>
                    {m.breach_exposed && <span className="text-xs text-red-400">⚠️ breached</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
