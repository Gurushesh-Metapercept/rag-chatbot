import { indexTheDocument, hasDocuments } from "./prepare.js";

// Supported file formats:
// const filePath = "./README.md";           // Markdown
// const filePath = "./metapercept-doc.pdf"; // PDF
const filePath = "./metapercept-doc.docx"; // Word
// const filePath = "./data.csv";           // CSV/Excel data
// const filePath = "./notes.txt";          // Text files

if (!hasDocuments()) {
  console.log(`Indexing document: ${filePath}...`);
  try {
    await indexTheDocument(filePath);
    console.log("Document indexed successfully");
  } catch (error) {
    console.error("Error indexing document:", error.message);
  }
} else {
  console.log("Vector store already has documents");
}
