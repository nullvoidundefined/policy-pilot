/** Decides whether the collection document list should keep polling: true while any document is still being processed (a non-terminal status), false once every document has reached a terminal status (ready, failed, or rejected). */

const PROCESSING_DOCUMENT_STATUSES = ['uploaded', 'chunking', 'embedding'];

export function shouldPollDocuments(documents: { status: string }[]): boolean {
  return documents.some((document) =>
    PROCESSING_DOCUMENT_STATUSES.includes(document.status),
  );
}
