import { dates } from './utils/dates.js'

if (window.location.protocol === 'file:') {

    window.location.href = 'http://localhost:3000'

}

/* ---------------- STATE ---------------- */

const tickersArr = []
let lastReportText = null
let lastStockData = []
let lastCacheMessage = ''
let lastMarketNotice = ''

/* ---------------- ELEMENTS ---------------- */

const actionPanel = document.querySelector('.action-panel')
const loadingPanel = document.querySelector('.loading-panel')
const outputPanel = document.querySelector('.output-panel')
const apiMessage = document.getElementById('api-message')
const generateReportBtn = document.querySelector('.generate-report-btn')
const themeToggleBtn = document.querySelector('.theme-toggle')
const reportStyleSelect = document.getElementById('report-style')
const loadingSteps = document.querySelectorAll('.loading-step')
const loadingStatus = document.querySelector('.loading-status')

/* ---------------- THEME ---------------- */

const savedTheme = localStorage.getItem('theme')
const systemPrefersDark =
    window.matchMedia('(prefers-color-scheme: dark)').matches
const initialTheme =
    savedTheme || (systemPrefersDark ? 'dark' : 'light')

applyTheme(initialTheme)

themeToggleBtn.addEventListener('click', () => {

    const nextTheme =
        document.body.classList.contains('dark-mode')
            ? 'light'
            : 'dark'

    applyTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)

})

function applyTheme(theme) {

    const isDark = theme === 'dark'

    document.documentElement.classList.toggle('dark-mode', isDark)
    document.body.classList.toggle('dark-mode', isDark)
    document.documentElement.style.backgroundColor =
        isDark ? '#101418' : ''
    document.documentElement.style.color =
        isDark ? '#f2f5f8' : ''
    document.body.style.backgroundColor = isDark ? '#101418' : ''
    document.body.style.color = isDark ? '#f2f5f8' : ''
    themeToggleBtn.textContent = isDark ? '☀️' : '🌙'
    themeToggleBtn.setAttribute(
        'aria-label',
        isDark ? 'Switch to light mode' : 'Switch to dark mode'
    )
    themeToggleBtn.setAttribute('aria-pressed', String(isDark))

}

/* ---------------- VIEW HANDLERS ---------------- */

function resetMainPageState() {

    tickersArr.length = 0
    renderTickers()
    generateReportBtn.disabled = true
    lastReportText = null
    lastStockData = []
    lastCacheMessage = ''
    lastMarketNotice = ''

}

function showMainPage() {

    actionPanel.style.display = 'flex'
    loadingPanel.style.display = 'none'
    outputPanel.style.display = 'none'
    
    renderTickers()
    generateReportBtn.disabled = tickersArr.length === 0

}

function showReportPage() {

    if (!lastReportText) {

        history.replaceState({}, '', '/')
        showMainPage()

        return

    }

    actionPanel.style.display = 'none'
    loadingPanel.style.display = 'none'
    outputPanel.style.display = 'flex'

}

/* ---------------- NAVIGATION ---------------- */

window.addEventListener('popstate', () => {

    window.location.pathname === '/report' && lastReportText
        ? showReportPage()
        : showMainPage()

})

if (window.location.pathname === '/report') {

    history.replaceState({}, '', '/')

}

showMainPage()

/* ---------------- FORM INPUT ---------------- */

