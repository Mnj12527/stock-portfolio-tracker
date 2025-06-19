const API_BASE_URL = 'http://localhost:5000'; // Ensure this matches your server.js port

// Element references
const dynamicContent = document.getElementById('dynamicContent');
const totalUsersStat = document.getElementById('totalUsersStat');
const totalBuyingStat = document.getElementById('totalBuyingStat');
const totalSellingStat = document.getElementById('totalSellingStat');
const totalStocksStat = document.getElementById('totalStocksStat');

// Sidebar navigation links
const dashboardLink = document.getElementById('dashboardLink');
const userProfilesLink = document.getElementById('userProfilesLink');
const demandingStocksLink = document.getElementById('demandingStocksLink');
const totalPortfolioValuesLink = document.getElementById('totalPortfolioValuesLink');
const totalReturnsLink = document.getElementById('totalReturnsLink');
const stockPerformanceLink = document.getElementById('stockPerformanceLink');
const logoutLink = document.getElementById('logoutLink'); // NEW: Logout link reference

let userAuthToken = localStorage.getItem('token'); // Get auth token from local storage

// Utility function to display messages instead of alert
function showMessage(message, type = 'info') {
    const messageContainer = document.createElement('div');
    messageContainer.className = `message-box ${type}`; // Add styling for different types (info, error, success)
    messageContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        background-color: #333;
        color: white;
        animation: fadeOut 5s forwards;
    `;
    messageContainer.textContent = message;

    document.body.appendChild(messageContainer);

    setTimeout(() => {
        messageContainer.remove();
    }, 4000); // Message disappears after 4 seconds
}

// Keyframes for fadeOut animation (add this to your CSS or use a style tag in HTML)
// @keyframes fadeOut {
//     from { opacity: 1; transform: translateY(0); }
//     to { opacity: 0; transform: translateY(-20px); }
// }


// Function to highlight active sidebar link
function highlightActiveLink(activeLinkElement) {
    const allLinks = document.querySelectorAll('.sidebar ul li a');
    allLinks.forEach(link => link.classList.remove('active'));
    if (activeLinkElement) {
        activeLinkElement.classList.add('active');
    }
}

// Function to fetch and update dashboard stats
async function updateDashboardStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/dashboard-stats`, {
            headers: { 'Authorization': `Bearer ${userAuthToken}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch dashboard stats.');
        }
        const stats = await response.json();

        totalUsersStat.textContent = stats.totalUsers.toLocaleString();
        totalBuyingStat.textContent = `$${stats.totalBuyingValue.toFixed(2)}`;
        totalSellingStat.textContent = `$${stats.totalSellingValue.toFixed(2)}`;
        totalStocksStat.textContent = stats.totalStocksCount.toLocaleString();

    } catch (error) {
        console.error("Error updating dashboard stats:", error);
        totalUsersStat.textContent = 'N/A';
        totalBuyingStat.textContent = 'N/A';
        totalSellingStat.textContent = 'N/A';
        totalStocksStat.textContent = 'N/A';
        showMessage(`Error loading stats: ${error.message}`, 'error');
    }
}

// --- Dashboard (Recent Activities) ---
async function loadDashboard() {
    highlightActiveLink(dashboardLink);
    dynamicContent.innerHTML = '<h2>Recent Activities</h2><p>Loading recent activities...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/recent-activities`, {
            headers: { 'Authorization': `Bearer ${userAuthToken}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch recent activities.');
        }
        const activities = await response.json();

        let activitiesHtml = '<h2>Recent Activities</h2>';
        if (activities.length === 0) {
            activitiesHtml += '<p>No recent activities found.</p>';
        } else {
            activitiesHtml += `
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>User</th>
                            <th>Activity Type</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            activities.forEach(activity => {
                const date = new Date(activity.date).toLocaleString();
                activitiesHtml += `
                    <tr>
                        <td>${date}</td>
                        <td>${activity.username}</td>
                        <td>${activity.type.replace(/_/g, ' ')}</td>
                        <td>${activity.description}</td>
                    </tr>
                `;
            });
            activitiesHtml += `</tbody></table>`;
        }
        dynamicContent.innerHTML = activitiesHtml;

    } catch (error) {
        console.error("Error loading dashboard activities:", error);
        dynamicContent.innerHTML = `<h2>Recent Activities</h2><p class="error-message">Failed to load recent activities: ${error.message}</p>`;
        showMessage(`Error loading activities: ${error.message}`, 'error');
    }
}

// --- User Profiles-Charts ---
let userGrowthChart; // Chart.js instance for user growth

async function loadUserProfilesAndCharts() {
    highlightActiveLink(userProfilesLink);
    dynamicContent.innerHTML = `
        <h2>User Growth Over Time</h2>
        <div class="chart-container">
            <canvas id="userGrowthChart"></canvas>
        </div>
        <h2>All User Profiles</h2>
        <p>Loading user data...</p>
    `;

    try {
        // Fetch user growth data
        const growthResponse = await fetch(`${API_BASE_URL}/api/admin/user-growth`, {
            headers: { 'Authorization': `Bearer ${userAuthToken}` }
        });
        if (!growthResponse.ok) {
            const errorData = await growthResponse.json();
            throw new Error(errorData.message || 'Failed to fetch user growth data.');
        }
        const userGrowthData = await growthResponse.json();

        // Process growth data for Chart.js
        const labels = userGrowthData.map(d => new Date(d.date).toLocaleDateString());
        const data = userGrowthData.map(d => d.count);

        const ctx = document.getElementById('userGrowthChart').getContext('2d');
        if (userGrowthChart) {
            userGrowthChart.destroy(); // Destroy previous chart instance
        }
        userGrowthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'New Users',
                    data: data,
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79, 70, 229, 0.2)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Users'
                        }
                    }
                }
            }
        });

        // Fetch all user profiles
        const usersResponse = await fetch(`${API_BASE_URL}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${userAuthToken}` }
        });
        if (!usersResponse.ok) {
            const errorData = await usersResponse.json();
            throw new Error(errorData.message || 'Failed to fetch user profiles.');
        }
        const users = await usersResponse.json();

        let usersHtml = `<h2>All User Profiles</h2>`;
        if (users.length === 0) {
            usersHtml += '<p>No user profiles found.</p>';
        } else {
            usersHtml += `
                <table>
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Mobile</th>
                            <th>Address</th>
                            <th>Profession</th>
                            <th>Role</th>
                            <th>Account Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            users.forEach(user => {
                const createdAtDate = new Date(user.createdAt).toLocaleString();
                usersHtml += `
                    <tr>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>${user.mobileNumber || 'N/A'}</td>
                        <td>${user.address || 'N/A'}</td>
                        <td>${user.profession || 'N/A'}</td>
                        <td>${user.role}</td>
                        <td>${createdAtDate}</td>
                        <td><button class="minus-btn" data-user-id="${user._id}" data-username="${user.username}">−</button></td>
                    </tr>
                `;
            });
            usersHtml += `</tbody></table>`;
        }
        // This ensures the chart HTML is not overwritten
        const chartContainerHtml = document.getElementById('dynamicContent').querySelector('.chart-container')?.outerHTML || '';
        document.getElementById('dynamicContent').innerHTML = `<h2>User Growth Over Time</h2>${chartContainerHtml}` + usersHtml;


        // Attach event listeners to delete buttons
        document.querySelectorAll('.minus-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const userId = event.target.dataset.userId;
                const username = event.target.dataset.username;
                // Replace with custom confirmation modal later
                // For now, using a simple prompt for confirmation
                const confirmed = prompt(`Are you sure you want to delete user '${username}'? Type 'DELETE' to confirm.`);
                if (confirmed === 'DELETE') {
                    await deleteUser(userId);
                } else if (confirmed !== null) { // If user typed something but not 'DELETE'
                    showMessage("Deletion cancelled. Please type 'DELETE' to confirm.", 'info');
                }
            });
        });

    } catch (error) {
        console.error("Error loading user profiles/charts:", error);
        dynamicContent.innerHTML = `
            <h2>User Growth Over Time</h2>
            <p class="error-message">Failed to load user growth chart: ${error.message}</p>
            <h2>All User Profiles</h2>
            <p class="error-message">Failed to load user profiles: ${error.message}</p>
        `;
        showMessage(`Error loading user data: ${error.message}`, 'error');
    }
}

async function deleteUser(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/delete-user/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${userAuthToken}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete user.');
        }

        const result = await response.json();
        showMessage(result.message, 'success');
        loadUserProfilesAndCharts(); // Reload the user list
        updateDashboardStats(); // Update stats as user count might change
    } catch (error) {
        console.error("Error deleting user:", error);
        showMessage(`Error deleting user: ${error.message}`, 'error');
    }
}

// --- Demanding Stocks ---
async function loadDemandingStocks() {
    highlightActiveLink(demandingStocksLink);
    dynamicContent.innerHTML = '<h2>Demanding Stocks</h2><p>Loading demanding stocks...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/demanding-stocks`, {
            headers: { 'Authorization': `Bearer ${userAuthToken}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch demanding stocks.');
        }
        const stocks = await response.json();

        let stocksHtml = '<h2>Demanding Stocks (in Watchlists)</h2>';
        if (stocks.length === 0) {
            stocksHtml += '<p>No stocks found in user watchlists.</p>';
        } else {
            stocksHtml += `
                <table>
                    <thead>
                        <tr>
                            <th>Stock Symbol</th>
                            <th>Times Added to Watchlist</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            stocks.forEach(stock => {
                stocksHtml += `
                    <tr>
                        <td>${stock.symbol}</td>
                        <td>${stock.count}</td>
                    </tr>
                `;
            });
            stocksHtml += `</tbody></table>`;
        }
        dynamicContent.innerHTML = stocksHtml;

    } catch (error) {
        console.error("Error loading demanding stocks:", error);
        dynamicContent.innerHTML = `<h2>Demanding Stocks</h2><p class="error-message">Failed to load demanding stocks: ${error.message}</p>`;
        showMessage(`Error loading demanding stocks: ${error.message}`, 'error');
    }
}

