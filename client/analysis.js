// analysis.js
// This file assumes it lives in your '../client' directory

// Ensure API_BASE_URL is defined, consistent with Home.html
const API_BASE_URL = 'http://localhost:5000';

// Function to draw a generic D3.js pie chart (reusable for watchlist, portfolio stock count, and portfolio value)
function drawPieChart(svgElementId, data, valueKey, labelKey, title) {
    console.log(`drawPieChart function started for ${svgElementId}.`);
    const svg = document.getElementById(svgElementId);

    if (!svg) {
        console.error(`ERROR: SVG element with ID '${svgElementId}' not found in the DOM.`);
        return;
    }

    // Get dimensions from parent container for responsiveness
    const container = svg.parentElement;
    const width = container && container.clientWidth > 0 ? container.clientWidth : 400;
    const height = container && container.clientHeight > 0 ? container.clientHeight : 400;

    // Set SVG attributes
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    // svg.setAttribute('viewBox', `0 0 ${width} ${height}`); // Optional: D3 will handle transformation

    const radius = Math.min(width, height) / 2 - 20; // Adjusted radius to leave space for legend
    const cx = width / 2;
    const cy = height / 2;

    // Clear previous SVG content to prevent duplicates on redraws
    window.d3.select(svg).selectAll("*").remove();

    if (!data || data.length === 0) {
        window.d3.select(svg).append("text")
            .attr("x", "50%")
            .attr("y", "50%")
            .attr("dominant-baseline", "middle")
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("fill", "#666")
            .text(`No data found.`); // Simplified message as HTML heading provides context
        return;
    }

    // Calculate total sum for percentages, handle cases where values might be strings
    const total = data.reduce((sum, d) => sum + parseFloat(d[valueKey] || 0), 0);
    if (total === 0) {
        window.d3.select(svg).append("text")
            .attr("x", "50%")
            .attr("y", "50%")
            .attr("dominant-baseline", "middle")
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("fill", "#666")
            .text(`No significant data to display.`); // Simplified message
        return;
    }

    const pie = window.d3.pie()
        .value(d => parseFloat(d[valueKey]))
        .sort(null); // Keep the original order

    const arc = window.d3.arc()
        .innerRadius(0)
        .outerRadius(radius);

    const arcs = pie(data);

    const colors = window.d3.scaleOrdinal(window.d3.schemeCategory10); // Use a D3 color scheme

    const g = window.d3.select(svg)
        .append("g")
        .attr("transform", `translate(${cx},${cy})`);

    g.selectAll("path")
        .data(arcs)
        .enter()
        .append("path")
        .attr("d", arc)
        .attr("fill", (d, i) => colors(d.data[labelKey])) // Color based on the label property for consistency
        .attr("stroke", "#fff")
        .style("stroke-width", "1px");

    // Add labels for slices
    g.selectAll("text")
        .data(arcs)
        .enter()
        .append("text")
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .attr("text-anchor", "middle")
        .attr("fill", "#000") // Use black for better contrast
        .attr("font-size", "10px")
        .text(d => {
            const percentage = (parseFloat(d.data[valueKey]) / total * 100).toFixed(1);
            // Only show label if the slice is big enough
            return (d.endAngle - d.startAngle) > 0.1 ? `${d.data[labelKey]} (${percentage}%)` : '';
        });

    // --- REMOVED: D3.js generated title to avoid duplication with HTML <h1> heading ---
    // window.d3.select(svg).append("text")
    //     .attr("x", width / 2)
    //     .attr("y", 20)
    //     .attr("text-anchor", "middle")
    //     .attr("font-size", "16px")
    //     .attr("font-weight", "bold")
    //     .style("fill", "#333")
    //     .text(title);


    // Add a legend
    const legend = window.d3.select(svg).append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("text-anchor", "start")
        .selectAll("g")
        .data(data)
        .enter().append("g")
        .attr("transform", (d, i) => `translate(${width - 120},${i * 20 + 40})`); // Position legend on the right

    legend.append("rect")
        .attr("x", 0)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", (d, i) => colors(d[labelKey])); // Match colors using labelKey

    legend.append("text")
        .attr("x", 20)
        .attr("y", 9.5)
        .attr("dy", "0.32em")
        .text(d => d[labelKey]);

    console.log(`Chart drawn successfully for ${svgElementId}.`);
}


