const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env' });
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { apiVersion: 'v1alpha' }
});

async function main() {
  try {
    const token = await ai.authTokens.create({
      config: {
          uses: 2, 
          liveConnectConstraints: {
            model: "models/gemini-3.1-flash-live-preview"
          }
      }
    });
    
    await testWebSocket(token.name);

  } catch (e) {
    console.log("Error: ", e.message);
  }
}

async function testWebSocket(accessToken) {
    return new Promise((resolve) => {
        const WebSocket = require('ws');
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${accessToken}`;
        
        const ws = new WebSocket(wsUrl);
        ws.on('open', () => {
          console.log('WS Open! Sending text to see if it responds without setup');
          setTimeout(() => {
              ws.send(JSON.stringify({
                  realtimeInput: { text: "Hello there!" }
              }));
          }, 1000);
        });
        ws.on('error', (e) => { console.log('WS error:', e); resolve(); });
        ws.on('message', (m) => { console.log('WS msg:', m.toString()); resolve(); });
        ws.on('close', (code, reason) => { console.log('WS close:', code, reason?.toString()); resolve(); });
    });
}
main();
