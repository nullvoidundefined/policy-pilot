import pdf from "pdf-parse";

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case "application/pdf":
      return extractPdfText(buffer);
    case "text/plain":
    case "text/markdown":
    case "text/x-markdown":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}
