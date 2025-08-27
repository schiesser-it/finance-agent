# /// script
# requires-python = ">=3.13"
# dependencies = [
#    "pandas",
#    "seaborn",
#    "yfinance",
#    "matplotlib",
#    "scipy",
#    "plotly",
#    "streamlit",
#    "watchdog",
#    "feedparser",
# ]
# ///

import streamlit as st
import pandas as pd
import numpy as np
import yfinance as yf
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import feedparser
from textblob import TextBlob
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# Configure page
st.set_page_config(
    page_title="Financial Analysis Dashboard",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for professional styling
st.markdown("""
<style>
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        border-left: 4px solid #1f77b4;
    }
    .positive-trend {
        color: #28a745;
    }
    .negative-trend {
        color: #dc3545;
    }
    .chart-container {
        height: 400px;
        margin-bottom: 2rem;
    }
    .main-header {
        text-align: center;
        padding: 2rem 0;
        background: linear-gradient(90deg, #1f77b4, #ff7f0e);
        color: white;
        margin: -1rem -1rem 2rem -1rem;
        border-radius: 0 0 1rem 1rem;
    }
</style>
""", unsafe_allow_html=True)

# Header
st.markdown("""
<div class="main-header">
    <h1>📈 Financial Analysis Dashboard</h1>
    <p>Professional Financial Analysis with Real-time News Sentiment</p>
</div>
""", unsafe_allow_html=True)

# Sidebar configuration
st.sidebar.header("Dashboard Configuration")
tickers = st.sidebar.text_input("Stock Tickers (comma-separated)", "AAPL,MSFT,GOOGL,TSLA").split(",")
tickers = [ticker.strip().upper() for ticker in tickers if ticker.strip()]
period = st.sidebar.selectbox("Time Period", ["1mo", "3mo", "6mo", "1y", "2y"], index=2)

# Fetch financial news function
@st.cache_data(ttl=300)  # Cache for 5 minutes
def fetch_financial_news(max_articles=20):
    """Fetch latest financial news from RSS feeds"""
    RSS_FEEDS = {
        "Seeking Alpha": "https://seekingalpha.com/feed.xml",
        "MarketWatch": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
        "Yahoo Finance": "https://finance.yahoo.com/rss/"
    }
    
    all_articles = []
    for source_name, feed_url in RSS_FEEDS.items():
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:max_articles//len(RSS_FEEDS)]:
                article = {
                    'source': source_name,
                    'title': entry.get('title', 'No title'),
                    'link': entry.get('link', ''),
                    'published': entry.get('published', ''),
                    'summary': entry.get('summary', 'No summary available')[:200] + "..."
                }
                all_articles.append(article)
        except Exception as e:
            st.sidebar.error(f"Error fetching from {source_name}: {str(e)}")
    
    return pd.DataFrame(all_articles)

# Sentiment analysis function
def analyze_sentiment(text):
    """Analyze sentiment of text using TextBlob"""
    blob = TextBlob(text)
    sentiment_score = blob.sentiment.polarity
    
    if sentiment_score > 0.1:
        return "Positive", sentiment_score, "🟢"
    elif sentiment_score < -0.1:
        return "Negative", sentiment_score, "🔴"
    else:
        return "Neutral", sentiment_score, "🟡"

# Fetch stock data function
@st.cache_data(ttl=300)
def fetch_stock_data(tickers, period):
    """Fetch stock data for given tickers"""
    data = {}
    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period=period, auto_adjust=True)
            info = stock.info
            data[ticker] = {
                'history': hist,
                'info': info,
                'current_price': hist['Close'].iloc[-1] if not hist.empty else 0,
                'prev_price': hist['Close'].iloc[-2] if len(hist) > 1 else 0
            }
        except Exception as e:
            st.error(f"Error fetching data for {ticker}: {str(e)}")
    return data

# Fetch data
with st.spinner("Loading financial data and news..."):
    stock_data = fetch_stock_data(tickers, period)
    news_df = fetch_financial_news()

# KPI Row
st.subheader("📊 Key Performance Indicators")
kpi_cols = st.columns(len(tickers))

