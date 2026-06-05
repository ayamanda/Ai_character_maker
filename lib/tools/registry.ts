/**
 * lib/tools/registry.ts
 *
 * Tool registry for Gemini function calling (Phase 2).
 * Each entry has:
 *   - declaration: Gemini FunctionDeclaration schema
 *   - handler: server-side executor returning the tool result
 *
 * Adding a new tool: add an entry here. The agentic loop in
 * app/api/chat/route.ts picks up all registered tools automatically.
 */

import type { FunctionDeclaration } from '@google/genai';
import { Type } from '@google/genai';
import { CharacterData } from '@/types';

// ─── Tool handler type ────────────────────────────────────────────────────────

type ToolHandler = (args: Record<string, unknown>, context?: ToolContext) => Promise<unknown>;

export interface ToolContext {
  characterData?: CharacterData;
  userId?: string;
}

export interface RegistryEntry {
  declaration: FunctionDeclaration;
  handler: ToolHandler;
  /** Whether this tool requires user approval before execution */
  requiresApproval?: boolean;
}

// ─── Tool implementations ─────────────────────────────────────────────────────

const getCurrentTime: RegistryEntry = {
  declaration: {
    name: 'get_current_time',
    description: 'Returns the current date and time in UTC and local context.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        timezone: {
          type: Type.STRING,
          description: 'Optional IANA timezone name (e.g. "Asia/Kolkata"). Defaults to UTC.',
        },
      },
      required: [],
    },
  },
  handler: async (args) => {
    const tz = (args.timezone as string) || 'UTC';
    const now = new Date();
    try {
      const formatted = now.toLocaleString('en-US', {
        timeZone: tz,
        dateStyle: 'full',
        timeStyle: 'long',
      });
      return { datetime: formatted, utc: now.toISOString(), timezone: tz };
    } catch {
      return { datetime: now.toUTCString(), utc: now.toISOString(), timezone: 'UTC' };
    }
  },
};

const getWeather: RegistryEntry = {
  declaration: {
    name: 'get_weather',
    description: 'Get the current weather conditions for a city. Returns temperature, conditions, and humidity.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        city: {
          type: Type.STRING,
          description: 'City name (e.g. "London", "New York", "Tokyo")',
        },
        units: {
          type: Type.STRING,
          description: 'Temperature units: "celsius" or "fahrenheit". Defaults to celsius.',
          enum: ['celsius', 'fahrenheit'],
        },
      },
      required: ['city'],
    },
  },
  handler: async (args) => {
    const city = args.city as string;
    // In production, call a real weather API (e.g. OpenWeatherMap)
    // For now, return a plausible simulated response
    const mockData: Record<string, unknown> = {
      city,
      temperature: Math.round(15 + Math.random() * 20),
      units: args.units || 'celsius',
      condition: ['Sunny', 'Partly cloudy', 'Overcast', 'Light rain'][Math.floor(Math.random() * 4)],
      humidity: Math.round(40 + Math.random() * 40),
      feelsLike: Math.round(13 + Math.random() * 20),
    };
    return mockData;
  },
};

const getCharacterProfile: RegistryEntry = {
  declaration: {
    name: 'get_character_profile',
    description: 'Retrieves the full profile of the current AI character being chatted with, including their backstory, profession, and personality traits.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: [],
    },
  },
  handler: async (_args, context) => {
    if (!context?.characterData) {
      return { error: 'No character context available' };
    }
    const { id: _id, ...safe } = context.characterData;
    return safe;
  },
};

const calculateMath: RegistryEntry = {
  declaration: {
    name: 'calculate',
    description: 'Evaluate a mathematical expression and return the result. Safe for basic arithmetic, percentages, and simple algebra.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        expression: {
          type: Type.STRING,
          description: 'Math expression to evaluate (e.g. "15% of 240", "sqrt(144)", "2^10")',
        },
      },
      required: ['expression'],
    },
  },
  handler: async (args) => {
    const expr = (args.expression as string)
      .replace(/[^0-9+\-*/().,% sqrtabcde]/g, '')   // basic sanitisation
      .replace(/sqrt/g, 'Math.sqrt')
      .replace(/(\d+)%\s*of\s*(\d+)/g, '($1/100)*$2');
    try {
      // eslint-disable-next-line no-eval
      const result = Function(`"use strict"; return (${expr})`)();
      return { expression: args.expression, result };
    } catch {
      return { error: 'Could not evaluate expression', expression: args.expression };
    }
  },
};

// ─── Registry export ──────────────────────────────────────────────────────────

export const TOOL_REGISTRY: Record<string, RegistryEntry> = {
  get_current_time: getCurrentTime,
  get_weather: getWeather,
  get_character_profile: getCharacterProfile,
  calculate: calculateMath,
};

/** Returns all function declarations for the Gemini API config */
export function getToolDeclarations(): FunctionDeclaration[] {
  return Object.values(TOOL_REGISTRY).map((entry) => entry.declaration);
}

/** Execute a tool by name, returns its result or an error object */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context?: ToolContext
): Promise<unknown> {
  const entry = TOOL_REGISTRY[name];
  if (!entry) {
    return { error: `Unknown tool: ${name}` };
  }
  try {
    return await entry.handler(args, context);
  } catch (err: any) {
    console.error(`[tool:${name}] execution error:`, err);
    return { error: err?.message ?? 'Tool execution failed', tool: name };
  }
}
