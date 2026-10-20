import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function askDebuggingAgent(brokenCode: string) {
  const { text } = await generateText({
    // Using the fast, highly capable, and completely free-tier Gemini model
    model: google('gemini-2.5-flash'), 
    
    // Paste the system instructions we built earlier here
    system: `You are a senior-level AI Coding Assistant. Your core mission is to analyze 
    codebase repositories, debug practical errors, and provide functional code corrections. 
    Briefly diagnose the issue and give the updated code block in full.`,
    
    prompt: `Please debug and fix this code: \n\n${brokenCode}`,
  });

  return text;
}
