import mammoth from 'mammoth';
import pdf from 'pdf-parse';

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return extractPdfText(buffer);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractDocxText(buffer);
    case 'text/html':
      return extractHtmlText(buffer);
    case 'text/plain':
    case 'text/markdown':
    case 'text/x-markdown':
      return buffer.toString('utf-8');
    default:
      throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractHtmlText(buffer: Buffer): string {
  return buffer
    .toString('utf-8')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
