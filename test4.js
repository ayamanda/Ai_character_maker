const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({
  apiKey: 'AIzaSyBk-wX5OhDs9OaHQiZ_Q7ivERV9cYiY0S4',
  httpOptions: { apiVersion: 'v1alpha' }
});

async function main() {
  try {
    const token = await ai.authTokens.create({
      config: {
          uses: 2,
          liveConnectConstraints: {}
      }
    });

    await testWebSocket(token.name, { 
      model: "models/gemini-3.1-flash-live-preview",
      systemInstruction: { parts: [{text: "You are a fun assistant."}] }
    });

  } catch (e) {
    console.log("Error minting: ", e);
  }
}

async function testWebSocket(accessToken, setupFields) {
    return new Promise((resolve) => {
        const WebSocket = require('ws');
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${accessToken}`;
        
        const ws = new WebSocket(wsUrl);
        ws.on('open', () => {
          console.log('WS Open!');
          ws.send(JSON.stringify({ setup: setupFields }));
          
          setTimeout(() => {
              console.log("Sending clientContent text...");
              ws.send(JSON.stringify({
                  clientContent: {
                      turns: [{ role: "user", parts: [{text: "Say hello loudly!"}] }],
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
main();
