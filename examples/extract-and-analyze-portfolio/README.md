# Extract and Analyze Portfolio

## Prompt

First make sure, you're in dashboard mode:

```
/mode dashboard
```

This is the prompt used for generating the example:

```
Extract portfolio from the open positions of statement @data/account_statement.pdf and visualize it.
```

Then use this follow-up prompt:

```
Extract the current market outlook from the news and suggest two options how to lower the risk of the portfolio.
```

## Running the Dashboard

To run the dashboard, you can use the following command:

```bash
uvx --with-requirements requirements.txt streamlit run dashboard.py
```
