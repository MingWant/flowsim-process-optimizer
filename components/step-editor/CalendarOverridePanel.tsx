import type React from 'react';
import type { BusinessCalendar, NonWorkingArrivalPolicy, ProcessStep } from '../../types';
import { NON_WORKING_POLICY_LABELS, WEEKDAY_OPTIONS } from '../../constants/uiOptions';
import { normalizeBusinessCalendar } from '../../services/simulationCalendar';
import { VALID_NON_WORKING_POLICIES } from '../../utils/configSerialization';
import { Trash2 } from 'lucide-react';

interface Props {
  businessCalendar: BusinessCalendar;
  editingStep: ProcessStep;
  setEditingStep: React.Dispatch<React.SetStateAction<ProcessStep | null>>;
}

export const CalendarOverridePanel: React.FC<Props> = ({
  businessCalendar,
  editingStep,
  setEditingStep,
}) => (
  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <label className="block text-xs font-semibold text-indigo-200 uppercase">Calendar Override</label>
        <p className="mt-1 text-xs text-slate-500">Use global business hours or give this card its own schedule.</p>
      </div>
      <div className="flex rounded-lg bg-slate-900 p-1 text-xs">
        <button
          onClick={() => setEditingStep({ ...editingStep, calendarMode: 'inherit', businessCalendar: undefined })}
          className={`rounded px-3 py-1.5 font-semibold ${editingStep.calendarMode !== 'custom' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Inherit
        </button>
        <button
          onClick={() => setEditingStep({
            ...editingStep,
            calendarMode: 'custom',
            businessCalendar: normalizeBusinessCalendar({
              ...(editingStep.businessCalendar || businessCalendar),
              enabled: true,
            }),
          })}
          className={`rounded px-3 py-1.5 font-semibold ${editingStep.calendarMode === 'custom' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Custom
        </button>
      </div>
    </div>

    {editingStep.calendarMode === 'custom' && (() => {
      const stepCalendar = normalizeBusinessCalendar({ ...(editingStep.businessCalendar || businessCalendar), enabled: true });
      const updateStepCalendar = (updates: Partial<typeof stepCalendar>) => setEditingStep({
        ...editingStep,
        businessCalendar: normalizeBusinessCalendar({ ...stepCalendar, ...updates, enabled: true }),
      });

      return (
        <div className="space-y-3">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Working hours</label>
              <button
                onClick={() => {
                  const current = stepCalendar.workingHours || [{ start: 9, end: 17 }];
                  const lastSegment = current[current.length - 1];
                  const newStart = lastSegment ? Math.min(23, lastSegment.end) : 9;
                  const newEnd = Math.min(24, newStart + 1);
                  updateStepCalendar({
                    workingHours: [...current, { start: newStart, end: newEnd }],
                  });
                }}
                className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold text-indigo-200 hover:bg-indigo-500/20"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {(stepCalendar.workingHours || [{ start: 9, end: 17 }]).map((segment, index) => (
                <div key={`${segment.start}-${segment.end}-${index}`} className="flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-slate-950/70 p-2">
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="23.99"
                      step="0.5"
                      value={segment.start}
                      onChange={(event) => {
                        const current = stepCalendar.workingHours || [{ start: 9, end: 17 }];
                        const updated = [...current];
                        updated[index] = { ...updated[index], start: Number(event.target.value) };
                        updateStepCalendar({ workingHours: updated });
                      }}
                      className="w-20 rounded border border-indigo-500/30 bg-slate-900 px-2 py-1 text-xs text-indigo-100 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-500">to</span>
                    <input
                      type="number"
                      min="0.01"
                      max="24"
                      step="0.5"
                      value={segment.end}
                      onChange={(event) => {
                        const current = stepCalendar.workingHours || [{ start: 9, end: 17 }];
                        const updated = [...current];
                        updated[index] = { ...updated[index], end: Number(event.target.value) };
                        updateStepCalendar({ workingHours: updated });
                      }}
                      className="w-20 rounded border border-indigo-500/30 bg-slate-900 px-2 py-1 text-xs text-indigo-100 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  {(stepCalendar.workingHours || []).length > 1 && (
                    <button
                      onClick={() => {
                        const current = stepCalendar.workingHours || [{ start: 9, end: 17 }];
                        updateStepCalendar({
                          workingHours: current.filter((_, i) => i !== index),
                        });
                      }}
                      className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Working days</label>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_OPTIONS.map((day) => {
                const selected = stepCalendar.daysOfWeek.includes(day.value);
                return (
                  <button
                    key={day.value}
                    onClick={() => updateStepCalendar({
                      daysOfWeek: selected
                        ? stepCalendar.daysOfWeek.filter((value) => value !== day.value)
                        : [...stepCalendar.daysOfWeek, day.value].sort(),
                    })}
                    className={`rounded-lg border px-1.5 py-1.5 text-[10px] font-semibold ${selected ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-700 bg-slate-900 text-slate-500'}`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
          {editingStep.type === 'start' && (
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Non-working arrivals</label>
              <select
                value={stepCalendar.nonWorkingArrivalPolicy || 'queue'}
                onChange={(event) => updateStepCalendar({ nonWorkingArrivalPolicy: event.target.value as NonWorkingArrivalPolicy })}
                className="w-full rounded-lg border border-indigo-500/30 bg-slate-900 px-3 py-2 text-xs text-indigo-100 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {VALID_NON_WORKING_POLICIES.map((policy) => (
                  <option key={policy} value={policy}>{NON_WORKING_POLICY_LABELS[policy]}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      );
    })()}
  </div>
);
