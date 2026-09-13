# 📈 AI Stock Prediction & Market Analysis Web App

A modern, full-stack, serverless financial insights web application. Enter up to 3 US stock tickers, fetch real-time 3-day historical OHLC prices from Polygon.io, and stream dynamic, styled AI analysis in real-time powered by **Qwen 2.5-72B** on Hugging Face.

---

## 🌟 Highlights & Key Features

* **⚡ Real-Time LLM Token Streaming**: Real-time typewriter effect via `ReadableStream` & Hugging Face's serverless inference stream — no waiting 15 seconds for a complete response.
* **🎭 5 Distinct Persona Styles**:
  * **Funny & Witty** (`temp: 0.85`): Comedic, playful roasts and funny analogies.
  * **Serious Analyst** (`temp: 0.25`): Institutional Wall Street analyst tone with financial terminology.
  * **Beginner-Friendly** (`temp: 0.65`): Jargon-free ELI5 market mentor with plain English explanations.
  * **Concise Quick-Take** (`temp: 0.30`): Ultra-compact executive brief under 80 words.
  * **Dramatic Epic** (`temp: 0.90`): Blockbuster movie trailer narration depicting the Bulls vs. Bears clash.
* **⌨️ Flexible Smart Ticker Input**: Add tickers one by one or in bulk via comma-separated (`AAPL, MSFT, NVDA`) or space-separated (`AAPL MSFT TSLA`) inputs with auto-deduplication, interactive tag chips, and suggestions datalist.
* **📊 Zero-Dependency SVG Sparklines**: Dynamically calculated normalized trend line graphs with interactive point tooltips (closing price + date) without bulky third-party chart libraries.
* **⚡ Dual-Tier In-Memory Caching**:
  * **10-minute TTL** on raw Polygon stock OHLC data (prevents hitting API rate limits).
  * **30-minute TTL** on generated AI markdown reports.
* **🌓 Instant Dark / Light Mode**: System-aware theme toggle using dynamic CSS custom properties.
* **📄 Export Tooling**: One-click clipboard copy and custom print-to-PDF stylesheet optimization.
* **🚀 Vercel Serverless Ready**: Zero-config static edge CDN delivery combined with Serverless Node.js API functions.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Vanilla HTML5, CSS3 (Custom Variables, Flex/Grid), ES6 JavaScript Modules |
| **Backend** | Node.js, Express.js (v5) |
| **AI / LLM** | `@huggingface/inference` (`Qwen/Qwen2.5-72B-Instruct` via auto-routed GPU providers) |
| **Market Data** | Polygon.io Aggregates REST API (OHLC historical endpoints) |
| **Deployment** | Vercel Serverless Functions + Edge CDN |

---

## 🏗️ System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                 1. CLIENT INGESTION & UI STATE              │
│  Ticker Datalist ──► Vanilla ES6 / HTML5 ──► Client Guards  │
│  (Suggestion Chips)  (SPA State Controller)  (1-3 Tickers/Regex)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│           2. VERCEL SERVERLESS GATEWAY & MARKET DATA        │
│  POST /api/stock-data ──► In-Memory Cache ──► Polygon.io API│
│  (Vercel Node.js)         (10-Min TTL Map)    (OHLC 3-Day Range)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│           3. HUGGING FACE INFERENCE & STYLE ENGINE          │
│  POST /api/report ──► Dynamic Prompt Engine ──► Qwen 2.5-72B│
│  (Adaptive Temp)      (5 Persona Profiles)     (HF Token Stream)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│          4. CHUNKED STREAMING & SVG VISUALIZATION           │
│  ReadableStream Reader ──► Markdown Parser ──► SVG Sparklines│
│  (Real-Time Token Feed)    (DOM Typist)        (Min/Max Math)│
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Environment Variables Setup

The app requires two free API keys: one for stock market data and one for the AI language model.

### 1. How to get the required keys:

