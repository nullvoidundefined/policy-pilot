import CitationPanel from '@/components/CitationPanel/CitationPanel';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const citation = {
  id: 'c1',
  document_id: 'd1',
  chunk_index: 2,
  content: 'the cited text',
  filename: 'policy.pdf',
};

describe('CitationPanel', () => {
  it('renders nothing when there is no citation', () => {
    const { container } = render(
      <CitationPanel citation={null} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the filename, 1-based section, and content', () => {
    render(<CitationPanel citation={citation} onClose={vi.fn()} />);
    expect(screen.getByText('policy.pdf')).toBeInTheDocument();
    expect(screen.getByText('Section 3')).toBeInTheDocument();
    expect(screen.getByText('the cited text')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(<CitationPanel citation={citation} onClose={onClose} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Close citation panel' }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});
