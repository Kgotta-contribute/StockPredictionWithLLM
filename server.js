import fs from 'fs'

import express from 'express'

import cors from 'cors'

import dotenv from 'dotenv'

import path from 'path'

import { fileURLToPath } from 'url'

import { InferenceClient } from '@huggingface/inference'

 

dotenv.config()

 

/* ---------------- BASIC SETUP ---------------- */

 

const app = express()

 

const __filename = fileURLToPath(import.meta.url)

const __dirname = path.dirname(__filename)

 

app.use(cors())

app.use(express.json())

app.use(express.static('public'))

 

/* ---------------- AI CONFIG ---------------- */

 

const HF_MODEL = process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-72B-Instruct'

const HF_PROVIDER = process.env.HUGGINGFACE_PROVIDER || 'auto'

const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY)

/*
Safekept Ollama config. Restore these with the commented Ollama route below
if you want to switch back to local Ollama later.

const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = 'llama3'
*/

const STOCK_CACHE_TTL_MS = 10 * 60 * 1000

const REPORT_CACHE_TTL_MS = 30 * 60 * 1000

const REPORT_PROMPT_VERSION = 'style-v5'

const stockDataCache = new Map()

const reportCache = new Map()

const reportStylePersonas = {

    funny: `You are a hilariously witty stock market analyst and comedian.
Tone: Playful, humorous, witty, and entertaining.
Guidelines:
- Include 1-2 funny jokes, puns, or relatable everyday analogies for each stock.
- Poke lighthearted fun at market panic, greed, or hype.
- Keep numbers and recommendations accurate, but make the commentary genuinely laugh-out-loud funny.`,

    serious: `You are a Senior Wall Street Quantitative Analyst and Institutional Portfolio Manager.
Tone: Strictly professional, sober, analytical, and authoritative.
Guidelines:
- Use formal financial terminology (e.g., price consolidation, trend continuation, volatility, momentum).
- Absolutely NO jokes, emojis, slang, or theatrical language.
- Provide objective, data-backed reasoning for your BUY, HOLD, or SELL recommendations.`,

    beginner: `You are a friendly, patient financial educator explaining the market to a complete beginner (ELI5).
Tone: Warm, welcoming, encouraging, and jargon-free.
Guidelines:
- Explain every price movement in simple, everyday English.
- Avoid technical financial jargon (or explain it in simple terms, e.g. "closing price = the price when the market ended the day").
- Clearly explain WHY you recommend BUY, HOLD, or SELL so someone who has never traded before feels confident.`,

    concise: `You are an Executive Intelligence Analyst delivering a high-priority brief.
Tone: Ultra-condensed, rapid-fire, direct, and efficient.
Guidelines:
- ZERO filler, pleasantries, or preamble.
- Strictly keep the ENTIRE response under 80 words.
- Format: Ticker | 3-Day Shift | Action | 1-sentence rationale.`,

    dramatic: `You are a cinematic movie trailer narrator chronicling an epic clash in the financial arena.
Tone: Blockbuster, high-energy, suspenseful, and intense.
Guidelines:
- Frame market movements as an epic struggle of Bulls vs. Bears, peril, and triumph.
- Use vivid, powerful language ("rallied fiercely", "teetering on the precipice", "an unstoppable surge").
- Keep prices accurate, but amplify the narrative tension and excitement.`

}

function getStyleTemperature(style) {

    switch (style) {

        case 'serious':
            return 0.25

        case 'concise':
            return 0.3

        case 'beginner':
            return 0.65

        case 'funny':
            return 0.85

        case 'dramatic':
            return 0.9

        default:
            return 0.75

    }

}

function getCache(cache, key) {

    const cached = cache.get(key)

    if (!cached) return null

    if (Date.now() > cached.expiresAt) {

        cache.delete(key)

        return null

    }

    return cached.value

}

function setCache(cache, key, value, ttlMs) {

    cache.set(key, {

        value,

        expiresAt: Date.now() + ttlMs

    })

}

function buildUserPrompt(data) {

    return `Analyze the following US stock market price data from the past 3 trading days for the provided tickers only:

Stock Data:
${data}

Requirements:
- Base your analysis ONLY on the tickers with actual price data listed in the Stock Data above. Do NOT invent, guess, or add any other tickers.
- Note the closing price on the 1st trading day and 3rd trading day, describe the price movement trend, and recommend ONE action: **BUY**, **HOLD**, or **SELL**.
- Absolutely never invent stock facts or make up recommendations for any ticker that lacks pricing data.
- Format in Markdown starting with "## Market Summary", followed by a bullet point for each ticker (with the ticker symbol and recommendation in bold), and end with a "Bottom line" sentence.
- Strictly embody your assigned persona and style throughout the entire report!`

}

 

