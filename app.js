import "dotenv/config";
import Groq from "groq-sdk";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
  const chatCompletion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: "0.8",
    messages: [
      {
        role: "user",
        content: "ke hal chal",
      },
    ],
  });

  console.log(chatCompletion.choices[0].message);
}

main();
