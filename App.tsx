
import React, { useState, useEffect } from 'react';
import { DEFAULT_CONFIG } from './constants';
import { useProcessSimulation } from './hooks/useProcessSimulation';
import { ProcessStep, SimulationConfig, NodeType } from './types';
import { ProcessMap } from './components/ProcessMap';
import { StatsBoard } from './components/StatsBoard';
import { generateScenario, analyzeBottlenecks } from './services/geminiService';
import { Play, Pause, RotateCcw, Plus, Zap, MessageSquare, Loader2, Sparkles, Menu, X, Settings, BarChart3, ArrowRight, ArrowDownUp, Clock, PlayCircle, StopCircle, Box, Shuffle, Dna, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  // App State
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Edit Modal State
  const [editingStep, setEditingStep] = useState<ProcessStep | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'connections' | 'rules' | 'exceptions'>('basic');

  // Simulation Hook
  const { items, stepStats, globalStats, resetSimulation } = useProcessSimulation(config);

  // Handlers
  const togglePlay = () => setConfig(p => ({ ...p, isRunning: !p.isRunning }));
  
  const saveStepUpdate = () => {
    if (!editingStep) return;
    setConfig(p => ({
      ...p,
      steps: p.steps.map(s => s.id === editingStep.id ? editingStep : s)
    }));
    setEditingStep(null);
  };

  const removeStep = (id: string) => {
    setConfig(p => ({
      ...p,
      steps: p.steps.filter(s => s.id !== id)
    }));
  };

  const addStep = (type: NodeType) => {
    const isStart = type === 'start';
    const isEnd = type === 'end';
    
    const newStep: ProcessStep = {
      id: `node-${Date.now()}`,
      type: type,
      name: isStart ? 'Start Point' : isEnd ? 'End Point' : 'New Step',
      randomnessMode: 'fixed',
      capacity: isStart || isEnd ? 0 : 1,
      processingTime: isStart || isEnd ? 0 : 2000,
      variance: 0.1,
      minProcessingTime: 1000,
      maxProcessingTime: 3000,
      arrivalRate: isStart ? 0.5 : undefined,
      minArrivalRate: 0.2,
      maxArrivalRate: 0.8,
      failureProbability: 0,
      cancellationProbability: 0,
      color: isStart ? '#10b981' : isEnd ? '#ef4444' : '#3b82f6',
      connections: [],
      sourceProcessingTimes: {},
      x: 100,
      y: 100
    };
    setConfig(p => ({ ...p, steps: [...p.steps, newStep] }));
  };

  const toggleConnection = (targetId: string, checked: boolean) => {
    if (!editingStep) return;
    let newConns = [...(editingStep.connections || [])];
    
    if (checked) {
        newConns.push({ targetId, probability: 1.0 });
    } else {
        newConns = newConns.filter(c => c.targetId !== targetId);
    }
    
    // Normalize probabilities (simple auto-balance)
    if (newConns.length > 0) {
        const prob = 1 / newConns.length;
        newConns = newConns.map(c => ({ ...c, probability: prob }));
    }

    setEditingStep({ ...editingStep, connections: newConns });
  };

  const updateProbability = (targetId: string, newVal: number) => {
      if (!editingStep) return;
      const newConns = editingStep.connections.map(c => 
         c.targetId === targetId ? { ...c, probability: newVal } : c
      );
      setEditingStep({ ...editingStep, connections: newConns });
  };

  const updateSourceRule = (sourceId: string, time: number) => {
      if (!editingStep) return;
      const newRules = { ...editingStep.sourceProcessingTimes, [sourceId]: time };
      setEditingStep({ ...editingStep, sourceProcessingTimes: newRules });
  };

  const handleGenerateScenario = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const steps = await generateScenario(aiPrompt);
      setConfig(p => ({ ...p, steps, isRunning: false }));
      resetSimulation();
      setAiPrompt('');
      setIsSidebarOpen(false); 
    } catch (e) {
      alert("Failed to generate scenario. Ensure API Key is selected.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    // Filter out start/end nodes for bottleneck analysis generally
    const processSteps = config.steps.filter(s => s.type === 'process');
    const analysis = await analyzeBottlenecks(processSteps, stepStats, globalStats);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const [hasApiKey, setHasApiKey] = useState(false);
  useEffect(() => {
    if (process.env.API_KEY) setHasApiKey(true);
  }, []);

  const selectApiKey = async () => {
    if (window.aistudio) {
        try {
            await window.aistudio.openSelectKey();
            setHasApiKey(true);
            window.location.reload(); 
        } catch (e) {
            console.error(e);
        }
    } else {
        alert("AI Studio environment not detected.");
    }
  };

  // Helper to find potential sources for the currently editing step
  const potentialSources = React.useMemo(() => {
     if (!editingStep) return [];
     return config.steps.filter(s => s.connections.some(c => c.targetId === editingStep.id));
  }, [config.steps, editingStep]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="h-16 border-b border-slate-700 bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-4 md:px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
            <Zap size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent hidden sm:block">FlowSim</h1>
        </div>
        
        <div className="flex items-center gap-4">
           {!hasApiKey && (
             <button onClick={selectApiKey} className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-full transition-colors font-medium">
               Select API Key
             </button>
           )}
           <button 
             className="lg:hidden p-2 text-slate-400 hover:text-white"
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
           >
             <Menu size={24} />
           </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row relative overflow-hidden">
        {/* Sidebar */}
        <aside className={`
            fixed inset-y-0 left-0 z-40 w-80 bg-slate-900/95 backdrop-blur-xl border-r border-slate-700 
            transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:bg-slate-800/50 lg:backdrop-blur-none
            flex flex-col h-[calc(100vh-4rem)] overflow-y-auto
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-4 flex items-center justify-between lg:hidden border-b border-slate-700/50">
             <span className="font-semibold text-slate-200">Controls</span>
             <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400"><X size={20}/></button>
          </div>

          <div className="p-6 space-y-8">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Settings size={14}/> Simulation Control
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={togglePlay}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${
                    config.isRunning 
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/50 hover:bg-amber-500/20' 
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-lg shadow-emerald-900/20'
                  }`}
                >
                  {config.isRunning ? <><Pause size={18}/> Pause</> : <><Play size={18}/> Start</>}
                </button>
                <button 
                  onClick={resetSimulation}
                  className="p-3 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Reset"
                >
                  <RotateCcw size={18}/>
                </button>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Speed</span>
                    <span className="font-mono text-purple-400">{config.speedMultiplier}x</span>
                  </div>
                  <input 
                    type="range" min="1" max="10" step="1"
                    value={config.speedMultiplier}
                    onChange={(e) => setConfig(p => ({ ...p, speedMultiplier: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-700/50">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14}/> AI Scenario
              </h3>
              <div className="relative">
                <textarea 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="E.g., Car Wash, Hospital ER..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-24 transition-all"
                />
                <button 
                  onClick={handleGenerateScenario}
                  disabled={isGenerating || !aiPrompt}
                  className="absolute bottom-2 right-2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:opacity-50 transition-colors"
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin"/> : <ArrowRight size={16}/>}
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-700/50">
              <div className="flex justify-between items-center">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 size={14}/> Analysis
                 </h3>
                 <button 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing || globalStats.totalItemsFinished < 5}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded transition-colors disabled:opacity-50"
                 >
                    {isAnalyzing ? 'Thinking...' : 'Analyze'}
                 </button>
              </div>
              
              {aiAnalysis ? (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-sm text-slate-300 leading-relaxed">
                  <MessageSquare size={14} className="inline mr-2 text-blue-400"/>
                  {aiAnalysis}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic text-center py-2">
                   Run simulation to generate data
                </div>
              )}
            </div>
          </div>
        </aside>

        {isSidebarOpen && (
           <div 
             className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
             onClick={() => setIsSidebarOpen(false)}
           />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto h-[calc(100vh-4rem)] p-4 lg:p-6 scroll-smooth relative">
          <div className="max-w-[1920px] mx-auto space-y-6">
             
             <div className="w-full h-auto min-h-[400px]">
                <StatsBoard globalStats={globalStats} stepStats={stepStats} steps={config.steps} />
             </div>

             <div className="w-full">
               <div className="flex items-center justify-between mb-4">
                 <h2 className="text-lg font-semibold text-slate-300">Process Map</h2>
                 <div className="flex gap-2">
                    <button 
                        onClick={() => addStep('start')}
                        className="flex items-center gap-1 text-xs bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-400 px-3 py-2 rounded-lg border border-emerald-800/50 transition-colors"
                    >
                        <PlayCircle size={14}/> Add Start
                    </button>
                    <button 
                        onClick={() => addStep('process')}
                        className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition-colors"
                    >
                        <Box size={14}/> Add Process
                    </button>
                     <button 
                        onClick={() => addStep('end')}
                        className="flex items-center gap-1 text-xs bg-red-900/30 hover:bg-red-800/50 text-red-400 px-3 py-2 rounded-lg border border-red-800/50 transition-colors"
                    >
                        <StopCircle size={14}/> Add End
                    </button>
                 </div>
               </div>

               <ProcessMap 
                  steps={config.steps} 
                  stepStats={stepStats} 
                  items={items}
                  isRunning={config.isRunning}
                  onEditStep={(s) => { setEditingStep(s); setActiveTab('basic'); }}
                  onRemoveStep={removeStep}
                  onAddStep={() => {}} 
               />
               <p className="text-xs text-slate-500 mt-2 flex gap-4">
                 <span>• Scroll to Zoom</span>
                 <span>• Drag background to Pan</span>
                 <span>• Drag nodes to rearrange</span>
               </p>
             </div>
          </div>
          
          <div className="h-12"/>

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
                                <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                                    <div className="flex items-center gap-2">
                                        <Shuffle size={16} className={editingStep.randomnessMode === 'range' ? 'text-purple-400' : 'text-slate-400'} />
                                        <span className="text-sm font-semibold text-slate-200">Random Range Mode</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-900 rounded p-1">
                                        <button 
                                            onClick={() => setEditingStep({...editingStep, randomnessMode: 'fixed'})}
                                            className={`text-xs px-3 py-1.5 rounded transition-all ${editingStep.randomnessMode === 'fixed' || !editingStep.randomnessMode ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            Fixed + Variance
                                        </button>
                                        <button 
                                            onClick={() => setEditingStep({...editingStep, randomnessMode: 'range'})}
                                            className={`text-xs px-3 py-1.5 rounded transition-all ${editingStep.randomnessMode === 'range' ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            Random Range
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* START NODE SPECIFIC */}
                            {editingStep.type === 'start' && (
                                <div className="p-4 bg-emerald-900/20 border border-emerald-900/50 rounded-lg">
                                    <label className="block text-xs font-semibold text-emerald-400 uppercase mb-2">Arrival Rate (Items per Second)</label>
                                    
                                    {editingStep.randomnessMode === 'range' ? (
                                         <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] text-slate-400 uppercase mb-1 block">Min Rate</label>
                                                <input 
                                                    type="number" min="0.1" step="0.1"
                                                    value={editingStep.minArrivalRate ?? 0.2} 
                                                    onChange={e => setEditingStep({...editingStep, minArrivalRate: Number(e.target.value)})}
                                                    className="w-full bg-slate-800 border border-emerald-900/50 rounded-lg p-2 text-emerald-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 uppercase mb-1 block">Max Rate</label>
                                                <input 
                                                    type="number" min="0.1" step="0.1"
                                                    value={editingStep.maxArrivalRate ?? 0.8} 
                                                    onChange={e => setEditingStep({...editingStep, maxArrivalRate: Number(e.target.value)})}
                                                    className="w-full bg-slate-800 border border-emerald-900/50 rounded-lg p-2 text-emerald-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </div>
                                            <div className="col-span-2 text-xs text-slate-500 mt-1">
                                                Arrivals will randomly fluctuate between {editingStep.minArrivalRate} and {editingStep.maxArrivalRate} items/sec.
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-4">
                                            <input 
                                                type="number" min="0.1" step="0.1"
                                                value={editingStep.arrivalRate ?? 0.5} 
                                                onChange={e => setEditingStep({...editingStep, arrivalRate: Number(e.target.value)})}
                                                className="flex-1 bg-slate-800 border border-emerald-900/50 rounded-lg p-3 text-emerald-100 font-mono text-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                            <span className="font-mono text-sm text-emerald-500 font-bold whitespace-nowrap">items / sec</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PROCESS NODE SPECIFIC */}
                            {editingStep.type === 'process' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Capacity (Resources)</label>
                                        <input 
                                            type="number" min="1" max="50"
                                            value={editingStep.capacity} 
                                            onChange={e => setEditingStep({...editingStep, capacity: parseInt(e.target.value) || 1})}
                                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    
                                    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                                        <label className="block text-xs font-semibold text-blue-400 uppercase mb-3">Processing Duration (ms)</label>
                                        
                                        {editingStep.randomnessMode === 'range' ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] text-slate-400 uppercase mb-1 block">Min Duration</label>
                                                    <input 
                                                        type="number" step="100" min="100"
                                                        value={editingStep.minProcessingTime ?? 1000} 
                                                        onChange={e => setEditingStep({...editingStep, minProcessingTime: Number(e.target.value)})}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-400 uppercase mb-1 block">Max Duration</label>
                                                    <input 
                                                        type="number" step="100" min="100"
                                                        value={editingStep.maxProcessingTime ?? 3000} 
                                                        onChange={e => setEditingStep({...editingStep, maxProcessingTime: Number(e.target.value)})}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                                                    />
                                                </div>
                                                <div className="col-span-2 text-xs text-slate-500 flex items-center gap-2">
                                                    <Dna size={12} />
                                                    Each task will take a unique random time between Min and Max.
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] text-slate-400 uppercase mb-1">Base Time</label>
                                                    <input 
                                                        type="number" step="100" min="100"
                                                        value={editingStep.processingTime ?? 1000} 
                                                        onChange={e => setEditingStep({...editingStep, processingTime: Number(e.target.value)})}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-slate-400 uppercase mb-1">Variance (0-1)</label>
                                                    <input 
                                                        type="range" min="0" max="1" step="0.1"
                                                        value={editingStep.variance ?? 0.1} 
                                                        onChange={e => setEditingStep({...editingStep, variance: parseFloat(e.target.value)})}
                                                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-3"
                                                    />
                                                    <div className="text-right text-xs text-slate-500 font-mono mt-1">{editingStep.variance}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Visual Color</label>
                                <div className="flex gap-3 items-center">
                                    <input 
                                        type="color" 
                                        value={editingStep.color || '#3b82f6'} 
                                        onChange={(e) => setEditingStep({...editingStep, color: e.target.value})}
                                        className="w-10 h-10 rounded border-none bg-transparent cursor-pointer"
                                    />
                                    <span className="font-mono text-sm text-slate-400 uppercase">{editingStep.color}</span>
                                </div>
                            </div>
                        </div>
                     )}

                     {/* Exceptions Tab */}
                     {activeTab === 'exceptions' && editingStep.type === 'process' && (
                        <div className="space-y-6">
                            <p className="text-sm text-slate-400">Configure random adverse events like failures or queue cancellations.</p>
                            
                            <div className="p-4 bg-red-900/10 border border-red-900/30 rounded-lg">
                                <label className="flex items-center gap-2 text-xs font-semibold text-red-400 uppercase mb-2">
                                    <AlertTriangle size={14}/> Failure / Defect Probability (0.0 - 1.0)
                                </label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="number" min="0" max="1" step="0.00001"
                                        value={editingStep.failureProbability ?? 0}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            setEditingStep({...editingStep, failureProbability: isNaN(val) ? 0 : Math.min(1, Math.max(0, val))})
                                        }}
                                        className="flex-1 bg-slate-800 border border-red-900/50 rounded-lg p-2 text-red-100 font-mono focus:ring-2 focus:ring-red-500 outline-none"
                                    />
                                    <span className="font-mono text-sm font-bold text-red-400 w-24 text-right">
                                        {((editingStep.failureProbability ?? 0) * 100).toFixed(4)}%
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2">
                                    Probability that a task will fail completely after finishing processing. Failed tasks do not move to the next step.
                                </p>
                            </div>

                            <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase mb-2">
                                    <Clock size={14}/> Cancellation Probability (0.0 - 1.0)
                                </label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="number" min="0" max="1" step="0.00001"
                                        value={editingStep.cancellationProbability ?? 0}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            setEditingStep({...editingStep, cancellationProbability: isNaN(val) ? 0 : Math.min(1, Math.max(0, val))})
                                        }}
                                        className="flex-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-slate-200 font-mono focus:ring-2 focus:ring-slate-500 outline-none"
                                    />
                                    <span className="font-mono text-sm font-bold text-slate-400 w-24 text-right">
                                        {((editingStep.cancellationProbability ?? 0) * 100).toFixed(4)}%
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2">
                                    Approximate probability per second that an item waiting in the queue will be cancelled (e.g. user leaves).
                                </p>
                            </div>
                        </div>
                     )}

                     {/* Connections Tab */}
                     {activeTab === 'connections' && editingStep.type !== 'end' && (
                         <div className="space-y-4">
                            <p className="text-sm text-slate-400 mb-2">Select which steps items can move to next, and set the probability.</p>
                            <div className="space-y-3">
                                {config.steps.filter(s => s.id !== editingStep.id).map(otherStep => {
                                    // Don't allow connections back to Start nodes
                                    if (otherStep.type === 'start') return null;

                                    const conn = editingStep.connections?.find(c => c.targetId === otherStep.id);
                                    const isConnected = !!conn;
                                    
                                    return (
                                        <div key={otherStep.id} className={`flex items-center justify-between p-3 rounded border transition-colors ${isConnected ? 'bg-slate-800 border-blue-500/50' : 'bg-slate-800/30 border-slate-700'}`}>
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="checkbox"
                                                    checked={isConnected}
                                                    onChange={(e) => toggleConnection(otherStep.id, e.target.checked)}
                                                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-slate-300 font-medium">
                                                    {otherStep.type === 'end' && <span className="text-red-400 mr-1">[END]</span>}
                                                    {otherStep.name}
                                                </span>
                                            </div>
                                            
                                            {isConnected && (
                                               <div className="flex items-center gap-2">
                                                   <span className="text-xs text-slate-500">Prob:</span>
                                                   <input 
                                                      type="number" min="0" max="1" step="0.1"
                                                      value={conn.probability}
                                                      onChange={(e) => updateProbability(otherStep.id, parseFloat(e.target.value))}
                                                      className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:border-blue-500 outline-none"
                                                   />
                                               </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {editingStep.connections.length > 0 && (
                                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300">
                                    Total Probability: {(editingStep.connections.reduce((sum, c) => sum + c.probability, 0) * 100).toFixed(0)}%
                                    {Math.abs(editingStep.connections.reduce((sum, c) => sum + c.probability, 0) - 1) > 0.01 && 
                                        <span className="block mt-1 text-amber-400 font-bold">Warning: Probabilities do not sum to 100%</span>
                                    }
                                </div>
                            )}
                         </div>
                     )}

                     {/* Rules Tab */}
                     {activeTab === 'rules' && editingStep.type !== 'start' && (
                         <div className="space-y-4">
                             <p className="text-sm text-slate-400 mb-4">Override processing time based on where the item came from. (Applies mainly to Fixed mode)</p>
                             
                             {potentialSources.length === 0 ? (
                                 <div className="text-center py-8 text-slate-500 italic">
                                     No steps connect to this one yet.
                                 </div>
                             ) : (
                                 <div className="space-y-3">
                                     {potentialSources.map(source => {
                                         const ruleTime = editingStep.sourceProcessingTimes?.[source.id];
                                         return (
                                             <div key={source.id} className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700">
                                                 <div className="flex items-center gap-2">
                                                     <div className="w-2 h-2 rounded-full" style={{ background: source.color }}></div>
                                                     <span className="text-sm text-slate-300">From: <b>{source.name}</b></span>
                                                 </div>
                                                 <div className="flex items-center gap-2">
                                                     <input 
                                                         type="number"
                                                         placeholder={`${editingStep.processingTime} (Default)`}
                                                         value={ruleTime || ''}
                                                         onChange={(e) => updateSourceRule(source.id, parseInt(e.target.value))}
                                                         className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-right focus:border-blue-500 outline-none"
                                                     />
                                                     <span className="text-xs text-slate-500 w-6">ms</span>
                                                 </div>
                                             </div>
                                         )
                                     })}
                                 </div>
                             )}
                         </div>
                     )}

                  </div>
                  <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-end gap-2 shrink-0">
                     <button 
                        onClick={() => setEditingStep(null)}
                        className="px-4 py-2 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                     >
                        Cancel
                     </button>
                     <button 
                        onClick={saveStepUpdate}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
                     >
                        Save Changes
                     </button>
                  </div>
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
