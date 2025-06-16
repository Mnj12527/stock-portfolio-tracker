const API_BASE_URL = 'http://localhost:5000';
// authToken will now be received from the parent page or localStorage
let authToken = localStorage.getItem('token');
let allUserPortfolios = []; // Stores all portfolio entries from the backend
let currentChart; // To hold the Chart.js instance

// Element references
const portfolioSelect = document.getElementById('portfolioSelect');
const totalPortfolioValueEl = document.getElementById('totalPortfolioValue');
const totalStocksHeldEl = document.getElementById('totalStocksHeld');
const unrealizedGainLossEl = document.getElementById('unrealizedGainLoss');
const realizedGainLossEl = document.getElementById('realizedGainLoss');
const holdingsTableBody = document.getElementById('holdingsTableBody');
const holdingsChartCanvas = document.getElementById('holdingsChart');
const chartPlaceholderText = document.getElementById('portfolio-chart-placeholder-text');
const holdingsLoadingIndicator = document.getElementById('holdingsLoadingIndicator');

const dayChangePercentEl = document.getElementById('dayChangePercent');
const dayChangeAmountEl = document.getElementById('dayChangeAmount');
const highestGainerSymbolEl = document.getElementById('highestGainerSymbol');
const highestGainerPercentEl = document.getElementById('highestGainerPercent');
const looserStockSymbolEl = document.getElementById('looserStockSymbol');
const looserStockPercentEl = document.getElementById('looserStockPercent');


// Function to fetch user portfolios
async function fetchUserPortfolios() {
    if (!authToken) {
        console.error('No token found, cannot fetch portfolios. Please log in.');
        // Optionally redirect to login page
        // window.location.href = '/Home.html'; // Adjust as per your login page path
        return;
    }

    holdingsLoadingIndicator.style.display = 'block'; // Show loading indicator

    try {
        const response = await fetch(`${API_BASE_URL}/portfolio`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.error('Authentication failed. Please log in again.');
                // Handle token expiration/invalidity - redirect to login
                localStorage.removeItem('token');
                // window.location.href = '/Home.html';
                alert('Session expired. Please log in again.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json(); // This 'data' might be an object containing the array

        // --- START OF UPDATED FIX FOR TypeError ---
        let actualPortfoliosArray = [];
        if (Array.isArray(data)) {
            // If the response is directly an array (ideal scenario)
            actualPortfoliosArray = data;
        } else if (data && typeof data === 'object' && Array.isArray(data.portfolios)) {
            // Common case: server wraps array in an object like { portfolios: [...] }
            actualPortfoliosArray = data.portfolios;
        } else if (data && typeof data === 'object' && Array.isArray(data.data)) {
             // Another common case: server wraps array in an object like { data: [...] }
            actualPortfoliosArray = data.data;
        } else if (data && typeof data === 'object' && Array.isArray(data.portfolio)) { // <--- NEW ADDITION FOR {portfolio: Array(X)}
            actualPortfoliosArray = data.portfolio;
        }
        else {
            console.warn('Server response for portfolios was not an array or did not contain an expected array property (e.g., "portfolios", "data", or "portfolio"). Response:', data);
            // Default to an empty array to prevent further errors if response is unexpected
            actualPortfoliosArray = [];
        }
        // --- END OF UPDATED FIX ---

        allUserPortfolios = actualPortfoliosArray; // Store the correctly extracted array
        console.log('Fetched and processed user portfolios:', allUserPortfolios);


        populatePortfolioDropdown(allUserPortfolios);

        // Select the first portfolio by default if available
        if (allUserPortfolios.length > 0) {
            const defaultPortfolioName = allUserPortfolios[0].portfolioName;
            portfolioSelect.value = defaultPortfolioName;
            filterAndRenderPortfolio(defaultPortfolioName);
        } else {
            // If no portfolios, clear everything
            updatePortfolioMetrics(null);
            renderHoldingsTable([]);
            drawHoldingsChart([]);
            updateDailyChanges([]);
        }

    } catch (error) {
        console.error('Error fetching user portfolios:', error);
        alert('Failed to load portfolio data. Please try again.');
    } finally {
        holdingsLoadingIndicator.style.display = 'none'; // Hide loading indicator
    }
}

// Function to populate the portfolio dropdown
function populatePortfolioDropdown(portfolios) {
    portfolioSelect.innerHTML = ''; // Clear existing options
    if (portfolios.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No Portfolios Available';
        portfolioSelect.appendChild(option);
        return;
    }

    // This line (93:57) caused the error when 'portfolios' was not an array
    const uniquePortfolioNames = [...new Set(portfolios.map(p => p.portfolioName))];
    console.log('Unique portfolio names:', uniquePortfolioNames);

    uniquePortfolioNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        portfolioSelect.appendChild(option);
    });
}