document
    .getElementById('ticker-input-form')
    .addEventListener('submit', (e) => {

        e.preventDefault()

        const input = document.getElementById('ticker-input')
        const rawValue = input.value.trim()

        if (!rawValue) return

        // Split by comma, spaces, tabs, or newlines
        const rawTokens = rawValue
            .split(/[\s,]+/)
            .map((t) => t.trim().toUpperCase())
            .filter(Boolean)

        if (rawTokens.length === 0) return

        // Deduplicate tokens entered in the same batch
        const uniqueTokens = Array.from(new Set(rawTokens))

        // Validate ticker format
        const tickerRegex = /^[A-Z.]{1,6}$/
        const invalidTokens = uniqueTokens.filter((t) => !tickerRegex.test(t))
        if (invalidTokens.length > 0) {
            showInlineError(
                `Invalid ticker(s): ${invalidTokens.join(', ')}. Use valid US stock symbols (e.g. AAPL, MSFT, BRK.B).`
            )
            return
        }

        // Check for duplicate tickers already added
        const duplicateTokens = uniqueTokens.filter((t) => tickersArr.includes(t))
        const newTokens = uniqueTokens.filter((t) => !tickersArr.includes(t))

        if (newTokens.length === 0) {
            showInlineError(
                duplicateTokens.length === 1
                    ? `${duplicateTokens[0]} is already added.`
                    : `Selected tickers (${duplicateTokens.join(', ')}) are already added.`
            )
            input.value = ''
            return
        }

        // Check capacity limit (max 3 total)
        const availableSlots = 3 - tickersArr.length
        if (availableSlots <= 0) {
            showInlineError('You can add up to 3 tickers in total.')
            input.value = ''
            return
        }

        if (newTokens.length > availableSlots) {
            showInlineError(
                `You can only add ${availableSlots} more ticker${availableSlots === 1 ? '' : 's'} (max 3 total).`
            )
            return
        }

        // Add valid tokens to tickers array
        tickersArr.push(...newTokens)
        input.value = ''
        generateReportBtn.disabled = false
        renderTickers()

    })

const STOCK_ICONS = {
    AAPL: '🍎',
    MSFT: '🪟',
    NVDA: '🟢',
    TSLA: '🔴',
    AMZN: '📦',
    GOOGL: '🌈',
    META: '♾️',
    NFLX: '🎬',
    AMD: '⚡',
    INTC: '🔵',
    BRK: '🏛️',
    'BRK.B': '🏛️',
    SPY: '📈',
    QQQ: '🚀',
    DIS: '🏰'
}

function renderTickers() {

    const div = document.querySelector('.ticker-choice-display')
    if (!div) return
    div.innerHTML = ''

    if (tickersArr.length === 0) {

        div.innerHTML = '<span class="empty-placeholder">No stocks selected yet. Pick from above or search.</span>'

    } else {

        tickersArr.forEach((ticker) => {

            const chip = document.createElement('span')
            chip.classList.add('ticker-chip')

            const icon = document.createElement('span')
            icon.classList.add('chip-icon')
            icon.textContent = STOCK_ICONS[ticker] || '📈'

            const label = document.createElement('strong')
            label.classList.add('chip-label')
            label.textContent = ticker

            const removeBtn = document.createElement('button')
            removeBtn.type = 'button'
            removeBtn.classList.add('remove-ticker-btn')
            removeBtn.textContent = '✕'
            removeBtn.setAttribute('aria-label', `Remove ${ticker}`)
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                removeTicker(ticker)
            })

            chip.appendChild(icon)
            chip.appendChild(label)
            chip.appendChild(removeBtn)
            div.appendChild(chip)

        })

    }

    // Sync popular pill states
    document.querySelectorAll('.popular-pill[data-ticker]').forEach((pill) => {
        const t = pill.getAttribute('data-ticker')
        pill.classList.toggle('in-selection', tickersArr.includes(t))
    })

    // Update generate button disabled state
    generateReportBtn.disabled = tickersArr.length === 0

}

function removeTicker(ticker) {

    const index = tickersArr.indexOf(ticker)

    if (index >= 0) {

        tickersArr.splice(index, 1)
        renderTickers()

    }

}

function showInlineError(message) {

    const div = document.querySelector('.ticker-choice-display')
    if (!div) return
    div.textContent = message
    div.classList.add('inline-error')

    setTimeout(() => {

        div.classList.remove('inline-error')
        renderTickers()

    }, 2200)

}

