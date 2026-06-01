# DocQA — Summary

## What Is It?

DocQA is a document question-and-answer application powered by Retrieval-Augmented Generation (RAG). Upload your PDFs, text files, or Markdown documents and ask natural language questions — the AI searches through your documents and provides grounded answers with clickable source citations.

## What It Does

1. **Document Upload** — Drag-and-drop or click to upload PDF, TXT, or Markdown files (up to 10 MB each).
2. **Background Processing** — A worker pipeline automatically extracts text, chunks it into ~500-token passages, generates vector embeddings, and stores everything in a vector database.
3. **Status Tracking** — Watch your documents move through `uploaded → chunking → embedding → ready` in real time.
4. **Question Answering** — Ask a question in plain English. The system finds the most relevant chunks via vector similarity search, assembles them into a prompt, and streams back an AI-generated answer.
5. **Source Citations** — Every answer includes numbered citation markers (e.g. [1], [2]) that you can click to expand and read the exact source passage.

## User Flows

### Uploading a Document

1. Navigate to the **Documents** page.
2. Drop a file onto the upload zone or click to browse.
3. The file uploads to cloud storage and a processing job is enqueued.
4. The document card appears immediately with a "processing" badge.
5. Once processing completes, the badge switches to "ready" and shows the chunk count.

### Asking a Question

1. Navigate to the **Ask a Question** (Chat) page.
2. Type your question and press Send.
3. The AI streams its response token-by-token.
4. Citation badges appear inline — click one to expand the source chunk.
5. Conversation context is preserved across follow-up questions.

### Deleting a Document

1. On the Documents page, click **Delete** next to the document you want to remove.
2. The document, its chunks, and its embeddings are removed.

## Key Behaviors to Know

- Only documents in the **ready** state are searchable. Documents still processing or in a failed state are excluded from Q&A.
- Answers are scoped to **your documents only** — each user's document library is isolated.
- The AI will indicate when it cannot find relevant information in your documents rather than guessing.
- Large documents are split into overlapping chunks to ensure passages at chunk boundaries are not lost.