for i, ticker in enumerate(tickers):
    with kpi_cols[i]:
        if ticker in stock_data and not stock_data[ticker]['history'].empty:
            current = stock_data[ticker]['current_price']
            previous = stock_data[ticker]['prev_price']
            change = current - previous
            change_pct = (change / previous * 100) if previous != 0 else 0
            
            trend_color = "positive-trend" if change >= 0 else "negative-trend"
            trend_arrow = "↗️" if change >= 0 else "↘️"
            
            st.markdown(f"""
            <div class="metric-card">
                <h3>{ticker}</h3>
                <h2>${current:.2f}</h2>
                <p class="{trend_color}">
                    {trend_arrow} {change:+.2f} ({change_pct:+.2f}%)
                </p>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.error(f"No data for {ticker}")

st.markdown("---")

# Charts Grid
st.subheader("📈 Financial Analysis Charts")
chart_cols = st.columns(2)

# Chart 1: Stock Price Performance
with chart_cols[0]:
    st.markdown("**Stock Price Performance**")
    fig1 = go.Figure()
    
    for ticker in tickers:
        if ticker in stock_data and not stock_data[ticker]['history'].empty:
            hist = stock_data[ticker]['history']
            fig1.add_trace(go.Scatter(
                x=hist.index,
                y=hist['Close'],
                mode='lines',
                name=ticker,
                line=dict(width=2)
            ))
    
    fig1.update_layout(
        height=400,
        xaxis_title="Date",
        yaxis_title="Price ($)",
        hovermode='x unified',
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
    )
    st.plotly_chart(fig1, use_container_width=True)

# Chart 2: Volume Analysis
with chart_cols[1]:
    st.markdown("**Trading Volume Analysis**")
    fig2 = make_subplots(specs=[[{"secondary_y": True}]])
    
    for ticker in tickers:
        if ticker in stock_data and not stock_data[ticker]['history'].empty:
            hist = stock_data[ticker]['history']
            fig2.add_trace(
                go.Bar(x=hist.index, y=hist['Volume'], name=f"{ticker} Volume", opacity=0.7),
                secondary_y=False,
            )
    
    fig2.update_layout(
        height=400,
        xaxis_title="Date",
        hovermode='x unified'
    )
    fig2.update_yaxes(title_text="Volume", secondary_y=False)
    st.plotly_chart(fig2, use_container_width=True)

# Chart 3: Returns Correlation Heatmap
chart_cols2 = st.columns(2)
with chart_cols2[0]:
    st.markdown("**Returns Correlation Matrix**")
    returns_data = {}
    for ticker in tickers:
        if ticker in stock_data and not stock_data[ticker]['history'].empty:
            hist = stock_data[ticker]['history']
            returns_data[ticker] = hist['Close'].pct_change().dropna()
    
    if returns_data:
        returns_df = pd.DataFrame(returns_data)
        corr_matrix = returns_df.corr()
        
        fig3 = px.imshow(
            corr_matrix,
            text_auto='.2f',
            aspect="auto",
            color_continuous_scale='RdBu_r',
            title="Stock Returns Correlation"
        )
        fig3.update_layout(height=400)
        st.plotly_chart(fig3, use_container_width=True)

# Chart 4: Volatility Analysis
with chart_cols2[1]:
    st.markdown("**30-Day Rolling Volatility**")
    fig4 = go.Figure()
    
    for ticker in tickers:
        if ticker in stock_data and not stock_data[ticker]['history'].empty:
            hist = stock_data[ticker]['history']
            returns = hist['Close'].pct_change()
            volatility = returns.rolling(window=30).std() * np.sqrt(252)  # Annualized
            
            fig4.add_trace(go.Scatter(
                x=volatility.index,
                y=volatility,
                mode='lines',
                name=f"{ticker} Volatility",
                line=dict(width=2)
            ))
    
    fig4.update_layout(
        height=400,
        xaxis_title="Date",
        yaxis_title="Annualized Volatility",
        hovermode='x unified'
    )
    st.plotly_chart(fig4, use_container_width=True)

st.markdown("---")

# News Sentiment Analysis Section
st.subheader("📰 Financial News Sentiment Analysis")

if not news_df.empty:
    # Analyze sentiment for each article
    sentiments = []
    for _, article in news_df.iterrows():
        text = f"{article['title']} {article['summary']}"
        sentiment, score, emoji = analyze_sentiment(text)
        sentiments.append({
            'sentiment': sentiment,
            'score': score,
            'emoji': emoji,
            'title': article['title'],
            'source': article['source'],
            'link': article['link']
        })
    
    sentiment_df = pd.DataFrame(sentiments)
    
    # Sentiment summary
    col1, col2, col3 = st.columns(3)
    
    positive_count = len(sentiment_df[sentiment_df['sentiment'] == 'Positive'])
    negative_count = len(sentiment_df[sentiment_df['sentiment'] == 'Negative'])
    neutral_count = len(sentiment_df[sentiment_df['sentiment'] == 'Neutral'])
    
    with col1:
        st.metric("🟢 Positive News", positive_count, delta=None)
    with col2:
        st.metric("🔴 Negative News", negative_count, delta=None)
    with col3:
        st.metric("🟡 Neutral News", neutral_count, delta=None)
    
    # Sentiment distribution chart
    sentiment_counts = sentiment_df['sentiment'].value_counts()
    fig_sentiment = px.pie(
        values=sentiment_counts.values,
        names=sentiment_counts.index,
        title="News Sentiment Distribution",
        color_discrete_map={
            'Positive': '#28a745',
            'Negative': '#dc3545',
            'Neutral': '#ffc107'
        }
    )
    st.plotly_chart(fig_sentiment, use_container_width=True)
    
    # Recent news with sentiment
    st.subheader("Recent Financial News")
    for _, row in sentiment_df.head(10).iterrows():
        with st.expander(f"{row['emoji']} {row['title']} - {row['source']}"):
            st.write(f"**Sentiment:** {row['sentiment']} (Score: {row['score']:.2f})")
            st.write(f"**Source:** {row['source']}")
            st.write(f"**Link:** {row['link']}")

else:
    st.warning("Unable to fetch financial news at this time.")

# Summary Section
st.markdown("---")
st.subheader("📋 Analysis Summary")

summary_col1, summary_col2 = st.columns(2)

with summary_col1:
    st.markdown("**Market Performance Summary:**")
    if stock_data:
        best_performer = None
        worst_performer = None
        best_change = float('-inf')
        worst_change = float('inf')
        
        for ticker in tickers:
            if ticker in stock_data and not stock_data[ticker]['history'].empty:
                current = stock_data[ticker]['current_price']
                previous = stock_data[ticker]['prev_price']
                if previous != 0:
                    change_pct = (current - previous) / previous * 100
                    if change_pct > best_change:
                        best_change = change_pct
                        best_performer = ticker
                    if change_pct < worst_change:
                        worst_change = change_pct
                        worst_performer = ticker
        
        if best_performer:
            st.success(f"🏆 Best Performer: {best_performer} (+{best_change:.2f}%)")
        if worst_performer:
            st.error(f"📉 Worst Performer: {worst_performer} ({worst_change:.2f}%)")

with summary_col2:
    st.markdown("**News Sentiment Summary:**")
    if not news_df.empty and 'sentiment' in sentiment_df.columns:
        avg_sentiment = sentiment_df['score'].mean()
        sentiment_trend = "Positive" if avg_sentiment > 0.05 else "Negative" if avg_sentiment < -0.05 else "Neutral"
        
        if sentiment_trend == "Positive":
            st.success(f"📈 Overall Market Sentiment: {sentiment_trend} ({avg_sentiment:.2f})")
        elif sentiment_trend == "Negative":
            st.error(f"📉 Overall Market Sentiment: {sentiment_trend} ({avg_sentiment:.2f})")
        else:
            st.info(f"📊 Overall Market Sentiment: {sentiment_trend} ({avg_sentiment:.2f})")

# Footer
st.markdown("---")
st.markdown("""
<div style="text-align: center; color: #666; padding: 2rem 0;">
    <p>Financial Analysis Dashboard | Data provided by Yahoo Finance and Financial News Sources</p>
    <p>Last updated: {}</p>
</div>
""".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S")), unsafe_allow_html=True)

# Hacky stuff required to be added to make it work without `streamlit run`:
if __name__ == "__main__":
    from streamlit.runtime.scriptrunner import get_script_run_ctx
    if get_script_run_ctx() is None:
        from streamlit.web.cli import main
        import sys
        sys.argv = ['streamlit', 'run', __file__]
        main()