/* ---------------- POPULAR STOCKS & STYLE CARDS SETUP ---------------- */

document.querySelectorAll('.popular-pill[data-ticker]').forEach((btn) => {

    btn.addEventListener('click', () => {

        const ticker = btn.getAttribute('data-ticker')
        if (!ticker) return

        if (tickersArr.includes(ticker)) {

            showInlineError(`${ticker} is already added.`)
            return

        }

        if (tickersArr.length >= 3) {

            showInlineError('You can add up to 3 tickers.')
            return

        }

        tickersArr.push(ticker)
        renderTickers()

    })

})

const popularMoreBtn = document.getElementById('popular-more-toggle')
const popularMoreContainer = document.getElementById('popular-more-container')

if (popularMoreBtn && popularMoreContainer) {

    popularMoreBtn.addEventListener('click', () => {

        const isHidden = popularMoreContainer.style.display === 'none' || !popularMoreContainer.style.display
        popularMoreContainer.style.display = isHidden ? 'flex' : 'none'
        popularMoreBtn.textContent = isHidden ? '- Less' : '+ More'

    })

}

const clearAllBtn = document.getElementById('clear-all-btn')

if (clearAllBtn) {

    clearAllBtn.addEventListener('click', () => {

        if (tickersArr.length === 0) return
        tickersArr.length = 0
        renderTickers()

    })

}

const styleCards = document.querySelectorAll('.style-card')

styleCards.forEach((card) => {

    card.addEventListener('click', () => {

        const style = card.getAttribute('data-style')
        if (!style) return

        styleCards.forEach((c) => {

            c.classList.remove('active')
            c.setAttribute('aria-checked', 'false')

        })

        card.classList.add('active')
        card.setAttribute('aria-checked', 'true')

        if (reportStyleSelect) {

            reportStyleSelect.value = style

        }

    })

})


/* ---------------- FORMAT DATA FOR AI ---------------- */

function formatStockDataForAI(stockDataArray) {

    return stockDataArray.map((stock) => {

        if (!stock.hasData) {

            return `
Ticker: ${stock.ticker}
Status: ${stock.reason}
`

        }

        return `
Ticker: ${stock.ticker}
Recent OHLC Data:
${JSON.stringify(stock.results, null, 2)}
`

    }).join('\n')

}

/* ---------------- GENERATE REPORT FLOW ---------------- */

generateReportBtn.addEventListener('click', fetchStockData)

async function fetchStockData() {

    // Clear previous report, stock data, and notices before starting a new fetch
    lastReportText = null
    lastStockData = []
    lastCacheMessage = ''
    lastMarketNotice = ''

    actionPanel.style.display = 'none'
    outputPanel.style.display = 'none'
    loadingPanel.style.display = 'flex'
    setLoadingStep('stock')
    setLoadingStatus('')

    try {

        const response = await fetch('/api/stock-data', {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({

                tickers: tickersArr,

                startDate: dates.startDate,

                endDate: dates.endDate

            })

        })

        const result = await response.json()

        if (!response.ok) {

            throw new Error(
                result.error || 'Polygon API failed while fetching data.'
            )

        }

        const validStocks = result.data.filter(
            (stock) => stock.hasData && stock.results && stock.results.length > 0
        )
        const unsupportedStocks = result.data.filter(
            (stock) => !stock.hasData || !stock.results || stock.results.length === 0
        )

        // If no entered ticker has valid US market data, do not call AI to hallucinate
        if (validStocks.length === 0) {
            const invalidTickers = unsupportedStocks.map((s) => s.ticker).join(', ')
            showError(
                'Only US Stocks Supported',
                `No US market data was found for "${invalidTickers}". Polygon.io only provides data for US-listed exchanges (NYSE, NASDAQ, AMEX). Indian exchange tickers (NSE/BSE) or non-US stocks cannot be analyzed.`
            )
            return
        }

        lastStockData = validStocks

        const cacheHits = validStocks.filter((stock) => stock.cached).length
        lastCacheMessage =
            cacheHits > 0
                ? `Using cached market data for ${cacheHits} ticker${cacheHits === 1 ? '' : 's'}.`
                : ''
        lastMarketNotice = getMarketClosedNotice(result.data)

        if (lastCacheMessage) {

            setLoadingStatus(lastCacheMessage)

        }

        if (lastMarketNotice) {

            setLoadingStatus(lastMarketNotice)

        }

        // Only send valid US stocks with actual OHLC prices to AI
        await fetchReport(formatStockDataForAI(validStocks))

    } catch (err) {

        console.error(err)
        showError(
            'Market data failed',
            err.message || 'Polygon API failed while fetching market data.'
        )

    }

}

