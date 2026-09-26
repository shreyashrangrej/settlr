import { ConvexError } from 'convex/values'

import { env } from '../_generated/server'

// A minimal OpenRouter chat-completions client (the OpenAI format) with
// tool calling, for the assistant (convex/assistant.ts). Runs in actions.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const TIMEOUT_MS = 45_000

export type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: Array<ToolCall> }
  | { role: 'tool'; tool_call_id: string; content: string }

export type ToolDefinition = {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unavailable(): never {
  throw new ConvexError('The assistant is unavailable right now. Try again in a moment.')
}

/** One chat completion: the model's text and any tool calls it made. */
export async function complete({
  apiKey,
  model,
  messages,
  tools,
}: {
  apiKey: string
  model: string
  messages: Array<ChatMessage>
  tools: Array<ToolDefinition>
}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        // Optional attribution for OpenRouter's app rankings.
        'HTTP-Referer': env.SITE_URL,
        'X-Title': 'Settlr',
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    console.error('OpenRouter request failed', err)
    unavailable()
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) {
    console.error(`OpenRouter responded ${response.status}`, await response.text())
    unavailable()
  }

  const body: unknown = await response.json()
  const choice = isRecord(body) && Array.isArray(body.choices) ? body.choices[0] : null
  const message = isRecord(choice) && isRecord(choice.message) ? choice.message : null
  if (!message) {
    console.error('Unexpected OpenRouter response', body)
    unavailable()
  }
  const toolCalls: Array<ToolCall> = []
  if (Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      if (
        isRecord(call) &&
        typeof call.id === 'string' &&
        isRecord(call.function) &&
        typeof call.function.name === 'string'
      ) {
        toolCalls.push({
          id: call.id,
          type: 'function',
          function: {
            name: call.function.name,
            arguments:
              typeof call.function.arguments === 'string' ? call.function.arguments : '{}',
          },
        })
      }
    }
  }
  return {
    content: typeof message.content === 'string' ? message.content.trim() : '',
    toolCalls,
  }
}
