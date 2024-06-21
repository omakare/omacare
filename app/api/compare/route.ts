import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Ollama from 'ollama';
import winston from 'winston';
import path from 'path';
// @ts-ignore
import { getSubtitles } from 'youtube-captions-scraper';

// Use case introductions
const USE_CASE_INTROS = {
  careGroups: "Find support and care groups for various medical conditions in specific locations.",
  patientWebinars: "Analyze patient webinars to extract key information, speakers, and topics discussed.",
  research: "Get insights on medical research topics from the perspective of top researchers in the field.",
  grants: "Discover financial support and grant opportunities for medical conditions and assistance with applications."
};

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'combined.log') 
    }),
  ],
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function getYoutubeTranscript(videoUrl: string): Promise<string> {
  try {
    const videoId = new URL(videoUrl).searchParams.get('v');
    if (!videoId) throw new Error('Invalid YouTube URL');

    const captions = await getSubtitles({ videoID: videoId });
    // @ts-ignore
    return captions.map(caption => caption.text).join(' ');
  } catch (error) {
    logger.error('Error fetching YouTube transcript:', error);
    throw new Error('Failed to fetch YouTube transcript');
  }
}

function parseResearcherInfo(content: string): any[] {
  if (!content) {
    return [];
  }
  const researchers = content.split('\n\n').filter(r => r.trim() !== '');
  return researchers.map(researcher => {
    const lines = researcher.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 4) {
      return null;
    }
    const name = lines[0].replace(/^\d+\.\s*/, '').trim();
    const position = lines[1].trim();
    const contribution = lines[2].trim();
    const papers = lines.slice(3).map(p => p.trim());
    return { name, position, contribution, papers };
  }).filter(r => r !== null);
}

async function getResearchersInfo(model: 'chatgpt' | 'haiku' | 'ollama', topic: string) {
  const researcherPrompt = `Provide information on three top researchers in the field of ${topic}. For each researcher, include:
1. Name
2. Current position or affiliation
3. A brief description of their contributions to ${topic} research
4. Titles of two relevant papers they have published on ${topic} (with year of publication)

Format the response as a list of three researchers, each separated by a blank line.`;

  let researchersInfo: any[] = [];

  try {
    switch (model) {
      case 'chatgpt':
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: researcherPrompt }],
          max_tokens: 1000,
        });
        researchersInfo = parseResearcherInfo(response.choices[0]?.message?.content ?? '');
        break;

      case 'haiku':
        const haikuResponse = await anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 1000,
          messages: [{ role: "user", content: researcherPrompt }],
        });
        // @ts-ignore
        researchersInfo = parseResearcherInfo(haikuResponse.content[0].text);
        break;

      case 'ollama':
        const ollamaResponse = await Ollama.chat({
          model: 'llama3',
          messages: [{ role: 'user', content: researcherPrompt }],
        });
        researchersInfo = parseResearcherInfo(ollamaResponse.message.content);
        break;
    }
  } catch (error) {
    logger.error(`Error getting researchers info for ${model}:`, error);
  }

  return researchersInfo;
}

async function getResearchResponse(model: 'chatgpt' | 'haiku' | 'ollama', prompt: string) {
  const topic = prompt.split(' ').slice(0, 3).join(' '); // Extract first 3 words as topic
  const researchers = await getResearchersInfo(model, topic);

  if (researchers.length === 0) {
    return `Unable to retrieve researcher information for ${topic}.`;
  }

  const systemPrompt = `You are an AI assistant providing information about ${topic} from the perspective of top researchers in the field. For each researcher, provide their view on the question, focusing on their area of expertise and citing their relevant papers. The researchers are:

${researchers.map((r, i) => `${i + 1}. ${r.name}: ${r.position}`).join('\n')}

Provide a concise answer from each researcher's perspective, and include citations to their papers at the end of each response.`;

  const userPrompt = `Question about ${topic}: ${prompt}\n\nPlease provide answers from the perspective of each researcher, followed by citations to their relevant papers.`;

  try {
    switch (model) {
      case 'chatgpt':
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 1000,
        });
        return response.choices[0]?.message?.content?.trim() ?? 'No response received';

      case 'haiku':
        const haikuResponse = await anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt }
          ],
        });
        // @ts-ignore
        return haikuResponse.content[0].text;

      case 'ollama':
        const ollamaResponse = await Ollama.chat({
          model: 'llama3',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        });
        return ollamaResponse.message.content;
    }
  } catch (error) {
    logger.error(`Error getting research response for ${model}:`, error);
    return `Error: Unable to get response from ${model}`;
  }
}