async function fetchReport(data) {

    setLoadingStep('analyze')

    try {

        const response = await fetch('/api/report', {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({

                data,

                style: reportStyleSelect.value

            })

        })

        if (!response.ok) {

            const error = await response.json()

            throw new Error(
                error.error || 'AI report generation failed.'
            )

        }

        setLoadingStep('report')
        prepareReportPage(response.headers.get('X-Report-Cache') === 'HIT')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let report = ''

        while (true) {

            const { value, done } = await reader.read()

            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            report += chunk
            updateReportText(report)

        }

        report += decoder.decode()
        updateReportText(report)
        lastReportText = report
        history.pushState({}, '', '/report')

    } catch (err) {

        console.error(err)
        showError(
            'AI report failed',
            err.message || 'Hugging Face report generation failed. Check the API key or try again.'
        )

    }

}

/* ---------------- LOADING ---------------- */

function setLoadingStep(activeStep) {

    const messages = {
        stock: 'Fetching stock data...',
        analyze: 'Analyzing trends...',
        report: 'Generating report...'
    }

    apiMessage.innerText = messages[activeStep]

    loadingSteps.forEach((step) => {

        const isActive = step.dataset.step === activeStep
        const isDone =
            ['stock', 'analyze', 'report'].indexOf(step.dataset.step) <
            ['stock', 'analyze', 'report'].indexOf(activeStep)

        step.classList.toggle('active', isActive)
        step.classList.toggle('done', isDone)

    })

}

function setLoadingStatus(message) {

    loadingStatus.textContent = message

}

function getMarketClosedNotice(stockData) {

    const missingTickers = stockData
        .filter((stock) => !stock.hasData)
        .map((stock) => stock.ticker)

    const partialTickers = stockData
        .filter((stock) =>
            stock.hasData &&
            stock.results &&
            stock.results.length < 3
        )
        .map((stock) => stock.ticker)

    const notices = []

    if (missingTickers.length > 0) {
        notices.push(
            `Notice: ${missingTickers.join(', ')} is not a supported US stock on Polygon.io and was excluded. Only US market data is analyzed.`
        )
    }

    if (partialTickers.length > 0) {
        notices.push(
            `Recent market data is limited for ${partialTickers.join(', ')}. This can happen around weekends or market holidays.`
        )
    }

    return notices.join(' ')

}

function showError(title, message) {

    loadingPanel.style.display = 'none'
    outputPanel.style.display = 'flex'
    outputPanel.innerHTML = ''

    const heading = document.createElement('h2')
    heading.textContent = title

    const p = document.createElement('p')
    p.classList.add('error-message')
    p.textContent = message

    const backBtn = document.createElement('button')
    backBtn.type = 'button'
    backBtn.classList.add('secondary-action-btn')
    backBtn.textContent = 'Try Again'
    backBtn.addEventListener('click', () => {

        history.replaceState({}, '', '/')
        showMainPage()

    })

    outputPanel.appendChild(heading)
    outputPanel.appendChild(p)
    outputPanel.appendChild(backBtn)

}