// --- Total Portfolio Values ---
async function loadTotalPortfolioValues() {
    highlightActiveLink(totalPortfolioValuesLink);
    dynamicContent.innerHTML = '<h2>Total Portfolio Values by User</h2><p>Loading portfolio values...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/total-portfolio-values`, {
            headers: { 'Authorization': `Bearer ${userAuthToken}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch total portfolio values.');
        }
        const portfolioValues = await response.json();

        let valuesHtml = '<h2>Total Portfolio Values by User</h2>';
        if (portfolioValues.length === 0) {
            valuesHtml += '<p>No portfolio data found.</p>';
        } else {
            valuesHtml += `
                <table>
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Total Portfolio Value</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            portfolioValues.forEach(item => {
                valuesHtml += `
                    <tr>
                        <td>${item.username}</td>
                        <td>$${item.totalPortfolioValue.toFixed(2)}</td>
                    </tr>
                `;
            });
            valuesHtml += `</tbody></table>`;
        }
        dynamicContent.innerHTML = valuesHtml;

    } catch (error) {
        console.error("Error loading total portfolio values:", error);
        dynamicContent.innerHTML = `<h2>Total Portfolio Values by User</h2><p class="error-message">Failed to load total portfolio values: ${error.message}</p>`;
        showMessage(`Error loading portfolio values: ${error.message}`, 'error');
    }
}

