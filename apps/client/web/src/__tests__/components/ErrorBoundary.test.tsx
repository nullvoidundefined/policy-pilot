import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>safe</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe')).toBeInTheDocument();
  });

  it('renders the default fallback after a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("We've hit some turbulence")).toBeInTheDocument();
  });

  it('renders a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<p>custom</p>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('custom')).toBeInTheDocument();
  });
});