async function getCareGroupsResponse(model: 'chatgpt' | 'haiku' | 'ollama', prompt: string) {
  const systemPrompt = "You are an AI assistant specialized in finding care groups in specific locations.";
  const userPrompt = `Find care groups for patients in the following location: ${prompt}`;

  try {
    switch (model) {
      case 'chatgpt':
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 500,
        });
        return response.choices[0]?.message?.content?.trim() ?? 'No response received';

      case 'haiku':
        const haikuResponse = await anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 500,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt }
          ],
        });
        // @ts-ignore
        return haikuResponse.content[0].text;

      case 'ollama':
        const ollamaResponse = await Ollama.chat({
          model: 'llama3',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        });
        return ollamaResponse.message.content;
    }
  } catch (error) {
    logger.error(`Error getting care groups response for ${model}:`, error);
    return `Error: Unable to get response from ${model}`;
  }
}

async function getGrantsResponse(model: 'chatgpt' | 'haiku' | 'ollama', prompt: string) {
  const systemPrompt = "You are an AI assistant specializing in medical grant applications and support groups.";
  const userPrompt = `Provide information on grants and support groups based on the following query: ${prompt}`;

  try {
    switch (model) {
      case 'chatgpt':
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 500,
        });
        return response.choices[0]?.message?.content?.trim() ?? 'No response received';

      case 'haiku':
        const haikuResponse = await anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 500,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt }
          ],
        });
        // @ts-ignore
        return haikuResponse.content[0].text;

      case 'ollama':
        const ollamaResponse = await Ollama.chat({
          model: 'llama3',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        });
        return ollamaResponse.message.content;
    }
  } catch (error) {
    logger.error(`Error getting grants response for ${model}:`, error);
    return `Error: Unable to get response from ${model}`;
  }
}

async function getPatientWebinarsResponse(model: 'chatgpt' | 'haiku' | 'ollama', videoUrl: string) {
  try {
    const transcript = await getYoutubeTranscript(videoUrl);
    const systemPrompt = "You are an AI assistant specialized in analyzing patient webinar transcripts. Provide a summary of people mentioned and topics discussed.";
    const userPrompt = `Analyze the following webinar transcript. List all the people mentioned and topics discussed:\n\n${transcript}`;

    switch (model) {
      case 'chatgpt':
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 500,
        });
        return response.choices[0]?.message?.content?.trim() ?? 'No response received';

      case 'haiku':
        const haikuResponse = await anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 500,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt }
          ],
        });
        // @ts-ignore
        return haikuResponse.content[0].text;

      case 'ollama':
        const ollamaResponse = await Ollama.chat({
          model: 'llama3',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        });
        return ollamaResponse.message.content;
    }
  } catch (error) {
    logger.error('Error in getPatientWebinarsResponse:', error);
    return 'Error: Unable to analyze the webinar';
  }
}

async function processModelResponse(model: 'chatgpt' | 'haiku' | 'ollama', useCase: string, prompt: string, videoUrl: string) {
  switch (useCase) {
    case 'research':
      return await getResearchResponse(model, prompt);
    case 'careGroups':
      return await getCareGroupsResponse(model, prompt);
    case 'grants':
      return await getGrantsResponse(model, prompt);
    case 'patientWebinars':
      return await getPatientWebinarsResponse(model, videoUrl);
    default:
      return 'Invalid use case';
  }
}

export async function POST(request: Request) {
  try {
    const { prompt, model, useCase, videoUrl } = await request.json();

    if (!prompt && !videoUrl) {
      logger.warn('Prompt or video URL is required but was not provided');
      return NextResponse.json({ error: "Prompt or video URL is required" }, { status: 400 });
    }

    logger.info(`Received prompt: ${prompt}, Selected model: ${model}, Use case: ${useCase}, Video URL: ${videoUrl}`);

    const responses: { chatgpt?: string; haiku?: string; ollama?: string } = {};

    const processModel = async (modelType: 'chatgpt' | 'haiku' | 'ollama') => {
      try {
        const intro = USE_CASE_INTROS[useCase as keyof typeof USE_CASE_INTROS] || '';
        const response = await processModelResponse(modelType, useCase, prompt, videoUrl);
        responses[modelType] = `${intro}\n\n${response}`;
      } catch (error) {
        logger.error(`Error processing ${modelType} for ${useCase}:`, error);
        responses[modelType] = `Error: Unable to process ${useCase} with ${modelType}`;
      }
    };

    if (model === 'all') {
      await Promise.all(['chatgpt', 'haiku', 'ollama'].map(m => processModel(m as 'chatgpt' | 'haiku' | 'ollama')));
    } else if (model === 'claude-chatgpt') {
      await Promise.all(['chatgpt', 'haiku'].map(m => processModel(m as 'chatgpt' | 'haiku')));
    } else {
      await processModel(model as 'chatgpt' | 'haiku' | 'ollama');
    }

    return NextResponse.json(responses);
  } catch (error) {
    logger.error('Error in API route:', error);
    return NextResponse.json({ error: "Error fetching AI responses" }, { status: 500 });
  }
}