// --- 1. Watchlist Stock Count Pie Chart ---
async function loadWatchlistPieChart() {
    console.log("loadWatchlistPieChart function started.");
    const watchlistPieChartSvg = document.getElementById('watchlistPieChart');
    if (!watchlistPieChartSvg) {
        console.warn("Watchlist pie chart SVG element not found.");
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error("No authentication token found. Cannot fetch watchlist stock counts.");
            watchlistPieChartSvg.innerHTML = "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#e15759'>Authentication required.</text>";
            return;
        }

        console.log("Fetching watchlist stock counts...");
        const res = await fetch(`${API_BASE_URL}/api/user-watchlist-counts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const errorData = await res.text();
            console.error(`HTTP error fetching watchlist stock counts: Status ${res.status}, Response: ${errorData}`);
            throw new Error(`HTTP error! Status: ${res.status} - ${errorData}`);
        }
        const data = await res.json();
        console.log("Received watchlist data for pie chart:", data);

        if (window.d3) {
            // Title argument is now only for placeholder text if no data, not for SVG title
            drawPieChart("watchlistPieChart", data, "stockCount", "watchlistName", "Watchlist Stock Distribution");
        } else {
            console.warn("D3.js is not loaded. Cannot draw watchlist pie chart.");
            watchlistPieChartSvg.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#666">Chart requires D3.js</text>`;
        }
    } catch (error) {
        console.error("Error fetching or drawing watchlist pie chart:", error);
        if (watchlistPieChartSvg) {
            watchlistPieChartSvg.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#dc3545">Error loading chart: ${error.message}</text>`;
        }
    }
}


// --- 2. Portfolio Unique Stock Count Pie Chart (for individual portfolio distribution) ---
async function loadPortfolioStockCountChart() { // Retained original function name
    console.log("loadPortfolioStockCountChart function started.");
    const portfolioStockCountChartSvg = document.getElementById('portfolioStockCountChart');
    if (!portfolioStockCountChartSvg) {
        console.warn("Portfolio Stock Count SVG element not found.");
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error("No authentication token found. Cannot fetch portfolio unique stock counts.");
            portfolioStockCountChartSvg.innerHTML = "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#e15759'>Authentication required.</text>";
            return;
        }

        // Fetch data from the NEW endpoint specifically for unique stock counts
        const res = await fetch(`${API_BASE_URL}/api/portfolio/unique-stock-counts`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`HTTP error fetching portfolio unique stock counts: Status ${res.status}, Response: ${errorText}`);
            throw new Error(`HTTP error! Status: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        console.log("Received portfolio unique stock counts data from new endpoint:", data);

        // Transform data from object to array of objects for drawPieChart
        const transformedData = Object.keys(data).map(portfolioName => ({
            portfolioName: portfolioName,
            uniqueStockCount: data[portfolioName]
        }));
        console.log("Transformed portfolio unique stock counts data:", transformedData);


        if (window.d3) {
            // Pass the transformed data to drawPieChart
            drawPieChart("portfolioStockCountChart", transformedData, "uniqueStockCount", "portfolioName", "Portfolio Unique Stock Count");
        } else {
            console.warn("D3.js is not loaded. Cannot draw portfolio unique stock count chart.");
            portfolioStockCountChartSvg.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#666">Chart requires D3.js</text>`;
        }

    } catch (error) {
        console.error('An error occurred during portfolio unique stock count chart loading or drawing:', error);
        if (portfolioStockCountChartSvg) {
            portfolioStockCountChartSvg.innerHTML = `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#e15759'>Error: ${error.message}</text>`;
        }
    }
}

// --- 3. Portfolio Value Distribution Pie Chart ---
async function loadPortfolioValueChart() {
    console.log("loadPortfolioValueChart function started.");
    const portfolioValueChartSvg = document.getElementById('portfolioValueChart');
    if (!portfolioValueChartSvg) {
        console.warn("Portfolio Value SVG element not found.");
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error("No authentication token found. Cannot fetch portfolio total values.");
            portfolioValueChartSvg.innerHTML = "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#e15759'>Authentication required.</text>";
            return;
        }

        const res = await fetch(`${API_BASE_URL}/api/portfolio/total-values`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`HTTP error fetching portfolio total values: Status ${res.status}, Response: ${errorText}`);
            throw new Error(`HTTP error! Status: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        console.log("Received portfolio total values data:", data);

        // Transform data from object to array of objects for drawPieChart
        const transformedData = Object.keys(data).map(portfolioName => ({
            portfolioName: portfolioName,
            totalValue: data[portfolioName]
        }));
        console.log("Transformed portfolio total values data:", transformedData);


        if (window.d3) {
            // Pass the transformed data to drawPieChart
            drawPieChart("portfolioValueChart", transformedData, "totalValue", "portfolioName", "Portfolio Value Distribution");
        } else {
            console.warn("D3.js is not loaded. Cannot draw portfolio value chart.");
            portfolioValueChartSvg.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#666">Chart requires D3.js</text>`;
        }

    } catch (error) {
        console.error('An error occurred during portfolio value chart loading or drawing:', error);
        if (portfolioValueChartSvg) {
            portfolioValueChartSvg.innerHTML = `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#e15759'>Error: ${error.message}</text>`;
        }
    }
}