// Function to update portfolio metrics
function updatePortfolioMetrics(portfolioData) {
    let totalValue = 0;
    let totalStocks = 0;
    let totalUnrealizedGainLoss = 0;
    let totalRealizedGainLoss = 0; // Assuming this needs to be calculated or fetched separately if not in individual holdings

    if (portfolioData && portfolioData.length > 0) {
        portfolioData.forEach(holding => {
            const latestPrice = parseFloat(holding.currentPrice) || 0;
            const quantity = parseFloat(holding.quantity) || 0;
            const purchasePrice = parseFloat(holding.purchasePrice) || 0;

            totalValue += (latestPrice * quantity);
            totalStocks += quantity; // Sum of quantities
            totalUnrealizedGainLoss += ((latestPrice * quantity) - (purchasePrice * quantity));
            // Assuming realized gain/loss might be part of holding if applicable
            totalRealizedGainLoss += parseFloat(holding.realizedGainLoss || 0);
        });
    }

    totalPortfolioValueEl.textContent = `$${totalValue.toFixed(2)}`;
    totalStocksHeldEl.textContent = totalStocks.toFixed(0);
    unrealizedGainLossEl.textContent = `$${totalUnrealizedGainLoss.toFixed(2)}`;
    realizedGainLossEl.textContent = `$${totalRealizedGainLoss.toFixed(2)}`; // Needs actual data if not from individual holdings
    unrealizedGainLossEl.className = `portfolio-metric-value ${totalUnrealizedGainLoss >= 0 ? 'text-green-700' : 'text-red-700'}`;
}


// Function to filter and render portfolio based on selection
function filterAndRenderPortfolio(portfolioName) {
    const filteredHoldings = allUserPortfolios.filter(p => p.portfolioName === portfolioName);
    console.log(`Filtering for portfolio: ${portfolioName}. Found ${filteredHoldings.length} holdings.`);

    updatePortfolioMetrics(filteredHoldings);
    renderHoldingsTable(filteredHoldings);
    drawHoldingsChart(filteredHoldings);
    updateDailyChanges(filteredHoldings); // Update daily changes for the filtered portfolio
}


// Updated Function to render holdings table - with fix for DOMTokenList error
function renderHoldingsTable(holdings) {
    holdingsTableBody.innerHTML = ''; // Clear existing rows
    chartPlaceholderText.classList.add('portfolio-hidden'); // Hide placeholder if there are holdings

    if (holdings.length === 0) {
        holdingsTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500">No holdings in this portfolio.</td></tr>';
        chartPlaceholderText.classList.remove('portfolio-hidden'); // Show placeholder if no holdings
        return;
    }

    holdings.forEach(holding => {
        const row = document.createElement('tr');

        // Ensure numeric values, default to 0 for safety
        const latestPrice = parseFloat(holding.currentPrice) || 0;
        const purchasePrice = parseFloat(holding.purchasePrice) || 0;
        const quantity = parseFloat(holding.quantity) || 0;

        const currentValue = (latestPrice * quantity).toFixed(2);
        const gainLoss = (currentValue - (purchasePrice * quantity)).toFixed(2);
        const gainLossPercent = (purchasePrice * quantity) > 0 ? ((gainLoss / (purchasePrice * quantity)) * 100).toFixed(2) : 0;

        // Determine the class for gain/loss display
        const gainLossClass = gainLoss >= 0 ? 'text-green-600' : 'text-red-600';

        // Create and append table cells dynamically
        const symbolCell = document.createElement('td');
        symbolCell.textContent = holding.symbol;
        row.appendChild(symbolCell);

        const quantityCell = document.createElement('td');
        quantityCell.textContent = quantity;
        row.appendChild(quantityCell);

        const purchasePriceCell = document.createElement('td');
        purchasePriceCell.textContent = `$${purchasePrice.toFixed(2)}`;
        row.appendChild(purchasePriceCell);

        const currentPriceCell = document.createElement('td');
        currentPriceCell.textContent = `$${latestPrice.toFixed(2)}`;
        row.appendChild(currentPriceCell);

        const currentValueCell = document.createElement('td');
        currentValueCell.textContent = `$${currentValue}`;
        currentValueCell.classList.add('text-right');
        row.appendChild(currentValueCell);

        const gainLossDisplayCell = document.createElement('td');
        gainLossDisplayCell.textContent = `$${gainLoss}`;
        gainLossDisplayCell.classList.add('text-right');
        // Safeguard to ensure the class name is not empty
        if (gainLossClass && gainLossClass.trim() !== '') {
            gainLossDisplayCell.classList.add(gainLossClass);
        }
        row.appendChild(gainLossDisplayCell);

        const gainLossPercentDisplayCell = document.createElement('td');
        gainLossPercentDisplayCell.textContent = `${gainLossPercent}%`;
        gainLossPercentDisplayCell.classList.add('text-right');
        // Safeguard to ensure the class name is not empty
        if (gainLossClass && gainLossClass.trim() !== '') {
            gainLossPercentDisplayCell.classList.add(gainLossClass);
        }
        row.appendChild(gainLossPercentDisplayCell);

        holdingsTableBody.appendChild(row);
    });
}


