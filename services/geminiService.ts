import { GoogleGenAI, Type } from "@google/genai";
import { ProcessStep, StepStats, SimulationStats, ColorTheme } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in process.env");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

const THEMES: ColorTheme[] = ['blue', 'emerald', 'amber', 'rose', 'purple', 'cyan', 'indigo'];

const THEME_COLORS: Record<ColorTheme, string> = {
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  indigo: '#6366f1'
};

export const generateScenario = async (prompt: string): Promise<ProcessStep[]> => {
  const ai = getAiClient();
  if (!ai) throw new Error("API Key is missing. Please select a key.");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create a process simulation scenario for: "${prompt}". 
      Return a JSON array of process steps. 
      Each step must have: name (string), capacity (integer 1-10), processingTime (milliseconds, 500-10000), variance (0.1-0.5).
      Make it realistic.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              capacity: { type: Type.INTEGER },
              processingTime: { type: Type.INTEGER },
              variance: { type: Type.NUMBER },
            },
            required: ["name", "capacity", "processingTime", "variance"],
          },
        },
      },
    });

    const json = JSON.parse(response.text);
    const timestamp = Date.now();

    // Add IDs, Colors, and default connections
    return json.map((step: any, index: number) => {
      const theme = THEMES[index % THEMES.length];
      const currentId = `generated-step-${index}-${timestamp}`;
      const nextId = index < json.length - 1 ? `generated-step-${index + 1}-${timestamp}` : null;

      return {
        ...step,
        id: currentId,
        color: THEME_COLORS[theme],
        connections: nextId ? [{ targetId: nextId, probability: 1.0 }] : [],
      };
    });
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

export const analyzeBottlenecks = async (
  steps: ProcessStep[],
  stepStats: StepStats[],
  globalStats: SimulationStats
): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "AI Analysis unavailable without API Key.";

  const data = {
    config: steps.map(s => ({ name: s.name, capacity: s.capacity, time: s.processingTime })),
    currentStats: stepStats.map(s => ({ 
      stepId: s.stepId, 
      queue: s.queueLength, 
      utilization: s.utilization.toFixed(2),
      avgWait: s.avgWaitTime.toFixed(0) + 'ms'
    })),
    global: {
      finished: globalStats.totalItemsFinished,
      throughput: globalStats.avgThroughput.toFixed(1) + '/min',
      cycleTime: globalStats.avgCycleTime.toFixed(0) + 'ms'
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze this process simulation data and find the bottleneck. Suggest optimizations. Keep it brief (max 3 sentences).
      Data: ${JSON.stringify(data, null, 2)}`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Failed to analyze data.";
  }
};