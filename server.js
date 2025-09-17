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

## Response Formatting Guidelines

**Visual Structure:**
- Start with a clear, engaging opening sentence
- Use **bold** for key terms, important concepts, and emphasis
- Use \`code formatting\` for technical terms, file names, commands, and specific values
- Use > blockquotes for important notes, warnings, or key takeaways
- Create visual hierarchy with proper spacing between sections

**Content Organization:**
- Break information into digestible paragraphs (2-3 sentences each)
- Use bullet points (-) for feature lists, benefits, or related items
- Use numbered lists (1. 2. 3.) for sequential steps or processes
- NEVER use ### headers in the middle of sentences or words
- Only use ### headers at the start of new lines for major sections
- Write in flowing paragraphs without unnecessary headers
- Add blank lines between different topics for better readability

**Writing Style:**
- Write in a conversational yet professional tone
- Start with the most important information first
- Use active voice and clear, concise language
- Provide specific examples when available in context
- End paragraphs with strong, informative statements

**Content Rules:**
1. Answer ONLY using information from the provided context
2. If context lacks relevant info, say "I don't have information about that in the provided documents"
3. Be specific and cite relevant details from context
4. ${
            isFollowUpResponse
              ? "Focus on providing detailed information about the requested topic from the context"
              : "End with a relevant follow-up question to continue the conversation"
          }
5. Structure responses with clear visual hierarchy and proper markdown formatting`,
        },
        {
          role: "user",
          content: `Context: ${context}\n\nQuestion: ${message}`,
        },
      ],
      model: "openai/gpt-oss-120b", //llama-3.3-70b-versatile
      temperature: 0.1,
    });

    let reply = response.choices[0].message.content
      .replace(/###\s*([a-z])/g, "$1") // Remove ### before lowercase words
      .replace(/###\s*$/gm, "") // Remove standalone ### at line ends
      .trim();

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
