# RAG System Documentation

## Overview

The Retrieval-Augmented Generation (RAG) system in Mustashar provides semantic search capabilities over Arabic legal documents. The system is designed to enhance legal question answering by retrieving relevant context from Sudanese law documents before generating responses.

## Architecture

The RAG system consists of four main components:

1. **Document Processing** (`chunker.ts`) - Loads and chunks legal documents
2. **Embeddings** (`embeddings.ts`) - Converts text to vector representations
3. **Vector Database** (`vdb.ts`) - Creates and manages the HNSWLib vector store
4. **Retriever** (`retriver.ts`) - Provides semantic search functionality

## Components

### 1. Document Processing (`src/rag/chunker.ts`)

**Purpose**: Loads legal documents from the `./docs/` directory and splits them into manageable chunks for vectorization.

**Features**:
- Supports PDF and text files (.txt, .md)
- Recursive directory traversal
- Configurable chunk size (800 characters) with no overlap
- Metadata preservation (source file, page numbers for PDFs)

**Usage**:
```typescript
import { loadDocsFromFolder } from './chunker'

const documents = await loadDocsFromFolder('./docs')
```

**Document Types Supported**:
- **PDFs**: Using LangChain's PDFLoader
- **Text files**: Plain text and Markdown files

### 2. Embeddings (`src/rag/embeddings.ts`)

**Purpose**: Converts text chunks into vector embeddings for semantic search.

**Configuration**:
- **Model**: `Omartificial-Intelligence-Space/GATE-AraBert-v1` (Arabic-optimized BERT model)
- **Provider**: HuggingFace Inference API
- **API Key**: Uses `HF_API_KEY` or `HUGGINGFACEHUB_API_KEY` environment variable

**Usage**:
```typescript
import { embeddings } from './embeddings'

// Embed a single text
const vector = await embeddings.embedQuery("النص العربي هنا")

// Embed multiple texts
const vectors = await embeddings.embedDocuments(["نص 1", "نص 2"])
```

### 3. Vector Database Creation (`src/rag/vdb.ts`)

**Purpose**: Builds the HNSWLib vector database from processed documents.

**Process**:
1. Initializes empty HNSWLib vector store
2. Loads documents using the chunker
3. Adds documents to vector store
4. Saves the index to `./vdb/` directory

**Usage**:
```bash
bun run src/rag/vdb.ts
```

**Output Files**:
- `vdb/hnswlib.index` - The HNSWLib index
- `vdb/docstore.json` - Document store metadata
- `vdb/args.json` - Index configuration

### 4. Retriever (`src/rag/retriver.ts`)

**Purpose**: Provides semantic search functionality over the vector database.

**Features**:
- Loads pre-built HNSWLib index
- Creates a retriever with default similarity search
- Returns relevant document chunks for queries

**Usage**:
```typescript
import { retriver } from './retriver'

// Search for relevant documents
const results = await retriver.invoke("ما هي أحكام الطلاق في القانون السوداني؟")
```

## Setup and Configuration

### Prerequisites

- HuggingFace API key for embeddings
- Legal documents in `./docs/` directory
- Node.js with native module support (for HNSWLib)

### Environment Variables

```env
HF_API_KEY=your_huggingface_api_key_here
```

### Building the Vector Database

1. **Place documents** in the `./docs/` directory
2. **Run the database builder**:
   ```bash
   bun run src/rag/vdb.ts
   ```
3. **Verify the index** is created in `./vdb/`

### Testing the Retriever

```bash
bun run src/rag/retriver.ts
```

This will perform a test search and display retrieved documents.

## Integration Status

**Current Status**: The RAG components are fully implemented and functional, but not yet integrated into the main bot service.

**Future Integration**: To integrate RAG into the bot:

1. Import the retriever in `botService.ts`
2. Use retriever to get relevant context before LLM generation
3. Include retrieved documents in the prompt

**Example Integration**:
```typescript
// In botService.ts
import { retriver } from './rag/retriver'

// Before LLM call
const relevantDocs = await retriver.invoke(userText)
const context = relevantDocs.map(doc => doc.pageContent).join('\n')

// Include in LLM prompt
const finalAnswer = await assistanceLLM.invoke([
  new SystemMessage(`Context: ${context}`),
  new HumanMessage(`Summary: ${updatedSummary.content}. User: ${userText}`),
])
```

## Performance Considerations

- **Chunk Size**: 800 characters with no overlap for legal text coherence
- **Embedding Model**: Arabic-optimized model for better legal text understanding
- **Vector Store**: HNSWLib provides fast approximate nearest neighbor search
- **Memory Usage**: Index is loaded into memory for fast retrieval

## File Structure

```
src/rag/
├── chunker.ts      # Document loading and chunking
├── embeddings.ts   # Text embedding configuration
├── vdb.ts         # Vector database creation
└── retriver.ts    # Semantic search retriever

vdb/               # Vector database files
├── hnswlib.index
├── docstore.json
└── args.json

docs/              # Source legal documents
├── قانون_الاجراءات_المدنية_1983_معدلا_حتي_2019.txt
├── قانون_الاحوال_الشخصية_للمسلمين1991.txt
└── قانون المعاملات المدينة ١٩٨٤.txt
```

## Dependencies

- `@langchain/community` - HNSWLib vector store and HuggingFace embeddings
- `@langchain/textsplitters` - Document chunking
- `@langchain/core` - Document interfaces
- `hnswlib-node` - Native HNSWLib bindings

## Troubleshooting

### Common Issues

1. **Missing native bindings**: Run `npm rebuild hnswlib-node`
2. **Embedding API errors**: Check HuggingFace API key
3. **Empty search results**: Ensure vector database is built and documents exist
4. **Memory issues**: Reduce chunk size or use smaller embedding model

### Debug Commands

```bash
# Check if vector database exists
ls -la vdb/

# Test embeddings
bun -e "import { embeddings } from './src/rag/embeddings'; console.log(await embeddings.embedQuery('test'))"

# Test document loading
bun -e "import { loadDocsFromFolder } from './src/rag/chunker'; console.log((await loadDocsFromFolder()).length)"
```</content>
<parameter name="filePath">/home/omar/mustashar/RAG.md