/* ---------------- REPORT RENDERING ---------------- */

function prepareReportPage(reportCached) {

    loadingPanel.style.display = 'none'

    const selectedStyle = reportStyleSelect ? reportStyleSelect.value : 'funny'
    const styleHeaders = {
        funny: { title: 'Your Report 😜', badge: '😂 Style: Funny & Witty' },
        serious: { title: 'Market Analysis 📊', badge: '💼 Style: Serious Analyst' },
        beginner: { title: 'Stock Guide 💡', badge: '🌱 Style: Beginner-Friendly' },
        concise: { title: 'Executive Brief ⚡', badge: '⚡ Style: Concise' },
        dramatic: { title: 'Market Showdown 🎬', badge: '🔥 Style: Dramatic' }
    }
    const config = styleHeaders[selectedStyle] || styleHeaders.funny

    outputPanel.innerHTML = `<h2>${config.title}</h2><div class="style-badge-wrap"><span class="style-badge">${config.badge}</span></div>`

    const status = document.createElement('div')
    status.classList.add('report-status')

    const messages = []

    if (lastCacheMessage) messages.push(lastCacheMessage)
    if (lastMarketNotice) messages.push(lastMarketNotice)
    if (reportCached) messages.push('Using cached AI report.')

    status.textContent =
        messages.length > 0
            ? messages.join(' ')
            : 'Fresh market data and AI report generated.'

    const charts = renderCharts(lastStockData)
    const reportControls = renderReportControls()
    const report = document.createElement('div')
    report.classList.add('report-text')
    report.classList.add('markdown-report')

    outputPanel.appendChild(status)
    outputPanel.appendChild(charts)
    outputPanel.appendChild(reportControls)
    outputPanel.appendChild(report)

    lastReportText = 'Generating...'
    showReportPage()

}

function updateReportText(output) {

    lastReportText = output

    const report = outputPanel.querySelector('.report-text')

    if (report) report.innerHTML = markdownToHtml(output)

}

function markdownToHtml(markdown) {

    const lines = markdown.split('\n')
    const html = []
    let inList = false

    lines.forEach((line) => {

        const trimmed = line.trim()

        if (!trimmed) {

            if (inList) {

                html.push('</ul>')
                inList = false

            }

            return

        }

        if (trimmed.startsWith('## ')) {

            if (inList) {

                html.push('</ul>')
                inList = false

            }

            html.push(`<h3>${formatInlineMarkdown(trimmed.slice(3))}</h3>`)
            return

        }

        if (trimmed.startsWith('- ')) {

            if (!inList) {

                html.push('<ul>')
                inList = true

            }

            html.push(`<li>${formatInlineMarkdown(trimmed.slice(2))}</li>`)
            return

        }

        if (inList) {

            html.push('</ul>')
            inList = false

        }

        html.push(`<p>${formatInlineMarkdown(trimmed)}</p>`)

    })

    if (inList) html.push('</ul>')

    return html.join('')

}

function formatInlineMarkdown(text) {

    return escapeHtml(text).replace(

        /\*\*(.+?)\*\*/g,

        '<strong>$1</strong>'

    )

}

