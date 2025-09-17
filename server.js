import express from "express";
import { vectorStore, hasDocuments } from "./prepare.js";
import Groq from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json());
app.use(express.static("."));

// Middleware to set proper headers
app.use((req, res, next) => {
  res.header('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Store conversation context
const conversations = new Map();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Clean up old conversations (optional)
setInterval(() => {
  for (const [sessionId, conversation] of conversations.entries()) {
    if (conversation.messageCount === 0) {
      conversations.delete(sessionId);
    }
  }
}, 300000); // Clean every 5 minutes

// Query preprocessing function
function preprocessQuery(query) {
  // Expand common abbreviations and synonyms
  const expansions = {
    AI: "artificial intelligence",
    ML: "machine learning",
    API: "application programming interface",
    CEO: "chief executive officer",
    CTO: "chief technology officer",
  };

  let processed = query;
  Object.entries(expansions).forEach(([abbr, full]) => {
    processed = processed.replace(
      new RegExp(`\\b${abbr}\\b`, "gi"),
      `${abbr} ${full}`
    );
  });

  return processed;
}

// Format AI response for better readability
function formatResponse(response) {
  let formatted = response;
  
  // Convert asterisk bullet points to proper markdown
  formatted = formatted.replace(/^\* /gm, '- ');
  
  // Add headers for common patterns
  formatted = formatted
    .replace(/(Key features?|Main benefits?|Important points?):?\s*/gi, '### $1\n\n')
    .replace(/(Steps?|Process|How it works?):?\s*/gi, '### $1\n\n')
    .replace(/(Technologies?|Tools?|Components?):?\s*/gi, '### $1\n\n')
    .replace(/(Examples?|Use cases?):?\s*/gi, '### $1\n\n');
  
  // Ensure proper list formatting
  formatted = formatted.replace(/(\d+\.)\s+/g, '\n$1 ');
  formatted = formatted.replace(/^([\u2022\*-])\s+/gm, '- ');
  
  // Clean up spacing
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  return formatted.trim();
}

// Generate follow-up questions based on context
function generateFollowUp(context, query) {
  const followUps = {
    technology:
      "Would you like to know more about the technical implementation details?",
    features: "Should I explain how these features work together?",
    process: "Want to see the step-by-step implementation process?",
    benefits:
      "Would you like to explore the specific advantages this provides?",
    architecture: "Should we dive deeper into the system architecture?",
    integration:
      "Need help understanding how this integrates with other systems?",
    performance:
      "Want to know more about performance metrics and optimization?",
  };

  const contextLower = context.toLowerCase();
  for (const [key, question] of Object.entries(followUps)) {
    if (contextLower.includes(key)) return question;
  }

  return "Would you like me to elaborate on any specific aspect of this topic?";
}

// Check if message is agreement to follow-up
function isAgreement(message) {
  const agreements = [
    "yes",
    "sure",
    "okay",
    "ok",
    "please",
    "go ahead",
    "continue",
    "tell me more",
    "elaborate",
  ];
  return agreements.some((word) => message.toLowerCase().includes(word));
}

app.post("/chat", async (req, res) => {
  try {
    let { message, sessionId = "default" } = req.body;

    if (!hasDocuments()) {
      return res.json({
        reply: 'No documents indexed. Please run "node rag.js" first.',
      });
    }

    // Get conversation history
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, {
        lastContext: "",
        lastFollowUp: "",
        messageCount: 0,
        lastQuery: "",
      });
    }
    const conversation = conversations.get(sessionId);

    let context;
    let isFollowUpResponse = false;

    // Handle follow-up agreements
    if (
      conversation.lastFollowUp &&
      isAgreement(message) &&
      message.length < 20
    ) {
      // Use previous context for follow-up
      context = conversation.lastContext;
      isFollowUpResponse = true;

      // Transform follow-up question into a statement for the AI
      let transformedMessage = conversation.lastFollowUp;

      // Handle complex follow-up questions with "or" options
      if (transformedMessage.includes(" or ")) {
        // Extract the main topic before "or"
        const mainTopic = transformedMessage
          .split(" or ")[0]
          .replace(/Would you like to know more about/i, "")
          .replace(/Want to know more about/i, "")
          .replace(/Tell me about/i, "")
          .trim();
        transformedMessage = `Tell me more about ${mainTopic}`;
      } else {
        // Standard transformations
        transformedMessage = transformedMessage
          .replace(/Would you like to know more about/i, "Tell me more about")
          .replace(/Should I explain/i, "Explain")
          .replace(/Want to see/i, "Show")
          .replace(/Would you like to explore/i, "Explore")
          .replace(/Should we dive deeper into/i, "Dive deeper into")
          .replace(/Need help understanding/i, "Explain")
          .replace(/Want to know more about/i, "Tell me more about")
          .replace(/Would you like me to elaborate on/i, "Elaborate on")
          .replace(/\?$/, "");
      }

      message = transformedMessage;
    } else {
      // Normal query processing
      const processedQuery = preprocessQuery(message);

      // Enhanced context retrieval
      const results = await vectorStore.similaritySearch(processedQuery, 6);

      // Filter by relevance threshold
      const relevantResults = results.filter((doc) => doc.score > 0.3);

      if (relevantResults.length === 0) {
        return res.json({
          reply:
            "I couldn't find relevant information in the documents to answer your question. Please try rephrasing or ask about topics covered in the indexed documents.",
        });
      }

      context = relevantResults
        .map(
          (doc) =>
            `[Relevance: ${(doc.score * 100).toFixed(1)}%] ${doc.pageContent}`
        )
        .join("\n\n");
    }

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant that answers questions based on provided document context.

Formatting Rules:
- Use **bold** for important terms and concepts
- Use bullet points (- ) for lists
- Use numbered lists (1. ) for steps or processes
- Use ### for section headers when appropriate
- Use \`code\` for technical terms, file names, and commands
- Structure responses with clear paragraphs
- Add line breaks between different topics

Content Rules:
1. Answer ONLY using information from the provided context
2. If the context doesn't contain relevant information, say "I don't have information about that in the provided documents"
3. Be specific and cite relevant details from the context
4. Keep responses clear and well-structured with proper formatting
5. ${
            isFollowUpResponse
              ? "Focus on providing detailed information about the requested topic from the context"
              : "End with a relevant follow-up question to continue the conversation"
          }
6. If asked about topics not in the context, politely redirect to document-related questions`,
        },
        {
          role: "user",
          content: `Context: ${context}\n\nQuestion: ${message}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
    });

    let reply = formatResponse(response.choices[0].message.content);

    // Add follow-up question only for new queries, not follow-up responses
    if (!isFollowUpResponse) {
      if (!reply.includes("?")) {
        const followUp = generateFollowUp(context, message);
        reply += `\n\n${followUp}`;
        conversation.lastFollowUp = followUp;
      } else {
        // Extract the follow-up question from the response
        const questionMatch =
          reply.match(/Would you like to know more about ([^?]+)\?/i) ||
          reply.match(/Want to know more about ([^?]+)\?/i) ||
          reply.match(/([^.!?]*\?[^.!?]*)/g);

        if (questionMatch) {
          if (Array.isArray(questionMatch)) {
            // Take the last question in the response
            conversation.lastFollowUp =
              questionMatch[questionMatch.length - 1].trim();
          } else {
            conversation.lastFollowUp = questionMatch[0].trim();
          }
        }
      }
    } else {
      // Clear follow-up after responding to it
      conversation.lastFollowUp = "";
    }

    // Update conversation context
    if (!isFollowUpResponse) {
      conversation.lastContext = context;
      conversation.lastQuery = message;
    }
    conversation.messageCount++;

    res.json({ reply });
  } catch (error) {
    res.json({ reply: "Error: " + error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
