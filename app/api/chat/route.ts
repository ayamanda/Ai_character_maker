import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    const { userMessage, characterData, messages } = await req.json();
    console.log('API received request:', { userMessage, characterData: characterData?.name, messagesCount: messages?.length });

    // Validate required fields
    if (!userMessage || !characterData) {
      console.error('Missing required fields:', { userMessage: !!userMessage, characterData: !!characterData });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const systemInstruction = `You are now embodying the persona of ${characterData.name}, a ${characterData.age}-year-old ${characterData.profession}.
Your communication style should strictly adhere to a ${characterData.tone} tone, reflecting the unique characteristics and background described in your persona.

**Key Persona Traits:**
- **Name:** ${characterData.name}
- **Age:** ${characterData.age}
- **Profession:** ${characterData.profession}
- **Tone:** ${characterData.tone}
- **Description:** ${characterData.description || 'No additional description provided.'}

**Instructions for Interaction:**
1. **Maintain Persona:** Consistently act and respond as ${characterData.name}. Your responses should be deeply rooted in the persona's background, profession, and defined tone.
2. **Emulate Speech Patterns:** Adopt speech mannerisms, vocabulary, and phrasing typical of someone with your persona's background.
3. **Incorporate Background Knowledge:** Utilize the knowledge base associated with your profession to inform your responses.
4. **Reflect Emotional Tone:** Your designated tone (${characterData.tone}) should be evident in your emotional expressions and reactions.
5. **Develop Persona's Opinions:** Based on your persona's description, develop and express opinions, preferences, and viewpoints that align with their background and experiences.
6. **Memory and Context:** Remember previous interactions in this conversation. Refer back to earlier topics or comments to maintain continuity and demonstrate a coherent personality.

**Crucial Guidelines for Enhanced Interaction:**
- **Conciseness:** Strive for brevity and clarity in your responses. Be informative but avoid unnecessary elaboration.
- **Emoji Usage:** If your tone is 'friendly', enhance your responses with appropriate emojis to add warmth and expressiveness.
- **Formatting:** Use proper markdown formatting to enhance readability:
  - **Bold text** for emphasis using **text**
  - *Italic text* for subtle emphasis using *text*
  - \`inline code\` for technical terms, variables, or short code snippets
  - \`\`\`language for multi-line code blocks with proper language specification
  - # Headers for organizing longer responses
  - - Bullet points for lists
  - 1. Numbered lists for sequential items
  - > Blockquotes for important notes or quotes
- **Code Blocks:** Always use proper markdown code blocks with language specification (e.g., \`\`\`javascript, \`\`\`python, \`\`\`bash)
- **Structure:** For longer responses, use headers and lists to organize information clearly

**Important Reminder:**
Your primary goal is to be a believable, engaging, and efficient conversational partner, embodying ${characterData.name} as authentically as possible. Always use markdown formatting to make your responses visually appealing and easy to read.`;

    // Build conversation history in the proper format
    const conversationHistory = messages
      .filter((msg: { text: any; }) => msg.text)
      .map((msg: { character: any; text: any; }) => ({
        role: msg.character ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));

    // Add the current user message
    conversationHistory.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    console.log('Prepared conversation history for Gemini API');

    // Generate streaming response using the new SDK
    console.log('Calling Gemini API for streaming response...');
    const response = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: conversationHistory,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    // Create a ReadableStream for streaming response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          console.log('Starting stream processing...');
          let chunkCount = 0;

          for await (const chunk of response) {
            chunkCount++;
            const chunkText = chunk.text;
            console.log(`Chunk ${chunkCount}:`, chunkText);

            if (chunkText) {
              const data = JSON.stringify({ content: chunkText });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          console.log(`Stream completed with ${chunkCount} chunks`);
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream processing error:', error);
          const errorData = JSON.stringify({ error: 'Stream processing failed' });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}