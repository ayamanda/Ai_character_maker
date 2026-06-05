const WebSocket = require('ws');

async function testWebSocket(accessToken) {
    return new Promise((resolve) => {
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${accessToken}`;
        
        const ws = new WebSocket(wsUrl);
        ws.on('open', () => {
          console.log('WS Open!');
          ws.send(JSON.stringify({ 
              setup: { 
                  model: "models/gemini-3.1-flash-live-preview",
                  generationConfig: { responseModalities: ["AUDIO"] },
                  systemInstruction: { parts: [{text: "You are a helpful assistant."}] }
              } 
          }));
          
          setTimeout(() => {
              console.log("Sending clientContent text...");
              // Test what works for text first
              ws.send(JSON.stringify({
                  clientContent: {
                      turns: [{ role: "user", parts: [{text: "Hello!"}] }],
                      turnComplete: true
                  }
              }));
          }, 1000);
        });
        ws.on('error', (e) => { console.log('WS error:', e); resolve(); });
        ws.on('message', (m) => { console.log('WS msg:', m.toString()); });
        ws.on('close', (code, reason) => { console.log('WS close:', code, reason?.toString()); resolve(); });
    });
}

// Reuse an ephemeral token or quickly mint a new one
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({
  apiKey: 'AIzaSyBk-wX5OhDs9OaHQiZ_Q7ivERV9cYiY0S4',
  httpOptions: { apiVersion: 'v1alpha' }
});

ai.authTokens.create({ config: { uses: 2 } }).then(tokenRes => {
    testWebSocket(tokenRes.name);
});
