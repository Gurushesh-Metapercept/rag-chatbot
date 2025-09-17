# FAISS Integration Setup

## Installation

Run the following command to install FAISS:

```bash
npm install faiss-node
```

## Changes Made

1. **Replaced SimpleVectorStore with FAISSVectorStore** in `prepare.js`
2. **Added FAISS dependency** to `package.json`
3. **New storage files**:
   - `faiss_index.bin` - FAISS binary index file
   - `documents_metadata.json` - Document metadata storage

## Benefits of FAISS

- **Faster similarity search** - Optimized C++ implementation
- **Memory efficient** - Better handling of large document collections
- **Scalable** - Supports millions of vectors
- **Industry standard** - Used by Facebook, Google, and other tech companies

## Usage

The API remains the same:
- `node rag.js` - Index documents
- `node server.js` - Start web server
- All existing functionality preserved

## File Structure

```
Gen_AI/
├── faiss_index.bin          # FAISS binary index (new)
├── documents_metadata.json  # Document metadata (replaces documents.json)
├── prepare.js              # Updated with FAISS integration
└── ...
```