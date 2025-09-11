import express from 'express';
import { vectorStore, hasDocuments } from './prepare.js';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json());
app.use(express.static('.'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!hasDocuments()) {
      return res.json({ 
        reply: 'No documents indexed. Please run "node rag.js" first.' 
      });
    }

    const results = await vectorStore.similaritySearch(message, 3);
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
          content: `Context: ${context}\n\nQuestion: ${message}`
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.1
    });
    
    res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    res.json({ reply: 'Error: ' + error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});