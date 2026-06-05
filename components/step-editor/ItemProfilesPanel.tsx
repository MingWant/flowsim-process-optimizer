import type React from 'react';
import type { ProcessStep } from '../../types';
import {
  DEFAULT_ITEM_PROFILE,
  getProfileProbabilityTotal,
  sanitizeItemProfiles,
  updateItemProfile,
} from '../../utils/configSerialization';

interface Props {
  editingStep: ProcessStep;
  setEditingStep: React.Dispatch<React.SetStateAction<ProcessStep | null>>;
}

export const ItemProfilesPanel: React.FC<Props> = ({ editingStep, setEditingStep }) => (
  <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <label className="block text-xs font-semibold text-cyan-200 uppercase">Item Mix / Quality</label>
        <p className="mt-1 text-xs text-slate-500">Define what kind of items this Start Point creates. Probabilities must total 100%.</p>
      </div>
      <button
        onClick={() => {
          const profiles = sanitizeItemProfiles(editingStep.itemProfiles);
          setEditingStep({
            ...editingStep,
            itemProfiles: [
              ...profiles,
              {
                id: `profile-${Date.now()}`,
                name: `Profile ${profiles.length + 1}`,
                probability: 0,
                processingTimeMultiplier: 1,
                failureMultiplier: 1,
                cancellationMultiplier: 1,
                priority: 1,
                color: '#38bdf8',
              },
            ],
          });
        }}
        className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
      >
        Add Profile
      </button>
    </div>
    <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${Math.abs(getProfileProbabilityTotal(editingStep) - 1) <= 0.001 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/40 bg-rose-500/10 text-rose-200'}`}>
      Probability total: <span className="font-mono font-bold">{(getProfileProbabilityTotal(editingStep) * 100).toFixed(1)}%</span>
    </div>
    <div className="space-y-3">
      {sanitizeItemProfiles(editingStep.itemProfiles).map((profile) => (
        <div key={profile.id} className="rounded-lg border border-cyan-500/20 bg-slate-950/60 p-3">
          <div className="mb-2 grid grid-cols-[32px_1fr_80px_auto] items-center gap-2">
            <input
              type="color"
              value={profile.color}
              onChange={(event) => setEditingStep(updateItemProfile(editingStep, profile.id, { color: event.target.value }))}
              className="h-8 w-8 cursor-pointer rounded border-none bg-transparent"
              title="Profile color"
            />
            <input
              type="text"
              value={profile.name}
              onChange={(event) => setEditingStep(updateItemProfile(editingStep, profile.id, { name: event.target.value }))}
              className="min-w-0 rounded-lg border border-cyan-500/30 bg-slate-900 px-2 py-1.5 text-xs text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={Math.round(profile.probability * 100)}
              onChange={(event) => setEditingStep(updateItemProfile(editingStep, profile.id, { probability: Math.max(0, Math.min(1, Number(event.target.value) / 100)) }))}
              className="w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-2 py-1.5 text-xs text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
              title="Probability %"
            />
            <button
              onClick={() => {
                const profiles = sanitizeItemProfiles(editingStep.itemProfiles).filter((existing) => existing.id !== profile.id);
                setEditingStep({ ...editingStep, itemProfiles: profiles.length > 0 ? profiles : [{ ...DEFAULT_ITEM_PROFILE }] });
              }}
              disabled={sanitizeItemProfiles(editingStep.itemProfiles).length <= 1}
              className="rounded border border-rose-500/30 px-2 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-cyan-200">Time Factor</label>
              <input
                type="number"
                min="0.01"
                step="0.05"
                value={profile.processingTimeMultiplier}
                onChange={(event) => setEditingStep(updateItemProfile(editingStep, profile.id, { processingTimeMultiplier: Number(event.target.value) }))}
                className="w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-2 py-1.5 text-xs text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-cyan-200">Failure Factor</label>
              <input
                type="number"
                min="0"
                step="0.05"
                value={profile.failureMultiplier}
                onChange={(event) => setEditingStep(updateItemProfile(editingStep, profile.id, { failureMultiplier: Number(event.target.value) }))}
                className="w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-2 py-1.5 text-xs text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-cyan-200">Cancel Factor</label>
              <input
                type="number"
                min="0"
                step="0.05"
                value={profile.cancellationMultiplier}
                onChange={(event) => setEditingStep(updateItemProfile(editingStep, profile.id, { cancellationMultiplier: Number(event.target.value) }))}
                className="w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-2 py-1.5 text-xs text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-cyan-200">Priority</label>
              <input
                type="number"
                min="0"
                step="1"
                value={profile.priority}
                onChange={(event) => setEditingStep(updateItemProfile(editingStep, profile.id, { priority: Number(event.target.value) }))}
                className="w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-2 py-1.5 text-xs text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);