function log(label, value) {

    const output =

        typeof value === 'object'

            ? JSON.stringify(value, null, 2)

            : value

 

    const line = `\n${label}:\n${output}\n`

    console.log(line)

    try {
        fs.appendFileSync('./logs/error.log', line)
    } catch (err) {
        // Silently catch write errors on read-only serverless filesystems
    }

}

 

/* ---------------- POLYGON BACKEND ROUTE (FIX ✅) ---------------- */

/* ✅ Detect empty results and mark them explicitly */

 

app.post('/api/stock-data', async (req, res) => {

    const startedAt = Date.now()

    try {

        const { tickers, startDate, endDate } = req.body

        if (!Array.isArray(tickers) || tickers.length === 0) {

            return res.status(400).json({

                errorType: 'validation',

                error: 'Please add at least one stock ticker.'

            })

        }

        const normalizedTickers = tickers.map((ticker) =>

            ticker.trim().toUpperCase()

        )

        const results = await Promise.all(

            normalizedTickers.map(async (ticker) => {

                const cacheKey = `${ticker}:${startDate}:${endDate}`

                const cached = getCache(stockDataCache, cacheKey)

                if (cached) {

                    return { ...cached, cached: true }

                }

                const url =

                    `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${startDate}/${endDate}?apiKey=${process.env.POLYGON_API_KEY}`

                const response = await fetch(url)

                if (!response.ok) {

                    throw new Error(

                        `Polygon API returned ${response.status} for ${ticker}`

                    )

                }

                const text = await response.text()

                const json = JSON.parse(text)

                const recentResults = json.results

                    ? json.results.slice(-3)

                    : []

                const stockResult =

                    recentResults.length === 0

                        ? {

                            ticker,

                            hasData: false,

                            reason: 'No US market data available on Polygon.io (only US exchange-listed stocks are supported)'

                        }

                        : {

                            ticker,

                            hasData: true,

                            results: recentResults

                        }

                setCache(

                    stockDataCache,

                    cacheKey,

                    stockResult,

                    STOCK_CACHE_TTL_MS

                )

                return { ...stockResult, cached: false }

            })

        )

        log('STOCK DATA TIMING', {

            tickers: normalizedTickers,

            cacheHits: results.filter((result) => result.cached).length,

            durationMs: Date.now() - startedAt

        })

        res.json({ data: results })

    } catch (err) {

        console.error(err)

        res.status(502).json({

            errorType: 'polygon',

            error: `Polygon API failed: ${err.message}`

        })

    }

})

 

/* ---------------- STREAMING HUGGING FACE AI REPORT ---------------- */

app.post('/api/report', async (req, res) => {

    const startedAt = Date.now()

    try {

        const { data, style = 'funny' } = req.body

        if (!data) {

            return res.status(400).json({

                errorType: 'validation',

                error: 'No stock data was provided for the report.'

            })

        }

        const reportCacheKey = `${REPORT_PROMPT_VERSION}:${style}:${data}`

        const cachedReport = getCache(reportCache, reportCacheKey)

        if (cachedReport) {

            log('REPORT CACHE HIT', {

                style,

                durationMs: Date.now() - startedAt

            })

            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('X-Report-Cache', 'HIT')

            return res.end(cachedReport)

        }

        const systemPersona = reportStylePersonas[style] || reportStylePersonas.funny
        const userPrompt = buildUserPrompt(data)

        log('POSTING TO HUGGING FACE', {

            model: HF_MODEL,

            provider: HF_PROVIDER,

            style,

            promptLength: userPrompt.length

        })

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('X-Report-Cache', 'MISS')

        let report = ''

        const stream = hf.chatCompletionStream({

            model: HF_MODEL,

            provider: HF_PROVIDER,

            messages: [

                {

                    role: 'system',

                    content: systemPersona

                },

                {

                    role: 'user',

                    content: userPrompt

                }

            ],

            max_tokens: 520,

            temperature: getStyleTemperature(style)

        })

        for await (const chunk of stream) {

            const text =

                chunk.choices?.[0]?.delta?.content || ''

            if (!text) continue

            report += text
            res.write(text)

        }

        setCache(reportCache, reportCacheKey, report, REPORT_CACHE_TTL_MS)

        log('HUGGING FACE RESPONSE', {

            style,

            responseLength: report.length,

            durationMs: Date.now() - startedAt

        })

        res.end()

    } catch (err) {

        const errorText = `

TIME: ${new Date()}

MESSAGE:
${err.message}

STACK:
${err.stack}

`

        try {
            fs.appendFileSync('./logs/error.log', errorText)
        } catch (e) {
            // Silently catch write errors on read-only serverless filesystems
        }

        if (!res.headersSent) {

            return res.status(503).json({

                success: false,

                errorType: 'huggingface',

                error: `Hugging Face report generation failed: ${err.message}. Check the API key, model, provider, or account limits.`

            })

        }

        res.end('\n\nReport generation stopped before finishing.')

    }

})

