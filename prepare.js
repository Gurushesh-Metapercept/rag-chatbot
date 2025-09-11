import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
// import { OpenAIEmbeddings } from "@langchain/openai";
// import { PineconeStore } from "@langchain/pinecone";
// import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";

// const embeddings = new OpenAIEmbeddings({
//   model: "text-embedding-3-small",
// });

// const pinecone = new PineconeClient();

// const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

// export const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
//   pineconeIndex,
//   maxConcurrency: 5,
// });

export async function indexTheDocument(filePath) {
  const loader = new PDFLoader(filePath, { splitPages: false });
  const doc = await loader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  const texts = await textSplitter.splitText(doc[0].pageContent);
  console.log("👉 [prepare.js:30]: texts: ", texts.length);

  //   const documents = texts.map((chunk) => {
  //     return {
  //       pageContent: chunk,
  //       metadata: doc[0].metadata,
  //     };
  //   });

  //   await vectorStore.addDocuments(documents);
  // console.log(documents);
}
