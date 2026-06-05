const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env' });

async function main() {
  const adminAi = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { apiVersion: 'v1alpha' }
  });

  const tokenRes = await adminAi.authTokens.create({
    config: {
        uses: 3,
    }
  });

  const token = tokenRes.name;
  console.log("Got ephemeral token", token);

  const clientAi = new GoogleGenAI({
      apiKey: token,
      httpOptions: { apiVersion: 'v1alpha' }
  });

  try {
      const session = await clientAi.live.connect({
          model: "gemini-3.1-flash-live-preview",
          config: {
              systemInstruction: { parts: [{ text: "Respond very briefly." }] }
          }
      });
      console.log("Connected via SDK!");
      session.sendRealtimeInput({ text: "Hello!" });
      
      for await (const msg of session.receive()) {
          if (msg.serverContent && msg.serverContent.modelTurn) {
               console.log("Model response:", JSON.stringify(msg.serverContent.modelTurn));
          }
      }
  } catch (e) {
      console.error("SDK connect err:", e.message);
  }
}
main();
