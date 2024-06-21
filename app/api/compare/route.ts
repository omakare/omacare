import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Ollama from 'ollama';
import winston from 'winston';
import path from 'path';

// Logger configuration remains the same
const logger = winston.createLogger({
  // ... (logger configuration remains unchanged)
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function getChatGPTResponse(prompt: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 150,
  });
  return response.choices[0].message.content.trim();
}

async function getHaikuResponse(prompt: string) {
  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 150,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content[0].text;
}

async function getOllamaResponse(prompt: string) {
  const response = await Ollama.chat({
    model: 'llama3',
    messages: [{ role: 'user', content: prompt }],
  });
  return response.message.content;
}

export async function POST(request: Request) {
  try {
    const { prompt, model } = await request.json();

    if (!prompt) {
      logger.warn('Prompt is required but was not provided');
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    logger.info(`Received prompt: ${prompt}, Selected model: ${model}`);

    const responses: { chatgpt?: string; haiku?: string; ollama?: string } = {};

    if (model === 'all' || model === 'chatgpt') {
      responses.chatgpt = await getChatGPTResponse(prompt);
      logger.info(`ChatGPT response: ${responses.chatgpt}`);
    }

    if (model === 'all' || model === 'haiku') {
      responses.haiku = await getHaikuResponse(prompt);
      logger.info(`Claude 3 Haiku response: ${responses.haiku}`);
    }

    if (model === 'all' || model === 'ollama') {
      responses.ollama = await getOllamaResponse(prompt);
      logger.info(`Ollama response: ${responses.ollama}`);
    }

    return NextResponse.json(responses);
  } catch (error) {
    logger.error('Error in API route:', error);
    return NextResponse.json({ error: "Error fetching AI responses" }, { status: 500 });
  }
}