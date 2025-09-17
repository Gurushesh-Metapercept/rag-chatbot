import "dotenv/config";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from "fs";
import { pipeline } from "@xenova/transformers";

const STORAGE_FILE = "./documents.json";

class SimpleVectorStore {
  constructor() {
    this.documents = this.loadDocuments();
    this.embedder = null;
    this.initEmbedder();
  }

  async initEmbedder() {
    this.embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }

  loadDocuments() {
    if (fs.existsSync(STORAGE_FILE)) {
      return JSON.parse(fs.readFileSync(STORAGE_FILE, "utf8"));
    }
    return [];
  }

  saveDocuments() {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(this.documents, null, 2));
  }

  async addDocuments(docs) {
    if (!this.embedder) await this.initEmbedder();

    for (const doc of docs) {
      const embedding = await this.embedder(doc.pageContent, {
        pooling: "mean",
        normalize: true,
      });
      doc.embedding = Array.from(embedding.data);
    }

    this.documents.push(...docs);
    this.saveDocuments();
  }

  async similaritySearch(query, k = 3) {
    if (!this.embedder) await this.initEmbedder();

    const queryEmbedding = await this.embedder(query, {
      pooling: "mean",
      normalize: true,
    });
    const queryVector = Array.from(queryEmbedding.data);

    return this.documents
      .map((doc) => ({
        ...doc,
        score: this.cosineSimilarity(queryVector, doc.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export const vectorStore = new SimpleVectorStore();

export function hasDocuments() {
  return vectorStore.documents.length > 0;
}

export function clearDocuments() {
  vectorStore.documents = [];
  vectorStore.saveDocuments();
}

function getLoader(filePath) {
  const ext = filePath.toLowerCase().split(".").pop();

  switch (ext) {
    case "pdf":
      return new PDFLoader(filePath, { splitPages: false });
    case "docx":
      return new DocxLoader(filePath);
    case "csv":
      return new CSVLoader(filePath);
    case "txt":
    case "md":
    case "markdown":
      return new TextLoader(filePath);
    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
}

export async function indexTheDocument(filePath) {
  const loader = getLoader(filePath);
  const doc = await loader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,  // Smaller chunks for better precision
    chunkOverlap: 150,
    separators: ['\n\n', '\n', '. ', ' ', ''],  // Better sentence preservation
  });

  const texts = await textSplitter.splitText(doc[0].pageContent);

  const documents = texts.map((chunk, index) => {
    return {
      pageContent: chunk,
      metadata: {
        ...doc[0].metadata,
        chunkIndex: index,
        chunkLength: chunk.length,
        source: filePath
      },
    };
  });

  await vectorStore.addDocuments(documents);
}