// /* ---------------- LEGACY OLLAMA AI REPORT ---------------- */

 

// app.post('/api/report', async (req, res) => {

//     const startedAt = Date.now()

//     let rawText = null

//     let ollamaJson = null

 

//     try {

//         const { data } = req.body

//         const reportCacheKey = data

//         const cachedReport = getCache(reportCache, reportCacheKey)

//         if (cachedReport) {

//             log('REPORT CACHE HIT', {

//                 durationMs: Date.now() - startedAt

//             })

//             return res.json({

//                 success: true,

//                 report: cachedReport,

//                 cached: true

//             })

//         }

 


//         const prompt = `

//             You are a dramatic stock market expert with a sharp sense of humour.

//             Analyze the following stock price data from the past 3 trading days.
//             Base your analysis ONLY on the data provided.

//             For each stock ticker WITH available price data:
//             - Mention the closing price on the 1st trading day(oldest data point) and the 3rd trading day(most recent data).
//             - Describe the recent price movement in exciting, dramatic language.
//             - Recommend ONE action: BUY, HOLD, or SELL.

//             For stock tickers with MISSING or UNAVAILABLE data:
//             - Use only the stock ticker symbol (do not guess company names).
//             - Explicitly say: "Insufficient recent market data — unable to recommend."

//             Rules:

//             - Do NOT guess or invent any data.
//             - Include ALL tickers in the response.
//             - Clearly separate the analysis for each ticker.
//             - Keep the FULL response under 150 words.
//             - Make people laugh with the data you have.
//             - Use engaging, intriguing, great humour, but do NOT give false certainty.

//             Stock Data:

//             ${data}
//             `




//         // const prompt = `

//         //     You are a dramatic stock market expert with a sharp sense of humour.

//         //     Analyze the following stock price data from the past 3 trading days.
//         //     Base your analysis ONLY on the data provided.

//         //     For each stock ticker WITH available price data:
//         //     - Mention the closing price on the 1st trading day and the 3rd trading day.
//         //     - Describe the recent price movement in exciting, dramatic language.
//         //     - Recommend ONE action: BUY, HOLD, or SELL.

//         //     For stock tickers with MISSING or UNAVAILABLE data:
//         //     - Use only the stock ticker symbol (do not guess company names).
//         //     - Explicitly say: "Insufficient recent market data — unable to recommend."

//         //     Rules:

//         //     - Do NOT guess or invent any data.
//         //     - Include ALL tickers in the response.
//         //     - Clearly separate the analysis for each ticker.
//         //     - Keep the FULL response under 150 words.
//         //     - Make people laugh with the data you have.
//         //     - Use engaging, intriguing, great humour, but do NOT give false certainty.

//         //     Stock Data:

//         //     ${data}
//         //     `

 

//         log('POSTING TO OLLAMA', {

//             url: OLLAMA_URL,

//             promptLength: prompt.length

//         })

 

//         const response = await fetch(OLLAMA_URL, {

//             method: 'POST',

//             headers: { 'Content-Type': 'application/json' },

//             body: JSON.stringify({

//                 model: MODEL,

//                 prompt,

//                 stream: false

//             })

//         })

 

//         rawText = await response.text()

//         ollamaJson = JSON.parse(rawText)

//         const report =

//             ollamaJson?.response || 'No AI response generated.'

//         setCache(

//             reportCache,

//             reportCacheKey,

//             report,

//             REPORT_CACHE_TTL_MS

//         )

//         log('OLLAMA RESPONSE', {

//             responseLength: report.length,

//             durationMs: Date.now() - startedAt

//         })

 

//         res.json({

//             success: true,

//             report,

//             cached: false

//         })

 

//     } catch (err) {

//         const errorText = `

// TIME: ${new Date()}

 

// MESSAGE:

// ${err.message}

 

// STACK:

// ${err.stack}

// `

//         fs.appendFileSync('./logs/error.log', errorText)

//         res.status(500).json({ success: false, error: 'AI generation failed' })

//     }

// })

 

/* ---------------- SPA FALLBACK (EXPRESS 5 SAFE ✅) ---------------- */

 

app.get(/.*/, (req, res) => {

    res.sendFile(path.join(__dirname, 'public', 'index.html'))

})

 

/* ---------------- START SERVER ---------------- */

if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000
    app.listen(port, () => {
        console.log(`✅ Server running on port ${port}`)
    })
}

export default app