// --- Total Returns ---
async function loadTotalReturns() {
    highlightActiveLink(totalReturnsLink);
    dynamicContent.innerHTML = '<h2>Total Realized Returns by User</h2><p>Loading total returns...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/total-returns`, {
            headers: { 'Authorization': `Bearer ${userAuthToken}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch total returns.');
        }
        const returns = await response.json();

        let returnsHtml = '<h2>Total Realized Returns by User</h2>';
        if (returns.length === 0) {
            returnsHtml += '<p>No realized returns data found.</p>';
        } else {
            returnsHtml += `
                <table>
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Total Realized Gain/Loss</th>
                            <th>Percentage Gain/Loss</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            returns.forEach(item => {
                const gainLossClass = item.totalRealizedGainLoss >= 0 ? 'text-green-600' : 'text-red-700'; // Assuming you have these Tailwind-like classes
                returnsHtml += `
                    <tr>
                        <td>${item.username}</td>
                        <td class="${gainLossClass}">$${item.totalRealizedGainLoss.toFixed(2)}</td>
                        <td class="${gainLossClass}">${item.percentageGainLoss >= 0 ? '+' : ''}${item.percentageGainLoss.toFixed(2)}%</td>
                    </tr>
                `;
            });
            returnsHtml += `</tbody></table>`;
        }
        dynamicContent.innerHTML = returnsHtml;

    } catch (error) {
        console.error("Error loading total returns:", error);
        dynamicContent.innerHTML = `<h2>Total Realized Returns by User</h2><p class="error-message">Failed to load total returns: ${error.message}</p>`;
        showMessage(`Error loading total returns: ${error.message}`, 'error');
    }
}