function escapeHtml(text) {

    return text

        .replace(/&/g, '&amp;')

        .replace(/</g, '&lt;')

        .replace(/>/g, '&gt;')

        .replace(/"/g, '&quot;')

        .replace(/'/g, '&#039;')

}

function renderReportControls() {

    const controls = document.createElement('div')
    controls.classList.add('report-actions')

    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.classList.add('secondary-action-btn')
    copyBtn.textContent = 'Copy'
    copyBtn.addEventListener('click', copyReport)

    const pdfBtn = document.createElement('button')
    pdfBtn.type = 'button'
    pdfBtn.classList.add('secondary-action-btn')
    pdfBtn.textContent = 'Download PDF'
    pdfBtn.addEventListener('click', downloadReportPdf)

    controls.appendChild(copyBtn)
    controls.appendChild(pdfBtn)

    return controls

}

async function copyReport() {

    if (!lastReportText) return

    try {

        await navigator.clipboard.writeText(lastReportText)

    } catch {

        const textarea = document.createElement('textarea')
        textarea.value = lastReportText
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()

    }

}

function downloadReportPdf() {

    if (!lastReportText) return

    document.title = 'Stock Prediction Report'
    window.print()

}

function renderCharts(stockData) {

    const wrap = document.createElement('div')
    wrap.classList.add('charts-grid')

    stockData.forEach((stock) => {

        const chart = document.createElement('div')
        chart.classList.add('mini-chart')

        const title = document.createElement('strong')
        title.textContent = stock.ticker
        chart.appendChild(title)

        if (!stock.hasData) {

            const empty = document.createElement('span')
            empty.textContent = 'No data'
            chart.appendChild(empty)
            wrap.appendChild(chart)
            return

        }

        const closes = stock.results.map((point) => point.c)
        const min = Math.min(...closes)
        const max = Math.max(...closes)
        const range = max - min || 1
        const points = closes.map((close, index) => {

            const dataPoint = stock.results[index]
            const x =
                closes.length === 1
                    ? 50
                    : (index / (closes.length - 1)) * 100
            const y = 42 - ((close - min) / range) * 34

            return {

                x,

                y,

                close,

                date: formatChartDate(dataPoint.t),

                ticker: stock.ticker

            }

        })

        const polylinePoints = points

            .map((point) => `${point.x},${point.y}`)

            .join(' ')

        const circlePoints = points

            .map((point, index) =>

                `<circle
                    cx="${point.x}"
                    cy="${point.y}"
                    r="4"
                    tabindex="0"
                    role="button"
                    class="chart-point"
                    data-point-index="${index}"
                    data-ticker="${escapeHtml(point.ticker)}"
                    data-close="${formatCurrency(point.close)}"
                    data-date="${escapeHtml(point.date)}"
                    aria-label="${escapeHtml(point.ticker)} close price ${formatCurrency(point.close)} on ${escapeHtml(point.date)}"
                />`

            )

            .join('')

        chart.insertAdjacentHTML(
            'beforeend',
            `<svg viewBox="0 0 100 48" role="img" aria-label="${stock.ticker} close price mini chart">
                <polyline points="${polylinePoints}" />
                ${circlePoints}
            </svg>`
        )

        const details = document.createElement('div')
        details.classList.add('chart-point-details')
        details.textContent = 'Tap a point for close price'
        chart.appendChild(details)

        chart.querySelectorAll('.chart-point').forEach((point) => {

            point.addEventListener('click', () => {

                showChartPointDetails(chart, point)

            })

            point.addEventListener('keydown', (event) => {

                if (event.key === 'Enter' || event.key === ' ') {

                    event.preventDefault()
                    showChartPointDetails(chart, point)

                }

            })

        })

        wrap.appendChild(chart)

    })

    return wrap

}

function showChartPointDetails(chart, point) {

    chart.querySelectorAll('.chart-point').forEach((chartPoint) => {

        chartPoint.classList.remove('selected')

    })

    point.classList.add('selected')

    const details = chart.querySelector('.chart-point-details')

    details.innerHTML =
        `<strong>${point.dataset.ticker}</strong>
        <span>Close: ${point.dataset.close}</span>
        <span>Date: ${point.dataset.date}</span>`

}

function formatChartDate(timestamp) {

    return new Intl.DateTimeFormat('en-US', {

        month: 'short',

        day: 'numeric',

        year: 'numeric'

    }).format(new Date(timestamp))

}

function formatCurrency(value) {

    return new Intl.NumberFormat('en-US', {

        style: 'currency',

        currency: 'USD',

        minimumFractionDigits: 2,

        maximumFractionDigits: 2

    }).format(value)

}
