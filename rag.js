import { indexTheDocument, hasDocuments, clearDocuments } from "./prepare.js";

// Supported file formats:

// const filePath = "./samples/metapercept-doc.docx"; // Word
// const filePath = "./samples/metapercept-doc.md;   // Markdown
const filePath = "./samples/metapercept-merged-doc.pdf"; // PDF
// const filePath = "./samples/data.csv";            // CSV/Excel data
// const filePath = "./samples/notes.txt";           // Text files

if (hasDocuments()) {
  console.log("Clearing existing documents...");
  clearDocuments();
}

console.log(`Indexing document: ${filePath}...`);
try {
  await indexTheDocument(filePath);
  console.log("Document indexed successfully");
} catch (error) {
  console.error("Error indexing document:", error.message);
}
