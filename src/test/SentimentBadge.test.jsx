import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SentimentBadge } from '../components/SentimentBadge';

describe('SentimentBadge', () => {
  it('renders the score value', () => {
    render(<SentimentBadge score={72} />);
    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('applies green colour for positive scores (>= 57.5)', () => {
    const { container } = render(<SentimentBadge score={80} />);
    const badge = container.firstChild;
    expect(badge).toHaveStyle({ color: 'hsl(95,25%,32%)' });
  });

  it('applies yellow colour for neutral scores (42.5 – 57.4)', () => {
    const { container } = render(<SentimentBadge score={50} />);
    const badge = container.firstChild;
    expect(badge).toHaveStyle({ color: 'hsl(38,55%,32%)' });
  });

  it('applies red colour for negative scores (< 42.5)', () => {
    const { container } = render(<SentimentBadge score={30} />);
    const badge = container.firstChild;
    expect(badge).toHaveStyle({ color: 'hsl(10,50%,32%)' });
  });

  it('renders at boundary: exactly 57.5 is positive', () => {
    render(<SentimentBadge score={57.5} />);
    const { container } = render(<SentimentBadge score={57.5} />);
    expect(container.firstChild).toHaveStyle({ color: 'hsl(95,25%,32%)' });
  });

  it('renders at boundary: exactly 42.5 is neutral', () => {
    const { container } = render(<SentimentBadge score={42.5} />);
    expect(container.firstChild).toHaveStyle({ color: 'hsl(38,55%,32%)' });
  });
});
