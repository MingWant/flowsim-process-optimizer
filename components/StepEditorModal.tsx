import React from 'react';
import type {
  BusinessCalendar,
  ProcessStep,
  SimulationConfig,
} from '../types';
import { ConnectionsTab } from './step-editor/ConnectionsTab';
import { ExceptionsTab } from './step-editor/ExceptionsTab';
import { CalendarOverridePanel } from './step-editor/CalendarOverridePanel';
import { ItemProfilesPanel } from './step-editor/ItemProfilesPanel';
import { EndNodeSettings } from './step-editor/EndNodeSettings';
import { ProcessNodeSettings } from './step-editor/ProcessNodeSettings';
import { RandomnessModeToggle } from './step-editor/RandomnessModeToggle';
import { RulesTab } from './step-editor/RulesTab';
import { StartNodeSettings } from './step-editor/StartNodeSettings';
import { VisualColorField } from './step-editor/VisualColorField';
import { AlertTriangle, ArrowDownUp, Clock, Settings, X } from 'lucide-react';

export type StepEditorTab = 'basic' | 'connections' | 'rules' | 'exceptions';

interface Props {
  config: SimulationConfig;
  businessCalendar: BusinessCalendar;
  editingStep: ProcessStep | null;
  activeTab: StepEditorTab;
  editingStepValidationError: string | null;
  potentialSources: ProcessStep[];
  setEditingStep: React.Dispatch<React.SetStateAction<ProcessStep | null>>;
  setActiveTab: React.Dispatch<React.SetStateAction<StepEditorTab>>;
  saveStepUpdate: () => void;
  toggleConnection: (targetId: string, checked: boolean) => void;
  updateProbability: (targetId: string, newVal: number) => void;
  updateSourceRule: (sourceId: string, time: number) => void;
  addStartDemandModifier: () => void;
  addArrivalWindow: () => void;
  addArrivalEvent: () => void;
}

export const StepEditorModal: React.FC<Props> = ({
  config,
  businessCalendar,
  editingStep,
  activeTab,
  editingStepValidationError,
  potentialSources,
  setEditingStep,
  setActiveTab,
  saveStepUpdate,
  toggleConnection,
  updateProbability,
  updateSourceRule,
  addStartDemandModifier,
  addArrivalWindow,
  addArrivalEvent,
}) => (
  <>
          {/* Edit Modal */}
          {editingStep && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
               <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50 shrink-0">
                     <h3 className="font-bold text-slate-200 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: editingStep.color }}></span>
                        Edit {editingStep.type === 'start' ? 'Start Node' : editingStep.type === 'end' ? 'End Node' : 'Step'}: {editingStep.name}
                     </h3>
                     <button onClick={() => setEditingStep(null)} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20}/>
                     </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-slate-800 bg-slate-900/50">
                      <button 
                        onClick={() => setActiveTab('basic')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'basic' ? 'border-blue-500 text-blue-400 bg-slate-800/30' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                      >
                          <Settings size={14} className="inline mr-2 mb-0.5"/> Basic
                      </button>
                      
                      {editingStep.type !== 'end' && (
                        <button 
                            onClick={() => setActiveTab('connections')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'connections' ? 'border-blue-500 text-blue-400 bg-slate-800/30' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                        >
                            <ArrowDownUp size={14} className="inline mr-2 mb-0.5"/> Routing
                        </button>
                      )}

                      {editingStep.type === 'process' && (
                          <button 
                            onClick={() => setActiveTab('exceptions')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'exceptions' ? 'border-blue-500 text-blue-400 bg-slate-800/30' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                        >
                            <AlertTriangle size={14} className="inline mr-2 mb-0.5"/> Exceptions
                        </button>
                      )}

                      {editingStep.type !== 'start' && (
                        <button 
                            onClick={() => setActiveTab('rules')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'rules' ? 'border-blue-500 text-blue-400 bg-slate-800/30' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                        >
                            <Clock size={14} className="inline mr-2 mb-0.5"/> Rules
                        </button>
                      )}
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-900">
                     
                     {/* Basic Tab */}
                     {activeTab === 'basic' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Name</label>
                                <input 
                                type="text" 
                                value={editingStep.name} 
                                onChange={e => setEditingStep({...editingStep, name: e.target.value})}
                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* RANDOMNESS MODE TOGGLE */}
                            {editingStep.type !== 'end' && (
                                <>
                                  <RandomnessModeToggle editingStep={editingStep} setEditingStep={setEditingStep} />

                                  {editingStep.type === 'start' && (
                                    <ItemProfilesPanel editingStep={editingStep} setEditingStep={setEditingStep} />
                                  )}
                                </>
                            )}

                            {editingStep.type === 'start' && (
                              <StartNodeSettings
                                editingStep={editingStep}
                                setEditingStep={setEditingStep}
                                addStartDemandModifier={addStartDemandModifier}
                                addArrivalWindow={addArrivalWindow}
                                addArrivalEvent={addArrivalEvent}
                              />
                            )}

                            {editingStep.type === 'end' && (
                                <EndNodeSettings editingStep={editingStep} setEditingStep={setEditingStep} />
                            )}

                            {editingStep.type !== 'end' && (
                              <CalendarOverridePanel
                                businessCalendar={businessCalendar}
                                editingStep={editingStep}
                                setEditingStep={setEditingStep}
                              />
                            )}

                            {editingStep.type === 'process' && (
                              <ProcessNodeSettings editingStep={editingStep} setEditingStep={setEditingStep} />
                            )}

                            <VisualColorField editingStep={editingStep} setEditingStep={setEditingStep} />
                        </div>
                     )}

                     {/* Exceptions Tab */}
                     {activeTab === 'exceptions' && editingStep.type === 'process' && (
                        <ExceptionsTab editingStep={editingStep} setEditingStep={setEditingStep} />
                     )}

                     {/* Connections Tab */}
                     {activeTab === 'connections' && editingStep.type !== 'end' && (
                         <ConnectionsTab
                           config={config}
                           editingStep={editingStep}
                           toggleConnection={toggleConnection}
                           updateProbability={updateProbability}
                         />
                     )}

                     {/* Rules Tab */}
                     {activeTab === 'rules' && editingStep.type !== 'start' && (
                         <RulesTab
                           editingStep={editingStep}
                           potentialSources={potentialSources}
                           updateSourceRule={updateSourceRule}
                         />
                     )}

                  </div>
                  <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex flex-col gap-3 shrink-0">
                     {editingStepValidationError && (
                       <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                         Cannot save: {editingStepValidationError}
                       </div>
                     )}
                     <div className="flex justify-end gap-2">
                     <button 
                        onClick={() => setEditingStep(null)}
                        className="px-4 py-2 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                     >
                        Cancel
                     </button>
                     <button 
                        onClick={saveStepUpdate}
                      disabled={Boolean(editingStepValidationError)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                     >
                        Save Changes
                     </button>
                    </div>
                  </div>
               </div>
            </div>
          )}

  </>
);
