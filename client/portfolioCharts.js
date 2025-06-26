// portfolioCharts.js
// This file will be used by both portfolioStockCountChart.html and portfolioValueChart.html

const API_BASE_URL = window.location.origin; // Dynamically get the base URL

async function fetchPortfolioChartData() {
    const token = localStorage.getItem('token'); // Assuming token is stored in localStorage
    if (!token) {
        console.error("No authentication token found. Please log in.");
        // Redirect to login or show an error message on the page
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/portfolio-charts-data`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to fetch portfolio data: HTTP status ${response.status}`);
        }

        const data = await response.json();
        return data; // Returns { stockCounts: {}, currentValues: {} }
    } catch (error) {
        console.error("Error in fetchPortfolioChartData:", error);
        // Display error message in the chart canvas area
        const chartCanvas = document.getElementById('portfolioStockCountPieChart') || document.getElementById('portfolioValuePieChart');
        if (chartCanvas) {
            const ctx = chartCanvas.getContext('2d');
            ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
            ctx.font = "14px Arial";
            ctx.textAlign = "center";
            ctx.fillStyle = "red";
            ctx.fillText(`Error loading data: ${error.message}`, chartCanvas.width / 2, chartCanvas.height / 2);
        }
        return null;
    }
}

async function loadPortfolioStockCountChart() {
    const data = await fetchPortfolioChartData();
    if (!data) return;

    const portfolioNames = Object.keys(data.stockCounts);
    const stockQuantities = Object.values(data.stockCounts);

    const ctx = document.getElementById('portfolioStockCountPieChart').getContext('2d');

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: portfolioNames,
            datasets: [{
                data: stockQuantities,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)', // Red
                    'rgba(54, 162, 235, 0.7)', // Blue
                    'rgba(255, 206, 86, 0.7)', // Yellow
                    'rgba(75, 192, 192, 0.7)', // Green
                    'rgba(153, 102, 255, 0.7)',// Purple
                    'rgba(255, 159, 64, 0.7)'  // Orange
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Portfolio Wise Stock Holdings Count',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += context.parsed + ' stocks';
                            }
                            return label;
                        }
                    }
                },
                legend: {
                    position: 'right',
                }
            }
        }
    });
}

async function loadPortfolioValueChart() {
    const data = await fetchPortfolioChartData();
    if (!data) return;

    const portfolioNames = Object.keys(data.currentValues);
    const totalValues = Object.values(data.currentValues);

    const ctx = document.getElementById('portfolioValuePieChart').getContext('2d');

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: portfolioNames,
            datasets: [{
                data: totalValues,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)', // Red
                    'rgba(54, 162, 235, 0.7)', // Blue
                    'rgba(255, 206, 86, 0.7)', // Yellow
                    'rgba(75, 192, 192, 0.7)', // Green
                    'rgba(153, 102, 255, 0.7)',// Purple
                    'rgba(255, 159, 64, 0.7)'  // Orange
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Portfolio Wise Total Current Value',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += '$' + context.parsed.toFixed(2);
                            }
                            return label;
                        }
                    }
                },
                legend: {
                    position: 'right',
                }
            }
        }
    });
}