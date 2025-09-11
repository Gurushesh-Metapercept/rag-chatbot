import readline from 'readline';
import { vectorStore, hasDocuments } from './prepare.js';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function chat() {
  if (!hasDocuments()) {
    console.log('No documents indexed. Run "node rag.js" first.');
    process.exit(1);
  }
  
  console.log('Chat with your document (type "exit" to quit):');
  
  const askQuestion = () => {
    rl.question('\nYou: ', async (query) => {
      if (query.toLowerCase() === 'exit') {
        rl.close();
        return;
      }
      
      const results = await vectorStore.similaritySearch(query, 3);
      const context = results.map(doc => doc.pageContent).join('\n\n');
      
      const response = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a document-specific AI assistant. You can ONLY answer questions about the content in the provided context.

CRITICAL RULES:
- FIRST check if the question is related to the provided context
- If the question is NOT related to the context, respond ONLY with: "I can only answer questions about the documents I have access to. Please ask about the content in my knowledge base."
- If the question IS related, then provide a structured answer using:
  - ## headings for main topics
  - **bold** for key terms
  - Numbered lists for processes
  - Bullet points for features
- Never include irrelevant context information
- Be concise and professional

Do NOT provide any context information unless it directly answers the user's question.`
          },
          {
            role: 'user',
            content: `Context: ${context}\n\nQuestion: ${query}`
          }
        ],
        model: 'llama-3.1-8b-instant',
        temperature: 0.1
      });
      
      console.log('\nBot:', response.choices[0].message.content);
      askQuestion();
    });
  };
  
  askQuestion();
}

chat();