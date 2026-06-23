import ChatAnswer from '@/components/ChatAnswer/ChatAnswer';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const CITATION = {
  id: 'chunk-1',
  document_id: 'doc-1',
  chunk_index: 2,
  content: 'Three weeks of paid vacation per year.',
  filename: 'handbook.pdf',
};

describe('ChatAnswer', () => {
  it('renders a markdown heading as a heading element, not literal hashes', () => {
    render(
      <ChatAnswer
        content="## Basecamp's Vacation Policy"
        onCitationClick={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /basecamp's vacation policy/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/##/)).toBeNull();
  });

  it('renders bold markdown as a <strong> element', () => {
    const { container } = render(
      <ChatAnswer
        content='**Standard vacation**: three weeks'
        onCitationClick={vi.fn()}
      />,
    );

    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong).toHaveTextContent('Standard vacation');
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it('renders a dash list as list items', () => {
    render(
      <ChatAnswer
        content={'- Standard vacation\n- Sick days'}
        onCitationClick={vi.fn()}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Standard vacation');
    expect(items[1]).toHaveTextContent('Sick days');
  });

  it('renders a [N] marker as a clickable citation badge and reports the citation on click', async () => {
    const onCitationClick = vi.fn();
    render(
      <ChatAnswer
        content='Three weeks of paid vacation [1] applies.'
        citations={[CITATION]}
        onCitationClick={onCitationClick}
      />,
    );

    const badge = screen.getByRole('button', { name: /view source 1/i });
    expect(badge).toHaveTextContent('1');

    await userEvent.click(badge);
    expect(onCitationClick).toHaveBeenCalledWith(CITATION);
  });

  it('renders markdown and citation badge together', () => {
    render(
      <ChatAnswer
        content='- **Standard vacation**: Three weeks [1]'
        citations={[CITATION]}
        onCitationClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('listitem')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /view source 1/i }),
    ).toBeInTheDocument();
  });

  it('leaves a [N] marker as plain text when no matching citation exists', () => {
    render(
      <ChatAnswer
        content='See policy [3] for details.'
        citations={[CITATION]}
        onCitationClick={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /view source 3/i })).toBeNull();
    expect(screen.getByText(/\[3\]/)).toBeInTheDocument();
  });
});