// --- 4. Sector Performance Pie Chart (Modified from Bar Chart) ---
async function loadSectorPerformancePieChart() { // Renamed function for clarity and modified to draw pie chart
    console.log("loadSectorPerformancePieChart function started.");
    const sectorChartSvg = document.getElementById('sectorChart');
    if (!sectorChartSvg) {
        console.error("ERROR: Sector performance SVG element with ID 'sectorChart' not found in the DOM.");
        return;
    }
    console.log("Sector performance SVG element found:", sectorChartSvg);

    // Clear previous SVG content to prevent duplicates on refresh
    window.d3.select(sectorChartSvg).selectAll("*").remove();

    try {
        if (!window.d3) {
            console.error("ERROR: D3.js is not loaded. Cannot fetch or draw sector performance pie chart.");
            sectorChartSvg.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#666">Chart requires D3.js to be loaded.</text>`;
            return;
        }
        console.log("D3.js is available.");

        console.log(`Fetching sector performance data from: ${API_BASE_URL}/api/sector-performance`);
        const res = await fetch(`${API_BASE_URL}/api/sector-performance`);
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error(`HTTP error fetching sector performance: Status ${res.status}, Response: ${errorText}`);
            sectorChartSvg.innerHTML = `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#e15759'>Error loading data: ${res.status} - ${errorText}</text>`;
            throw new Error(`HTTP error! Status: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        console.log("Received raw sector performance data:", data);

        // Ensure data.sectorPerformance exists and is an array
        const sectors = data.sectorPerformance;
        if (!sectors || !Array.isArray(sectors) || sectors.length === 0) {
            console.warn("No sector performance data found in API response, or unexpected format. Displaying placeholder.");
            sectorChartSvg.innerHTML = "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='16' fill='#666'>No sector performance data found.</text>";
            return;
        }

        // Process data for pie chart: use absolute value of changesPercentage for magnitude
        // and filter out sectors with zero or negative magnitude to ensure valid pie slices
        const processedData = sectors
            .map(d => ({
                sector: d.sector,
                absChangesPercentage: Math.abs(parseFloat(d.changesPercentage) || 0) // Ensure it's a number and non-negative
            }))
            .filter(d => d.absChangesPercentage > 0); // Only include sectors with a positive magnitude

        console.log("Processed data for pie chart:", processedData);

        if (processedData.length === 0) {
            console.warn("No meaningful sector performance data (non-zero magnitude) after processing. Displaying placeholder.");
            sectorChartSvg.innerHTML = "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='16' fill='#666'>No meaningful sector performance data to display.</text>";
            return;
        }

        // Call the generic pie chart function to draw the pie chart
        drawPieChart("sectorChart", processedData, "absChangesPercentage", "sector", "Sector Performance Distribution (by Magnitude)");
        console.log("Sector performance pie chart drawn successfully.");

    } catch (error) {
        console.error('An error occurred during sector performance chart loading or drawing:', error);
        if (sectorChartSvg) {
            sectorChartSvg.innerHTML = `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#e15759'>Error: ${error.message}</text>`;
        } else {
            console.error("SVG element was null in catch block. Cannot display error message on chart.");
        }
    }
}


// --- New function to load total unique stocks for the logged-in user ---
async function loadUserTotalUniqueStocksCount() {
    console.log("loadUserTotalUniqueStocksCount function started.");
    const totalUniqueStocksElement = document.getElementById('userTotalUniqueStocksCount'); // Assuming an element with this ID exists

    if (!totalUniqueStocksElement) {
        console.warn("Element with ID 'userTotalUniqueStocksCount' not found. Cannot display total unique stocks.");
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error("No authentication token found. Cannot fetch user's total unique stocks.");
            totalUniqueStocksElement.textContent = "N/A (Login required)";
            return;
        }

        const res = await fetch(`${API_BASE_URL}/api/user/total-unique-stocks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`HTTP error fetching user's total unique stocks: Status ${res.status}, Response: ${errorText}`);
            throw new Error(`HTTP error! Status: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        console.log("Received user's total unique stocks data:", data);

        if (data && typeof data.totalUniqueStocks === 'number') {
            totalUniqueStocksElement.textContent = data.totalUniqueStocks;
        } else {
            totalUniqueStocksElement.textContent = "N/A";
            console.warn("Unexpected data format for user's total unique stocks:", data);
        }

    } catch (error) {
        console.error('An error occurred during loading user\'s total unique stocks:', error);
        if (totalUniqueStocksElement) {
            totalUniqueStocksElement.textContent = `Error: ${error.message}`;
        }
    }
}


// Expose functions globally so they can be called from other HTML files (e.g., via iframes)
window.loadWatchlistPieChart = loadWatchlistPieChart;
window.loadPortfolioStockCountChart = loadPortfolioStockCountChart;
window.loadPortfolioValueChart = loadPortfolioValueChart;
window.loadSectorPerformancePieChart = loadSectorPerformancePieChart; // Exposed as pie chart now
window.loadUserTotalUniqueStocksCount = loadUserTotalUniqueStocksCount; // Expose the new function
