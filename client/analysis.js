// analysis.js
// This file assumes it lives in your '../client' directory

async function loadSectorPerformance() {
    console.log("loadSectorPerformance function started.");

    const svg = document.getElementById('sectorChart');
    console.log("Attempted to getElementById('sectorChart'). Result:", svg);

    // --- CRITICAL CHECK ---
    if (!svg) {
        console.error("ERROR: SVG element with ID 'sectorChart' not found in the DOM.");
        // If the SVG element is not found, we cannot proceed. Display a message directly if possible,
        // or ensure the iframe's HTML body itself has a fallback message.
        // For debugging, we'll try to alert parent frame if accessible, but mostly rely on console.
        return; // Stop execution if SVG isn't found
    }

    // Now that we've confirmed `svg` is not null, get dimensions
    const container = svg.parentElement;
    // Provide sensible defaults if container or its dimensions aren't available
    const width = container && container.clientWidth > 0 ? container.clientWidth : 400;
    const height = container && container.clientHeight > 0 ? container.clientHeight : 400;

    console.log(`SVG dimensions: Width=${width}, Height=${height}`);

    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const radius = Math.min(width, height) / 2 - 20;
    const cx = width / 2;
    const cy = height / 2;

    try {
        console.log("Fetching sector performance data...");
        // --- IMPORTANT: Ensure this URL is correct for your backend ---
        const backendUrl = 'http://localhost:5000'; // Adjust if your backend is on a different port/domain
        const res = await fetch(`${backendUrl}/api/sector-performance`); 
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error(`HTTP error fetching sector performance: Status ${res.status}, Response: ${errorText}`);
            throw new Error(`HTTP error! Status: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        console.log("Received sector performance data:", data);

        const sectors = data.sectorPerformance;
        if (!sectors || sectors.length === 0) {
            console.warn("No sector performance data found in API response.");
            svg.innerHTML = "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'>No sector performance data found.</text>";
            return;
        }

        const totalChange = sectors.reduce((acc, cur) => acc + Math.abs(parseFloat(cur.changesPercentage)), 0);
        if (totalChange === 0) {
            console.warn("Total change is zero. No significant sector changes to display.");
            svg.innerHTML = "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'>No significant sector changes to display.</text>";
            return;
        }

        const colors = [
            '#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0',
            '#9966ff', '#ff9f40', '#e7e9ed', '#8e5ea2', '#3cba9f',
            '#6a3d9a', '#b15928', '#a6cee3', '#1f78b4', '#b2df8a'
        ];

        let cumulativeAngle = 0;
        svg.innerHTML = ''; // Clear previous content

        sectors.forEach((sector, i) => {
            const value = Math.abs(parseFloat(sector.changesPercentage));
            const sliceAngle = (value / totalChange) * 2 * Math.PI;

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
            path.setAttribute('title', `${sector.sector}: ${sector.changesPercentage}`);
            svg.appendChild(path);

            const midAngle = cumulativeAngle - sliceAngle / 2;
            const labelRadius = radius * 0.75;
            const labelX = cx + labelRadius * Math.cos(midAngle);
            const labelY = cy + labelRadius * Math.sin(midAngle);

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute('x', labelX);
            text.setAttribute('y', labelY);
            text.setAttribute('fill', '#000');
            text.setAttribute('font-size', '12');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('alignment-baseline', 'middle');
            
            if (sliceAngle > 0.3) { // Only show label for larger slices
                text.textContent = sector.sector;
            } else {
                text.textContent = '';
            }
            svg.appendChild(text);
        });
        console.log("Sector performance chart drawn successfully.");

    } catch (error) {
        console.error('An error occurred during sector performance chart loading or drawing:', error);
        // Ensure svg is still a valid element before trying to modify its innerHTML in catch
        if (svg) {
            svg.innerHTML = `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#e15759'>Error: ${error.message}</text>`;
        } else {
            console.error("SVG element was null in catch block. Cannot display error message on chart.");
        }
    }
}

// Use DOMContentLoaded instead of window.onload for faster execution once DOM is ready
// This is often more reliable for scripts embedded in iframes.
document.addEventListener('DOMContentLoaded', loadSectorPerformance);