// --- Performance of the Stocks ---
async function loadStockPerformance() {
    highlightActiveLink(stockPerformanceLink);
    dynamicContent.innerHTML = '<h2>Performance of All Stocks Across Portfolios</h2><p>Loading stock performance data...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/stock-performance`, {
            headers: { 'Authorization': `Bearer ${userAuthToken}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch stock performance data.');
        }
        const stocks = await response.json();

        let stocksHtml = '<h2>Performance of All Stocks Across Portfolios</h2>';
        if (stocks.length === 0) {
            stocksHtml += '<p>No stock performance data available.</p>';
        } else {
            stocksHtml += `
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Symbol</th>
                            <th>Company Name</th>
                            <th>Quantity</th>
                            <th>Buying Price</th>
                            <th>Current Price</th>
                            <th>Gain/Loss ($)</th>
                            <th>Gain/Loss (%)</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            stocks.forEach(stock => {
                const gainLossClass = stock.gainLossValue >= 0 ? 'text-green-600' : 'text-red-700'; // Assuming your CSS has these
                stocksHtml += `
                    <tr>
                        <td>${stock.username}</td>
                        <td>${stock.symbol}</td>
                        <td>${stock.companyName}</td>
                        <td>${stock.quantity}</td>
                        <td>$${stock.buyingPrice.toFixed(2)}</td>
                        <td>$${stock.currentPrice.toFixed(2)}</td>
                        <td class="${gainLossClass}">${stock.gainLossValue >= 0 ? '+' : ''}$${stock.gainLossValue.toFixed(2)}</td>
                        <td class="${gainLossClass}">${stock.gainLossPercent >= 0 ? '+' : ''}${stock.gainLossPercent.toFixed(2)}%</td>
                    </tr>
                `;
            });
            stocksHtml += `</tbody></table>`;
        }
        dynamicContent.innerHTML = stocksHtml;

    } catch (error) {
        console.error("Error loading stock performance:", error);
        dynamicContent.innerHTML = `<h2>Performance of All Stocks Across Portfolios</h2><p class="error-message">Failed to load stock performance data: ${error.message}</p>`;
        showMessage(`Error loading stock performance: ${error.message}`, 'error');
    }
}

// --- Logout Functionality ---
function performLogout() {
    localStorage.removeItem('token');     // Remove the authentication token
    localStorage.removeItem('username');  // Remove username if stored
    localStorage.removeItem('userRole');  // Remove user role if stored
    showMessage("Logged out successfully!", 'info');
    // Redirect to your login page or home page
    window.location.href = 'index.html'; // Assuming index.html is your login/landing page
}


// --- Event Listeners ---
document.getElementById("startBtn").addEventListener("click", () => {
    showMessage("Welcome to the Admin Dashboard!", 'info');
});

document.getElementById("goToHomePageBtn").addEventListener("click", () => {
    window.location.href = "Home.html";
});

// Sidebar click handlers
dashboardLink.addEventListener('click', (e) => { e.preventDefault(); loadDashboard(); });
userProfilesLink.addEventListener('click', (e) => { e.preventDefault(); loadUserProfilesAndCharts(); });
demandingStocksLink.addEventListener('click', (e) => { e.preventDefault(); loadDemandingStocks(); });
totalPortfolioValuesLink.addEventListener('click', (e) => { e.preventDefault(); loadTotalPortfolioValues(); });
totalReturnsLink.addEventListener('click', (e) => { e.preventDefault(); loadTotalReturns(); });
stockPerformanceLink.addEventListener('click', (e) => { e.preventDefault(); loadStockPerformance(); });
logoutLink.addEventListener('click', (e) => { e.preventDefault(); performLogout(); }); // NEW: Logout event listener


// Initial load
document.addEventListener("DOMContentLoaded", () => {
    // Check admin role is handled in admin.html script section
    // If admin, load default dashboard content and update stats
    const userRole = localStorage.getItem("userRole");
    if (userRole === 'admin') {
        updateDashboardStats(); // Load initial stats
        loadDashboard(); // Load default content for dashboard
    } else {
        // If not admin, ensure they are redirected as per the script in admin.html
        // No action needed here, as the HTML script already handles redirection.
    }
});

