import LandingPage from '@/app/page';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/Captain/Captain', () => ({
  default: ({ alt }: { alt?: string }) => (
    <img alt={alt ?? 'Captain'} src='/captain-stub.png' />
  ),
}));

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    width,
    height,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
  }) => <img src={src} alt={alt} width={width} height={height} />,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('LandingPage', () => {
  it('renders the hero heading', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /ask your company handbook/i,
      }),
    ).toBeInTheDocument();
  });

  it('renders the primary Try the Demo CTA link', () => {
    render(<LandingPage />);

    const demoLinks = screen.getAllByRole('link', { name: /try the demo/i });
    expect(demoLinks.length).toBeGreaterThan(0);
    expect(demoLinks[0]).toHaveAttribute('href', '/demo');
  });

  it('renders the Get Started CTA link', () => {
    render(<LandingPage />);

    const getStartedLinks = screen.getAllByRole('link', {
      name: /get started/i,
    });
    expect(getStartedLinks.length).toBeGreaterThan(0);
    expect(getStartedLinks[0]).toHaveAttribute('href', '/register');
  });

  it('mounts the Captain mascot stub for the hero section', () => {
    render(<LandingPage />);

    // The Captain component is stubbed to an img; match on the partial
    // alt string that is stable regardless of punctuation.
    expect(
      screen.getByAltText(/captain policypilot.*co-pilot for company policy/i),
    ).toBeInTheDocument();
  });

  it('renders the features section heading', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: /all systems go/i }),
    ).toBeInTheDocument();
  });

  it('renders the demo section with company handbooks', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('heading', { level: 3, name: /gitlab/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /valve/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /basecamp/i }),
    ).toBeInTheDocument();
  });

  it('renders the footer CTA section heading', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: /ready for takeoff/i }),
    ).toBeInTheDocument();
  });
});
