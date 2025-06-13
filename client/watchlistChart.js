// watchlistChart.js
// This file assumes it lives in your '../client' directory

async function loadWatchlistPieChart() {
    console.log("loadWatchlistPieChart function started.");

    const svg = document.getElementById('watchlistPieChart');
    console.log("Attempted to getElementById('watchlistPieChart'). Result:", svg);

    // --- CRITICAL CHECK ---
    if (!svg) {
        console.error("ERROR: SVG element with ID 'watchlistPieChart' not found in the DOM.");
        return; // Stop execution if SVG isn't found
    }

    const container = svg.parentElement;
    const width = container && container.clientWidth > 0 ? container.clientWidth : 400;
    const height = container && container.clientHeight > 0 ? container.clientHeight : 400;

    console.log(`Watchlist SVG dimensions: Width=${width}, Height=${height}`);

    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const radius = Math.min(width, height) / 2 * 0.75;
    const cx = width / 2;
    const cy = height / 2;

    try {
        console.log("Fetching watchlist stock counts...");
        // --- IMPORTANT: Ensure this URL is correct for your backend ---
        const backendUrl = 'http://localhost:5000'; // Adjust if your backend is on a different port/domain
        const token = localStorage.getItem('token'); // Get token from localStorage

        if (!token) {
            console.warn("No authentication token found. Cannot fetch watchlist data.");
            svg.innerHTML = "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'>Please log in to view watchlists.</text>";
            return;
        }

        const res = await fetch(`${backendUrl}/api/user-watchlist-counts`, { // <--- UPDATED URL
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error(`HTTP error fetching watchlist counts: Status ${res.status}, Response: ${errorText}`);
            if (res.status === 401) {
                svg.innerHTML = "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'>Authentication failed. Please log in again.</text>";
            } else {
                throw new Error(`HTTP error! Status: ${res.status} - ${errorText}`);
            }
            return;
        }

        const watchlistData = await res.json();
        console.log("Received watchlist data:", watchlistData);

        if (!watchlistData || watchlistData.length === 0 || watchlistData.every(item => item.stockCount === 0)) {
            console.warn("No stocks in watchlists or all watchlists are empty.");
            svg.innerHTML = "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'>No stocks in watchlists or no watchlists found.</text>";
            return;
        }

        const totalCount = watchlistData.reduce((acc, cur) => acc + cur.stockCount, 0);
        if (totalCount === 0) {
            console.warn("Total stock count in watchlists is zero.");
            svg.innerHTML = "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'>All watchlists are empty.</text>";
            return;
        }

        const colors = [
            '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
            '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ac',
            '#8b8b8b', '#c7c7c7'
        ];

        let cumulativeAngle = 0;
        svg.innerHTML = ''; // Clear previous content

        watchlistData.forEach((item, i) => {
            const sliceAngle = (item.stockCount / totalCount) * 2 * Math.PI;

            const x1 = cx + radius * Math.cos(cumulativeAngle);
            const y1 = cy + radius * Math.sin(cumulativeAngle);
            cumulativeAngle += sliceAngle;
            const x2 = cx + radius * Math.cos(cumulativeAngle);
            const y2 = cy + radius * Math.sin(cumulativeAngle);

            const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

            const pathData = [
                `M ${cx} ${cy}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                'Z'
            ].join(' ');

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute('d', pathData);
            path.setAttribute('fill', colors[i % colors.length]);
            path.setAttribute('stroke', '#fff');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('title', `${item.watchlistName}: ${item.stockCount} stocks`);
            svg.appendChild(path);

            const midAngle = cumulativeAngle - sliceAngle / 2;
            const labelRadius = radius * 0.85;
            const labelX = cx + labelRadius * Math.cos(midAngle);
            const labelY = cy + labelRadius * Math.sin(midAngle);

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute('x', labelX);
            text.setAttribute('y', labelY);
            text.setAttribute('fill', '#000');
            text.setAttribute('font-size', '12');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('alignment-baseline', 'middle');
            
            const percentage = (item.stockCount / totalCount * 100).toFixed(1);
            if (sliceAngle > 0.3) {
                text.textContent = `${item.watchlistName} (${percentage}%)`;
            } else {
                text.textContent = '';
            }
            svg.appendChild(text);
        });
        console.log("Watchlist pie chart drawn successfully.");

    } catch (error) {
        console.error('An error occurred during watchlist chart loading or drawing:', error);
        if (svg) {
            svg.innerHTML = `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#e15759'>Error: ${error.message}</text>`;
        } else {
            console.error("SVG element was null in catch block. Cannot display error message on chart.");
        }
    }
}

// Use DOMContentLoaded for faster execution once DOM is ready
document.addEventListener('DOMContentLoaded', loadWatchlistPieChart);