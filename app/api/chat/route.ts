import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const client = new Groq({
  apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || '', // Or throw an error if the key is missing
});

export async function POST(req: NextRequest) {
  try {
    const { userMessage, characterData, messages } = await req.json();

    const systemPrompt = `You are ${characterData.name}, a ${characterData.age}-year-old ${characterData.profession} who speaks in a ${characterData.tone} tone. ${characterData.description}`;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.filter((msg: { text: any; }) => msg.text).map((msg: { character: any; text: any; }) => ({
        role: msg.character ? 'assistant' : 'user',
        content: msg.text,
        name: msg.character ? characterData.name.replace(/\s+/g, '_') : 'user',
      })),
      { role: 'user', content: userMessage, name: 'user' },
    ];

    const chatCompletion = await client.chat.completions.create({
      messages: chatMessages,
      model: 'llama-3.1-8b', // Or your preferred model
      temperature: 0.7, // Adjust as needed
      max_tokens: 256, // Adjust as needed
    });

    return NextResponse.json(chatCompletion);
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