// Function to draw holdings chart
function drawHoldingsChart(holdings) {
    if (currentChart) {
        currentChart.destroy(); // Destroy existing chart instance
    }

    if (holdings.length === 0) {
        holdingsChartCanvas.style.display = 'none'; // Hide canvas if no data
        chartPlaceholderText.classList.remove('portfolio-hidden'); // Show placeholder
        return;
    } else {
        holdingsChartCanvas.style.display = 'block'; // Show canvas if data exists
        chartPlaceholderText.classList.add('portfolio-hidden'); // Hide placeholder
    }

    const ctx = holdingsChartCanvas.getContext('2d');

    const labels = holdings.map(h => h.symbol);
    const data = holdings.map(h => (parseFloat(h.currentPrice) * parseFloat(h.quantity)) || 0);

    currentChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
                    '#E7E9ED', '#FF6384', '#36A2EB', '#FFCE56'
                ],
                hoverBackgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
                    '#E7E9ED', '#FF6384', '#36A2EB', '#FFCE56'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                title: {
                    display: true,
                    text: 'Portfolio Distribution by Value'
                }
            }
        }
    });
}

// Function to update daily changes for top gainer/looser
function updateDailyChanges(portfolioData) {
    let totalDayChangeAmount = 0;
    let totalDayChangePercent = 0;
    let marketValue = 0; // Total current market value of all holdings for percentage calculation

    let highestGainer = { symbol: 'N/A', percent: -Infinity };
    let looserStock = { symbol: 'N/A', percent: Infinity };

    if (portfolioData && portfolioData.length > 0) {
        portfolioData.forEach(holding => {
            const currentPrice = parseFloat(holding.currentPrice) || 0;
            const purchasePrice = parseFloat(holding.purchasePrice) || 0;
            const quantity = parseFloat(holding.quantity) || 0;

            const dayOpenPrice = parseFloat(holding.dayOpenPrice) || purchasePrice; // Use purchase price if dayOpenPrice is missing
            const stockDayChangeAmount = (currentPrice - dayOpenPrice) * quantity;
            totalDayChangeAmount += stockDayChangeAmount;

            const stockCurrentValue = currentPrice * quantity;
            marketValue += stockCurrentValue;

            if (dayOpenPrice > 0) { // Avoid division by zero
                const stockDayChangePercent = ((currentPrice - dayOpenPrice) / dayOpenPrice) * 100;

                if (stockDayChangePercent > highestGainer.percent) {
                    highestGainer = { symbol: holding.symbol, percent: stockDayChangePercent };
                }
                if (stockDayChangePercent < looserStock.percent) {
                    looserStock = { symbol: holding.symbol, percent: stockDayChangePercent };
                }
            }
        });

        // Calculate overall day change percentage
        if (marketValue > 0) {
            totalDayChangePercent = (totalDayChangeAmount / marketValue) * 100;
        }
    }

    dayChangePercentEl.textContent = `${totalDayChangePercent >= 0 ? '+' : ''}${totalDayChangePercent.toFixed(2)}%`;
    dayChangePercentEl.className = `portfolio-card-value-large ${totalDayChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`;

    dayChangeAmountEl.textContent = `${totalDayChangeAmount >= 0 ? '+' : ''}$${Math.abs(totalDayChangeAmount).toFixed(2)}`;
    dayChangeAmountEl.className = `portfolio-card-value-medium ${totalDayChangeAmount >= 0 ? 'text-green-600' : 'text-red-600'}`;

    highestGainerSymbolEl.textContent = highestGainer.symbol;
    highestGainerPercentEl.textContent = `${highestGainer.percent !== -Infinity ? (highestGainer.percent >= 0 ? '+' : '') + highestGainer.percent.toFixed(2) + '%' : 'N/A'} Today`;
    highestGainerPercentEl.className = `portfolio-card-sub-text ${highestGainer.percent >= 0 ? 'text-green-600' : 'text-gray-600'}`; // Green for gainers

    looserStockSymbolEl.textContent = looserStock.symbol;
    looserStockPercentEl.textContent = `${looserStock.percent !== Infinity ? (looserStock.percent >= 0 ? '+' : '') + looserStock.percent.toFixed(2) + '%' : 'N/A'} Today`;
    looserStockPercentEl.className = `portfolio-card-sub-text ${looserStock.percent < 0 ? 'text-red-700' : 'text-gray-600'}`; // Red for loosers
}


// Event listener for portfolio selection dropdown
portfolioSelect.addEventListener('change', (event) => {
    const selectedName = event.target.value;
    if (selectedName) {
        filterAndRenderPortfolio(selectedName);
    } else {
        // If "No Portfolios Available" or empty option is selected
        updatePortfolioMetrics(null);
        renderHoldingsTable([]);
        drawHoldingsChart([]);
        updateDailyChanges([]);
    }
});

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    fetchUserPortfolios();
});