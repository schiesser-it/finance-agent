import { ToolConfig } from "./types";

export const newsReaderTools: Record<string, ToolConfig> = {
  news_reader: {
    schema: {
      title: "News Reader",
      description: `Returns code snippet for retrieving financial news from RSS feeds. Use this code snippet in the notebook to fetch the latest financial news. Only use this tool if the user asks for the latest financial news.
The code will fetch news from major financial sources including Seeking Alpha, Financial Times, and MarketWatch.`,
      inputSchema: {},
    },
    handler: async () => {
      const codeSnippet = `import feedparser  # RSS feed parsing library
import requests
from datetime import datetime
import pandas as pd

# RSS feed URLs for financial news
RSS_FEEDS = {
    "Seeking Alpha": "https://seekingalpha.com/feed.xml",
    "Financial Times": "https://www.ft.com/rss/home", 
    "MarketWatch": "https://feeds.content.dowjones.io/public/rss/mw_topstories"
}

def fetch_news(max_articles_per_source=10):
    """Fetch latest financial news from RSS feeds"""
    all_articles = []
    
    for source_name, feed_url in RSS_FEEDS.items():
        try:
            print(f"Fetching news from {source_name}...")
            
            # Parse the RSS feed using feedparser
            feed = feedparser.parse(feed_url)
            
            # Extract articles
            for entry in feed.entries[:max_articles_per_source]:
                article = {
                    'source': source_name,
                    'title': entry.get('title', 'No title'),
                    'link': entry.get('link', ''),
                    'published': entry.get('published', ''),
                    'summary': entry.get('summary', 'No summary available')
                }
                all_articles.append(article)
                
        except Exception as e:
            print(f"Error fetching from {source_name}: {str(e)}")
    
    # Convert to DataFrame for easier analysis
    df = pd.DataFrame(all_articles)
    
    print(f"\\nFetched {len(df)} articles from {len(RSS_FEEDS)} sources")
    return df

# Fetch the latest news
news_df = fetch_news(max_articles_per_source=10)

# Display the latest headlines
print("\\n=== LATEST FINANCIAL NEWS ===\\n")
for idx, row in news_df.head(20).iterrows():  # iterrows() method for DataFrame iteration
    print(f"📰 {row['source']}: {row['title']}")
    print(f"🔗 {row['link']}")
    print(f"📅 {row['published']}")
    print(f"📝 {row['summary'][:150]}...")
    print("-" * 80)

# Show news by source
print("\\n=== NEWS BY SOURCE ===\\n")
for source in news_df['source'].unique():
    source_news = news_df[news_df['source'] == source]
    print(f"{source}: {len(source_news)} articles")
`;

      return {
        content: [
          {
            type: "text",
            text: codeSnippet,
          },
        ],
      };
    },
  },
};
