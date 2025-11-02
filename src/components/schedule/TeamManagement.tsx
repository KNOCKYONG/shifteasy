'use client';

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/trpc/client';

interface Team {
  id: string;
  name: string;
  code: string;
  color: string;
  displayOrder: number;
}

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

export function TeamManagement() {
  const { t } = useTranslation('schedule');
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [newTeam, setNewTeam] = useState({ name: '', code: '', color: DEFAULT_COLORS[0] });
  const [isAddingTeam, setIsAddingTeam] = useState(false);

  // Fetch teams
  const { data: teams = [], refetch } = api.teams.getAll.useQuery();

  // Mutations
  const createTeam = api.teams.create.useMutation({
    onSuccess: () => {
      refetch();
      setNewTeam({ name: '', code: '', color: DEFAULT_COLORS[0] });
      setIsAddingTeam(false);
      alert(t('teamManagement.createSuccess'));
    },
    onError: (error) => {
      alert(t('teamManagement.createError') + ': ' + error.message);
    },
  });

  const updateTeam = api.teams.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditingTeam(null);
      alert(t('teamManagement.updateSuccess'));
    },
    onError: (error) => {
      alert(t('teamManagement.updateError') + ': ' + error.message);
    },
  });

  const deleteTeam = api.teams.delete.useMutation({
    onSuccess: () => {
      refetch();
      alert(t('teamManagement.deleteSuccess'));
    },
    onError: (error) => {
      alert(t('teamManagement.deleteError') + ': ' + error.message);
    },
  });

  const handleCreateTeam = () => {
    if (!newTeam.name.trim() || !newTeam.code.trim()) {
      return;
    }
    createTeam.mutate(newTeam);
  };

  const handleUpdateTeam = (team: Team) => {
    updateTeam.mutate({
      id: team.id,
      name: team.name,
      code: team.code,
      color: team.color,
    });
  };

  const handleDeleteTeam = (teamId: string) => {
    if (confirm(t('teamManagement.deleteConfirm'))) {
      deleteTeam.mutate({ id: teamId });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {t('teamManagement.title')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('teamManagement.description')}
        </p>
      </div>

      {/* Add Team Button */}
      {!isAddingTeam && (
        <button
          onClick={() => setIsAddingTeam(true)}
          className="mb-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('teamManagement.addTeam')}
        </button>
      )}

      {/* Add Team Form */}
      {isAddingTeam && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('teamManagement.teamName')}
              </label>
              <input
                type="text"
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                placeholder="A팀"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('teamManagement.teamCode')}
              </label>
              <input
                type="text"
                value={newTeam.code}
                onChange={(e) => setNewTeam({ ...newTeam, code: e.target.value.toUpperCase() })}
                placeholder="A"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('teamManagement.teamColor')}
              </label>
              <div className="flex gap-2">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTeam({ ...newTeam, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      newTeam.color === color
                        ? 'border-gray-900 dark:border-white scale-110'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateTeam}
              disabled={!newTeam.name.trim() || !newTeam.code.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {t('teamManagement.save')}
            </button>
            <button
              onClick={() => {
                setIsAddingTeam(false);
                setNewTeam({ name: '', code: '', color: DEFAULT_COLORS[0] });
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
              {t('teamManagement.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Teams List */}
      <div className="space-y-3">
        {teams.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('teamManagement.noTeams')}
          </div>
        ) : (
          teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              isEditing={editingTeam === team.id}
              onEdit={() => setEditingTeam(team.id)}
              onSave={handleUpdateTeam}
              onCancel={() => setEditingTeam(null)}
              onDelete={() => handleDeleteTeam(team.id)}
              t={t}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface TeamCardProps {
  team: Team;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (team: Team) => void;
  onCancel: () => void;
  onDelete: () => void;
  t: any;
}

function TeamCard({ team, isEditing, onEdit, onSave, onCancel, onDelete, t }: TeamCardProps) {
  const [editedTeam, setEditedTeam] = useState(team);

  React.useEffect(() => {
    setEditedTeam(team);
  }, [team]);

  if (isEditing) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('teamManagement.teamName')}
            </label>
            <input
              type="text"
              value={editedTeam.name}
              onChange={(e) => setEditedTeam({ ...editedTeam, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('teamManagement.teamCode')}
            </label>
            <input
              type="text"
              value={editedTeam.code}
              onChange={(e) => setEditedTeam({ ...editedTeam, code: e.target.value.toUpperCase() })}
              maxLength={10}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('teamManagement.teamColor')}
            </label>
            <div className="flex gap-2">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setEditedTeam({ ...editedTeam, color })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    editedTeam.color === color
                      ? 'border-gray-900 dark:border-white scale-110'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onSave(editedTeam)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <Save className="w-4 h-4" />
            {t('teamManagement.save')}
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
            {t('teamManagement.cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: team.color }}
        >
          {team.code}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{team.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{team.code}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
