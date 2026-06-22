import { extractText } from 'app/services/extractText.js';
import { describe, expect, it } from 'vitest';

const PLAIN_MIME = 'text/plain';
const MARKDOWN_MIME = 'text/markdown';
const HTML_MIME = 'text/html';
const UNSUPPORTED_MIME = 'image/png';

describe('extractText', () => {
  it('returns UTF-8 text unchanged for plain text', async () => {
    const result = await extractText(Buffer.from('hello policy'), PLAIN_MIME);
    expect(result).toBe('hello policy');
  });

  it('returns UTF-8 text unchanged for markdown', async () => {
    const result = await extractText(
      Buffer.from('# Heading\nbody'),
      MARKDOWN_MIME,
    );
    expect(result).toBe('# Heading\nbody');
  });

  it('strips tags, scripts, and styles from HTML', async () => {
    const html =
      '<style>.x{color:red}</style><p>Remote work <b>policy</b></p><script>alert(1)</script>';
    const result = await extractText(Buffer.from(html), HTML_MIME);
    expect(result).toBe('Remote work policy');
  });

  it('throws on an unsupported MIME type', async () => {
    await expect(
      extractText(Buffer.from('x'), UNSUPPORTED_MIME),
    ).rejects.toThrow(/Unsupported mime type/);
  });
});
