import "dotenv/config";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import fs from "fs";

const FAISS_DIRECTORY = "./faiss_store";

class FAISSVectorStore {
  constructor() {
    this.store = null;
    this.embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: "Xenova/all-MiniLM-L6-v2",
    });
    this.loadStore();
  }

  async loadStore() {
    if (fs.existsSync(FAISS_DIRECTORY)) {
      this.store = await FaissStore.load(FAISS_DIRECTORY, this.embeddings);
    }
  }

  async addDocuments(docs) {
    if (!this.store) {
      this.store = await FaissStore.fromDocuments(docs, this.embeddings);
    } else {
      await this.store.addDocuments(docs);
    }
    await this.store.save(FAISS_DIRECTORY);
  }

  async similaritySearch(query, k = 3) {
    if (!this.store) return [];
    return await this.store.similaritySearchWithScore(query, k);
  }

  get documents() {
    return this.store ? this.store.docstore._docs : {};
  }
}

export const vectorStore = new FAISSVectorStore();

export function hasDocuments() {
  return fs.existsSync(FAISS_DIRECTORY) && vectorStore.store !== null;
}

export function clearDocuments() {
  if (fs.existsSync(FAISS_DIRECTORY)) {
    fs.rmSync(FAISS_DIRECTORY, { recursive: true });
  }
  vectorStore.store = null;
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
