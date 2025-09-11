import "dotenv/config";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from 'fs';

const STORAGE_FILE = './documents.json';

class SimpleVectorStore {
  constructor() {
    this.documents = this.loadDocuments();
  }

  loadDocuments() {
    if (fs.existsSync(STORAGE_FILE)) {
      return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
    }
    return [];
  }

  saveDocuments() {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(this.documents, null, 2));
  }

  async addDocuments(docs) {
    this.documents.push(...docs);
    this.saveDocuments();
  }

  async similaritySearch(query, k = 3) {
    return this.documents
      .map(doc => ({
        ...doc,
        score: this.calculateSimilarity(query, doc.pageContent)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  calculateSimilarity(query, text) {
    const queryWords = query.toLowerCase().split(' ');
    const textWords = text.toLowerCase().split(' ');
    const matches = queryWords.filter(word => textWords.includes(word));
    return matches.length / queryWords.length;
  }
}

export const vectorStore = new SimpleVectorStore();

export function hasDocuments() {
  return vectorStore.documents.length > 0;
}

export async function indexTheDocument(filePath) {
  const loader = new PDFLoader(filePath, { splitPages: false });
  const doc = await loader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  const texts = await textSplitter.splitText(doc[0].pageContent);

  const documents = texts.map((chunk) => {
    return {
      pageContent: chunk,
      metadata: doc[0].metadata,
    };
  });

  await vectorStore.addDocuments(documents);
}