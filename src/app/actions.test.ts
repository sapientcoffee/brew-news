import { decodeHtmlEntities, fetchRssFeed } from './actions';
import * as logActions from './logActions';
import * as summarizeFlow from '@/ai/flows/summarize-release-notes-flow';

jest.mock('./logActions');
jest.mock('@/ai/flows/summarize-release-notes-flow');

describe('actions', () => {
  beforeEach(() => {
    fetch.resetMocks();
    jest.clearAllMocks();
  });

  describe('decodeHtmlEntities', () => {
    it('should decode HTML entities', () => {
      const encoded = '&lt;div&gt;hello &amp; world &quot;foo&quot; &#039;bar&#039;&lt;/div&gt;';
      const decoded = '<div>hello & world "foo" \'bar\'</div>';
      expect(decodeHtmlEntities(encoded)).toEqual(decoded);
    });
  });

  describe('fetchRssFeed', () => {
    it('should fetch and parse a valid RSS feed', async () => {
      const mockRss = `
        <rss version="2.0">
          <channel>
            <title>Test RSS Feed</title>
            <item>
              <title>Test Item 1</title>
              <link>http://example.com/1</link>
              <pubDate>Tue, 08 Jul 2025 00:00:00 GMT</pubDate>
              <description>Description 1</description>
            </item>
          </channel>
        </rss>
      `;
      fetch.mockResponseOnce(mockRss);
      (summarizeFlow.summarizeReleaseNote as jest.Mock).mockResolvedValue({
        summary: ['Summary 1'],
        product: 'Test Product',
        subcomponent: 'Test Subcomponent',
        title: 'Test Item 1',
        pubDate: 'Tue, 08 Jul 2025 00:00:00 GMT',
      });

      const result = await fetchRssFeed('http://example.com/rss');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Test Item 1');
      expect(result.data[0].summary).toEqual(['Summary 1']);
      expect(logActions.addLog).toHaveBeenCalled();
    });

    it('should return an error for an invalid feed', async () => {
      const mockInvalidRss = 'not a valid rss feed';
      fetch.mockResponseOnce(mockInvalidRss);

      const result = await fetchRssFeed('http://example.com/invalid-rss');

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
      expect(logActions.addLog).toHaveBeenCalled();
    });
  });
});