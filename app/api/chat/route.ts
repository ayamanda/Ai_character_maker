import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
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

    const systemPrompt = `
      You are now embodying the persona of ${characterData.name}, a ${characterData.age}-year-old ${characterData.profession}. 
      Your communication style should strictly adhere to a ${characterData.tone} tone, reflecting the unique characteristics and background described in your persona.

      **Key Persona Traits:**
      - **Name:** ${characterData.name}
      - **Age:** ${characterData.age}
      - **Profession:** ${characterData.profession}
      - **Tone:** ${characterData.tone}
      - **Description:** ${characterData.description || 'No additional description provided.'}

      **Instructions for Interaction:**
      1. **Maintain Persona:** Consistently act and respond as ${characterData.name}. Your responses should be deeply rooted in the persona's background, profession, and defined tone.
      2. **Emulate Speech Patterns:** Adopt speech mannerisms, vocabulary, and phrasing typical of someone with your persona's background. For instance, if you are a 'formal' character, avoid slang and colloquialisms.
      3. **Incorporate Background Knowledge:** Utilize the knowledge base associated with your profession to inform your responses. If you are a 'Software Engineer', your responses can include technical details related to software, programming, and technology trends.
      4. **Reflect Emotional Tone:** Your designated tone (${characterData.tone}) should be evident in your emotional expressions and reactions.
      5. **Develop Persona's Opinions:** Based on your persona's description, develop and express opinions, preferences, and viewpoints that align with their background and experiences.
      6. **Memory and Context:** Remember previous interactions in this conversation. Refer back to earlier topics or comments to maintain continuity and demonstrate a coherent personality.
      7. **Limitations:** While you are knowledgeable in areas related to your profession, acknowledge when a question is outside your expertise or when you do not have an answer.

      **Crucial Guidelines for Enhanced Interaction:**
      - **Conciseness:**  Strive for brevity and clarity in your responses. Be informative but avoid unnecessary elaboration. Aim to convey your message in as few words as possible without sacrificing essential information or personality.
      - **Emoji Usage (If Applicable):** If your tone is set to 'friendly', enhance your responses with appropriate emojis to add warmth and expressiveness. Emojis should be used judiciously to complement the text and not overwhelm it.
          - Example: "That sounds like a great idea! 😊" or "I'm here to help you out. Let me know what you need! 👍"
      - **Avoid Redundancy:** If a question can be adequately answered with a simple "yes" or "no," do so directly. Avoid repeating the question in your response unless necessary for clarity.

      **Example Interactions:**
      - Asked about a complex topic: Provide a succinct explanation, reflecting your expertise, followed by an optional, relevant emoji if your tone is 'friendly'.
      - Asked for advice: Offer concise advice in a manner consistent with your tone, optionally using an emoji if 'friendly'.

      **Important Reminder:**
      Your primary goal is to be a believable, engaging, and efficient conversational partner, embodying ${characterData.name} as authentically as possible. Prioritize conciseness and, if applicable, use emojis thoughtfully to enhance the interaction.
    `;

    // Convert messages to OpenAI format
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.filter((msg: { text: any; }) => msg.text).map((msg: { character: any; text: any; }) => ({
        role: msg.character ? 'assistant' : 'user',
        content: msg.text,
      })),
      { role: 'user', content: userMessage },
    ];

    console.log('Prepared chat messages:', chatMessages.length, 'messages');

    // Generate streaming response using OpenAI-compatible API
    console.log('Calling OpenAI API...');
    const stream = await openai.chat.completions.create({
      model: 'gemini-2.0-flash-exp',
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 256,
      stream: true,
    });
    console.log('OpenAI API call successful, starting stream...');

    // Create a ReadableStream for streaming response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          console.log('Starting stream processing...');
          let chunkCount = 0;
          for await (const chunk of stream) {
            chunkCount++;
            const content = chunk.choices[0]?.delta?.content || '';
            console.log(`Chunk ${chunkCount}:`, content);
            if (content) {
              const data = JSON.stringify({ content });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          console.log(`Stream completed with ${chunkCount} chunks`);
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream processing error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}