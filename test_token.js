const { GoogleGenAI, Modality } = require('@google/genai');

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'no-key-provided', // Provide actual key? No, grab from user's `.env`.
  httpOptions: { apiVersion: 'v1alpha' }
});

async function main() {
  try {
    const token = await ai.authTokens.create({
      config: {
          uses: 1,
          liveConnectConstraints: {
            model: "gemini-2.0-flash-live-001",
            config: {
                temperature: 0.8,
            }
          }
      }
    });
    console.log("Token response: ", JSON.stringify(token, null, 2));
  } catch (e) {
    console.log("Error: ", e.message);
  }
}
main();
