import Captain from '@/components/Captain/Captain';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

describe('Captain', () => {
  it('uses the captain pose image when a pose is given', () => {
    render(<Captain pose='hero' alt='Hero captain' />);
    const img = screen.getByAltText('Hero captain') as HTMLImageElement;
    expect(img.src).toContain('/mascot/captain-hero.png');
  });

  it('uses a diverse pilot image when diverse is set', () => {
    render(<Captain diverse alt='A pilot' />);
    const img = screen.getByAltText('A pilot') as HTMLImageElement;
    expect(img.src).toContain('/mascot/pilots/pilot-');
  });

  it('falls back to a diverse pilot when no pose is given', () => {
    render(<Captain alt='Default' />);
    const img = screen.getByAltText('Default') as HTMLImageElement;
    expect(img.src).toContain('/mascot/pilots/pilot-');
  });
});
