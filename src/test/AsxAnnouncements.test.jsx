import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AsxAnnouncements } from '../components/AsxAnnouncements';

// Mock api builder — returns a function that resolves to an object mimicking
// a `fetch` Response. Lets each test stub its own response shape.
function mockApi(response) {
  return vi.fn(() =>
    Promise.resolve({
      ok: response !== null && response !== undefined,
      json: () => Promise.resolve(response ?? {}),
    }),
  );
}

const baseBusiness = { business_name: 'Coles', location: 'Sydney', category: 'Supermarket' };

describe('AsxAnnouncements', () => {
  it('renders nothing while the request is in flight', () => {
    const api = vi.fn(() => new Promise(() => {})); // never resolves
    const { container } = render(<AsxAnnouncements api={api} business={baseBusiness} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when business_name is missing', () => {
    const api = mockApi({ ticker: 'COL', total: 1 });
    const { container } = render(<AsxAnnouncements api={api} business={{}} />);
    expect(container).toBeEmptyDOMElement();
    expect(api).not.toHaveBeenCalled();
  });

  it('renders nothing when the company is not ASX-listed (ticker null)', async () => {
    const api = mockApi({ ticker: null, total: 0, announcements: [] });
    const { container } = render(<AsxAnnouncements api={api} business={baseBusiness} />);
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when total is 0', async () => {
    const api = mockApi({ ticker: 'COL', total: 0, announcements: [] });
    const { container } = render(<AsxAnnouncements api={api} business={baseBusiness} />);
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the header with ticker and counts when ASX-listed', async () => {
    const api = mockApi({
      ticker: 'COL',
      total: 5,
      market_sensitive_count: 2,
      announcements: [
        {
          title: 'Federal Court Decision',
          date: '2026-05-14',
          released_at: '2026-05-14T01:09:38.000Z',
          market_sensitive: true,
          size: '145KB',
          url: 'https://www.asx.com.au/markets/company/COL',
          pages: null,
        },
        {
          title: 'Quarterly Update',
          date: '2026-04-30',
          released_at: '2026-04-30T01:00:00.000Z',
          market_sensitive: false,
          size: '88KB',
          url: 'https://www.asx.com.au/markets/company/COL',
          pages: 12,
        },
      ],
    });
    render(<AsxAnnouncements api={api} business={baseBusiness} />);
    await screen.findByText('ASX Announcements');
    expect(screen.getByText('COL')).toBeInTheDocument();
    expect(screen.getByText(/5 announcements/)).toBeInTheDocument();
    expect(screen.getByText(/2 market-sensitive/)).toBeInTheDocument();
  });

  it('shows announcement titles + market-sensitive badge when expanded by default', async () => {
    const api = mockApi({
      ticker: 'COL',
      total: 1,
      market_sensitive_count: 1,
      announcements: [{
        title: 'Federal Court Decision',
        date: '2026-05-14',
        market_sensitive: true,
        size: '145KB',
        url: 'https://www.asx.com.au/markets/company/COL',
        pages: 3,
      }],
    });
    render(<AsxAnnouncements api={api} business={baseBusiness} />);
    await screen.findByText('Federal Court Decision');
    expect(screen.getByText('Market sensitive')).toBeInTheDocument();
    expect(screen.getByText('2026-05-14')).toBeInTheDocument();
    expect(screen.getByText(/145KB/)).toBeInTheDocument();
    expect(screen.getByText(/3 pages/)).toBeInTheDocument();
  });

  it('hides announcement rows when defaultExpanded={false} and reveals them on click', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      ticker: 'COL',
      total: 1,
      market_sensitive_count: 0,
      announcements: [{
        title: 'Quarterly Update',
        date: '2026-04-30',
        market_sensitive: false,
        size: '88KB',
        url: 'https://example.com',
        pages: 1,
      }],
    });
    render(<AsxAnnouncements api={api} business={baseBusiness} defaultExpanded={false} />);
    await screen.findByText('ASX Announcements');
    expect(screen.queryByText('Quarterly Update')).not.toBeInTheDocument();
    await user.click(screen.getByText('ASX Announcements'));
    await screen.findByText('Quarterly Update');
  });

  it('renders nothing when fetch returns a non-ok response', async () => {
    const api = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));
    const { container } = render(<AsxAnnouncements api={api} business={baseBusiness} />);
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when fetch rejects', async () => {
    const api = vi.fn(() => Promise.reject(new Error('network down')));
    const { container } = render(<AsxAnnouncements api={api} business={baseBusiness} />);
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('sends business_name / location / category as query params', async () => {
    const api = mockApi({ ticker: null, total: 0 });
    render(<AsxAnnouncements api={api} business={baseBusiness} />);
    await waitFor(() => expect(api).toHaveBeenCalled());
    const url = api.mock.calls[0][0];
    expect(url).toContain('/asx/announcements?');
    expect(url).toContain('business_name=Coles');
    expect(url).toContain('location=Sydney');
    expect(url).toContain('category=Supermarket');
  });

  it('handles announcements with a singular "page" label', async () => {
    const api = mockApi({
      ticker: 'BHP',
      total: 1,
      market_sensitive_count: 0,
      announcements: [{
        title: 'Notice',
        date: '2026-01-01',
        market_sensitive: false,
        size: '50KB',
        url: 'https://example.com',
        pages: 1,
      }],
    });
    render(<AsxAnnouncements api={api} business={{ business_name: 'BHP' }} />);
    await screen.findByText('Notice');
    expect(screen.getByText(/1 page/)).toBeInTheDocument();
  });
});
