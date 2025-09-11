import { indexTheDocument, hasDocuments } from "./prepare.js";

const filePath = "./metapercept-doc.pdf";

if (!hasDocuments()) {
  console.log("Indexing document...");
  await indexTheDocument(filePath);
  console.log("Document indexed successfully");
} else {
  console.log("Vector store already has documents");
}