* **Polygon.io API Key** (Stock Data):
  1. Sign up for a free account at [polygon.io](https://polygon.io/).
  2. Navigate to your **Dashboard** > **API Keys**.
  3. Copy your free API key (provides 5 free requests/minute).

* **Hugging Face API Token** (AI Reports):
  1. Create a free account at [huggingface.co](https://huggingface.co/).
  2. Go to **Settings** > **Access Tokens** ([huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)).
  3. Click **Create new token**, select **Read** permissions, and copy the token (starts with `hf_...`).

---

### 2. Setting up `.env` locally:

In the root directory of the project, copy `.env.example` or create a `.env` file:

```bash
cp .env.example .env
```

Fill in your actual API keys:

```env
# Required API Keys
POLYGON_API_KEY=your_polygon_api_key_here
HUGGINGFACE_API_KEY=hf_your_huggingface_token_here

# Local Server Port (Optional, default is 3000)
PORT=3000

# Optional Overrides (Defaults to Qwen2.5-72B-Instruct with auto provider)
# HUGGINGFACE_MODEL=Qwen/Qwen2.5-72B-Instruct
# HUGGINGFACE_PROVIDER=auto
```

> ⚠️ **Security Notice**: Never commit your `.env` file to GitHub. It is already safely listed in `.gitignore`.

---

## 🚀 Running the Project Locally

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the application
Run the direct, universal start command (cross-platform, never blocked by Windows PowerShell script policy):
```bash
node server.js
```
*(Alternatively, you can run `npm start`).*

You should see:
```text
✅ Server running on port 3000
```

### 4. Open in browser
Visit **[http://localhost:3000](http://localhost:3000)** in your web browser.

---

## ☁️ Deploying to Vercel

This repository is pre-configured for **Vercel Zero-Config Deployment** using [`vercel.json`](./vercel.json) and [`api/index.js`](./api/index.js).

### Method 1: Deploy via GitHub (Recommended)
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```
2. Go to your [Vercel Dashboard](https://vercel.com) and click **Add New** > **Project**.
3. Import your GitHub repository.
4. Under **Settings > Environment Variables**, add:
   * `POLYGON_API_KEY` = your Polygon API key
   * `HUGGINGFACE_API_KEY` = your Hugging Face API key
5. Click **Deploy**. Vercel will build the project, host static assets on the global Edge CDN, and mount your backend on Serverless Functions.

### Method 2: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel
vercel env add POLYGON_API_KEY
vercel env add HUGGINGFACE_API_KEY
vercel --prod
```

---

## 📂 Project Structure

```text
├── api/
│   └── index.js             # Vercel serverless function entrypoint
├── public/
│   ├── index.html           # Main Single Page Application interface
│   ├── index.css            # Responsive styles, theme variables, print layout
│   ├── index.js             # Client state, SVG coordinate math, stream decoder
│   ├── utils/
│   │   └── dates.js         # Date range helper for market queries
│   └── images/              # SVGs, icons, and branding assets
├── .env.example             # Environment variable template
├── .gitignore               # Excludes .env, node_modules, logs
├── package.json             # Project dependencies and start scripts
├── server.js                # Express API server, cache controllers & prompt engine
└── vercel.json              # Vercel CDN static routes & API rewrites
```

---

## 📡 API Endpoints

### `POST /api/stock-data`
Fetches historical 3-day OHLC stock prices from Polygon.io with in-memory caching.
* **Body**: `{ "tickers": ["AAPL", "MSFT"], "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }`
* **Response**: `{ "data": [ { "ticker": "AAPL", "hasData": true, "results": [...] } ] }`

### `POST /api/report`
Streams real-time markdown stock analysis using Hugging Face LLM completion.
* **Body**: `{ "data": "formatted_stock_data_string", "style": "funny" | "serious" | "beginner" | "concise" | "dramatic" }`
* **Response**: Streamed chunked text buffer (`text/plain; charset=utf-8`).

---

## 📝 Disclaimer

This application is built for educational and experimental purposes. The predictions and analyses generated by the AI models do not constitute financial advice. Always perform your own due diligence before making investment decisions.
