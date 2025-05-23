// Global variables
let watchlists = [[], [], []]; // Initialize an empty watchlist array
let currentWatchlist = 0;
let authToken = localStorage.getItem('token'); // Get the token
const API_BASE_URL = 'http://localhost:5000'; // Your backend API for user watchlists
const STOCK_API_BACKEND_URL = 'http://localhost:3000'; // Your backend for stock data (assuming a separate service)

// --- Video Elements (from original index.html script) ---
let videoContainer;
let searchInput;
let searchButton;
let loadingIndicator; // General loading indicator for videos
let errorMessageDisplay; // General error message display for videos

// --- News Elements (from original index.html script) ---
let newsContainer;
let newsErrorMessageDiv;
let newsLoadingIndicatorElement;

// --- Watchlist Elements (from myportfolio.html) ---
let stockInput;
let addStockButton;
let watchlistDisplay;
let watchlistError;
let watchlistLoading;
let currentWatchlistNumber;

// --- Helper Functions ---
function showElement(element) {
    if (element) element.classList.remove('hidden');
}

function hideElement(element) {
    if (element) element.classList.add('hidden');
}

function displayErrorMessage(element, message) {
    if (element) {
        element.textContent = message;
        showElement(element);
    }
}

function clearErrorMessage(element) {
    if (element) {
        element.textContent = '';
        hideElement(element);
    }
}

// --- Video Functions ---
function initializeVideoElements() {
    videoContainer = document.getElementById('video-container');
    searchInput = document.getElementById('search-input');
    searchButton = document.getElementById('search-button');
    loadingIndicator = document.getElementById('loading-indicator');
    errorMessageDisplay = document.getElementById('error-message');

    if (videoContainer && searchInput && searchButton && loadingIndicator && errorMessageDisplay) {
        fetchVideos('Indian stock market'); // Initial load

        searchButton.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                fetchVideos(query);
            } else {
                alert('Please enter a search query.');
            }
        });

        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                searchButton.click();
            }
        });
    } else {
        console.error("Video elements not found after loading Videos.html");
    }
}

async function fetchVideos(query) {
    showElement(loadingIndicator);
    clearErrorMessage(errorMessageDisplay);
    try {
        const response = await fetch(`${API_BASE_URL}/search?query=${query}`); // This URL suggests your backend handles YouTube API
        if (!response.ok) {
            let message = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.error) {
                    message += ` - ${errorData.error}`;
                }
            } catch (parseError) {
                console.error("Error parsing error response:", parseError);
            }
            throw new Error(message);
        }
        const videos = await response.json();
        hideElement(loadingIndicator);
        displayVideos(videos);
    } catch (error) {
        hideElement(loadingIndicator);
        console.error('Error fetching videos:', error);
        displayErrorMessage(errorMessageDisplay, `Failed to fetch videos: ${error.message}. Please check your network connection and try again.`);
    }
}

function displayVideos(videos) {
    if (!videoContainer) return;
    videoContainer.innerHTML = ''; // Clear previous videos
    if (videos.length === 0) {
        displayErrorMessage(errorMessageDisplay, 'No videos found for your search query.');
        return;
    }

    videos.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.classList.add('video-card');

        // Ensure video.id is correct for YouTube URL
        const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`; // Correct YouTube URL

        videoCard.innerHTML = `
            <div class="video-thumbnail-container">
                <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
                <a href="${youtubeUrl}" target="_blank" class="play-icon-overlay">
                    ▶
                </a>
            </div>
            <div class="video-details">
                <a href="${youtubeUrl}" target="_blank" class="video-title">
                    ${video.title}
                </a>
                <p class="video-description">${video.description}</p>
            </div>
        `;
        videoContainer.appendChild(videoCard);
    });
}

// --- News Functions ---
async function fetchStockNews() {
    const API_KEY = 'YOUR_NEWS_API_KEY'; // Replace with your actual NewsAPI.org API key
    const BASE_URL = 'https://newsapi.org/v2';
    const query = 'stock market';
    const pageSize = '10';
    const apiUrl = `${BASE_URL}/everything?q=${encodeURIComponent(query)}&pageSize=${pageSize}&sortBy=publishedAt&apiKey=${API_KEY}`;

    newsContainer.innerHTML = ''; // Clear previous news
    clearErrorMessage(newsErrorMessageDiv);
    showElement(newsLoadingIndicatorElement);

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data && data.articles && data.articles.length > 0) {
            data.articles.forEach(article => {
                const articleDiv = document.createElement('div');
                articleDiv.classList.add('article');
                articleDiv.innerHTML = `
                    <h3><a href="${article.url}" target="_blank">${article.title}</a></h3>
                    <p>${article.description || article.content || 'No description available.'}</p>
                    <small>Published: ${new Date(article.publishedAt).toLocaleString()} Source: ${article.source.name || 'Unknown'}</small>
                `;
                newsContainer.appendChild(articleDiv);
            });
        } else {
            newsContainer.textContent = 'No stock market news found.';
        }
    } catch (error) {
        console.error('Error fetching news:', error);
        displayErrorMessage(newsErrorMessageDiv, `Failed to load news: ${error.message}`);
    } finally {
        hideElement(newsLoadingIndicatorElement);
    }
}

// --- Dynamic Page Loading Function ---
function loadPage(page) {
    const url = `http://localhost:5000/${page}`; // Assuming your backend serves these static files
    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error("Page not found");
            return res.text();
        })
        .then(html => {
            document.getElementById("content").innerHTML = html;
            window.scrollTo({ top: 0, behavior: "smooth" });

            if (page === 'myportfolio.html') {
                // Initialize portfolio-specific elements and data after content is loaded
                stockInput = document.getElementById("stockInput");
                addStockButton = document.getElementById("addStockButton");
                watchlistDisplay = document.getElementById("watchlistDisplay");
                watchlistError = document.getElementById("watchlistError");
                watchlistLoading = document.getElementById("watchlistLoading");
                currentWatchlistNumber = document.getElementById("currentWatchlistNumber");

                // Attach event listeners for dynamically loaded elements
                if (addStockButton) {
                    addStockButton.addEventListener('click', addStock);
                }
                if (stockInput) {
                    stockInput.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter') {
                            addStockButton.click();
                        }
                    });
                }

                // Initial fetch and render for watchlists
                fetchWatchlistsFromServer();
                highlightActiveButton(currentWatchlist);

            } else if (page === 'Videos.html') {
                // The `myportfolio.html` script block would have already attached listeners
                // For videos, the elements are directly in the loaded HTML
                videoContainer = document.getElementById('video-container');
                searchInput = document.getElementById('search-input');
                searchButton = document.getElementById('search-button');
                loadingIndicator = document.getElementById('loading-indicator');
                errorMessageDisplay = document.getElementById('error-message');
                initializeVideoElements(); // Call the initialization for video elements
            } else if (page === 'News.html') {
                // Set up elements and fetch news for News.html
                newsContainer = document.createElement('div');
                newsContainer.id = 'news-container';

                newsLoadingIndicatorElement = document.createElement('p');
                newsLoadingIndicatorElement.className = 'loading-indicator animate-spin';
                newsLoadingIndicatorElement.textContent = 'Loading news...';
                newsContainer.appendChild(newsLoadingIndicatorElement);

                newsErrorMessageDiv = document.createElement('p');
                newsErrorMessageDiv.id = 'error-message';
                newsErrorMessageDiv.className = 'error-message hidden';

                document.getElementById('content').innerHTML = ''; // Clear previous content
                document.getElementById('content').appendChild(newsContainer);
                document.getElementById('content').appendChild(newsErrorMessageDiv);

                fetchStockNews();
            }
        })
        .catch(error => {
            console.error("Error loading page:", error);
            document.getElementById("content").innerHTML = `<p class="error-message">Error loading page: ${error.message}</p>`;
        });
}

// --- Auth Function ---
function signOut() {
    localStorage.removeItem("token");
    alert("You have been signed out.");
    watchlists = [[], [], []]; // Clear client-side watchlists on sign out
    window.location.href = "index.html"; // Redirect to login/homepage
}

// --- Watchlist Functions (Adapted from your script.js) ---

function switchWatchlist(index) {
    currentWatchlist = index;
    if (currentWatchlistNumber) {
        currentWatchlistNumber.textContent = index + 1; // Update watchlist number display
    }
    renderWatchlist();
    highlightActiveButton(index);
}

async function addStock() {
    if (!stockInput) return; // Ensure element exists
    const symbol = stockInput.value.trim().toUpperCase();
    if (symbol) {
        // Check if stock already exists in the current watchlist to prevent duplicates
        if (watchlists[currentWatchlist].includes(symbol)) {
            displayErrorMessage(watchlistError, `Stock '${symbol}' is already in this watchlist.`);
            return;
        }
        clearErrorMessage(watchlistError); // Clear previous errors

        // Add to the local array immediately for responsiveness
        watchlists[currentWatchlist].push(symbol);
        renderWatchlist(); // Re-render to show the new stock as "Loading..."

        try {
            // Attempt to save to the backend
            await saveWatchlistsToServer();
            stockInput.value = ""; // Clear input only on successful save
        } catch (error) {
            console.error("Error saving stock to server:", error);
            // If saving fails, remove it from the local array
            watchlists[currentWatchlist] = watchlists[currentWatchlist].filter(s => s !== symbol);
            renderWatchlist(); // Re-render to remove the failed stock
            displayErrorMessage(watchlistError, `Failed to add '${symbol}'. Please try again.`);
        }
    } else {
        displayErrorMessage(watchlistError, 'Please enter a stock symbol.');
    }
}

async function renderWatchlist() {
    if (!watchlistDisplay) return; // Ensure element exists
    watchlistDisplay.innerHTML = "";
    clearErrorMessage(watchlistError);
    if (watchlists[currentWatchlist].length === 0) {
        watchlistDisplay.innerHTML = "<li class='empty'>No stocks in this watchlist.</li>";
        hideElement(watchlistLoading);
        return;
    }

    const currentStocks = watchlists[currentWatchlist];
    showElement(watchlistLoading); // Show loading only for the watchlist
    const promises = currentStocks.map(async (symbol) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <div class="stock-info">
                <span class="stock-symbol">${symbol}</span>: <span class="stock-price" id="price-${symbol}">Loading...</span>
            </div>
            <button class="refresh-btn" data-symbol="${symbol}">Refresh</button>
            <button class="remove-btn" data-symbol="${symbol}">Remove</button>
        `;
        // Add event listener for refresh button
        const refreshButton = li.querySelector('.refresh-btn');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => fetchLivePrice(symbol));
        }

        // Add event listener for remove button
        const removeButton = li.querySelector('.remove-btn');
        if (removeButton) {
            removeButton.addEventListener('click', () => removeStock(symbol));
        }
        watchlistDisplay.appendChild(li);

        // Fetch live price for each stock
        await fetchLivePrice(symbol);
    });

    await Promise.all(promises); // Wait for all prices to be fetched
    hideElement(watchlistLoading);
}

async function removeStock(symbolToRemove) {
    const indexToRemove = watchlists[currentWatchlist].indexOf(symbolToRemove);
    if (indexToRemove > -1) {
        watchlists[currentWatchlist].splice(indexToRemove, 1);
        renderWatchlist(); // Update UI
        await saveWatchlistsToServer(); // Save changes to server
    }
}

function highlightActiveButton(index) {
    const buttons = document.querySelectorAll(".watchlist-tabs button");
    buttons.forEach((btn, i) => {
        if (i === index) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

async function fetchWatchlistsFromServer() {
    if (!authToken) {
        console.log("No token found, cannot fetch watchlists.");
        watchlists = [[], [], []]; // Reset to empty if no token
        renderWatchlist();
        highlightActiveButton(0);
        return;
    }

    showElement(watchlistLoading);
    clearErrorMessage(watchlistError);
    try {
        const response = await fetch(`${API_BASE_URL}/watchlists`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("Failed to fetch watchlists:", error.message);
            displayErrorMessage(watchlistError, "Failed to load watchlists. Please try again.");
            watchlists = [[], [], []]; // Reset to empty on error
            renderWatchlist();
            highlightActiveButton(0);
            return;
        }

        const data = await response.json();
        // Ensure data.watchlists is an array of arrays, and has at least 3 elements
        if (data.watchlists && Array.isArray(data.watchlists) && data.watchlists.length >= 3) {
            watchlists = data.watchlists; // Assign the fetched watchlist
        } else {
            console.warn("Fetched watchlists structure is not as expected, initializing default.");
            watchlists = [[], [], []]; // Fallback to default if structure is wrong
        }
        renderWatchlist(); // Render the fetched watchlist
        highlightActiveButton(currentWatchlist); // Highlight the default tab
    } catch (error) {
        console.error("Error fetching watchlists:", error);
        displayErrorMessage(watchlistError, `Network error fetching watchlists: ${error.message}`);
        watchlists = [[], [], []]; // Reset to empty on network error
        renderWatchlist();
        highlightActiveButton(0);
    } finally {
        hideElement(watchlistLoading);
    }
}

async function saveWatchlistsToServer() {
    if (!authToken) {
        console.log("No token found, cannot save watchlists.");
        displayErrorMessage(watchlistError, "You need to be logged in to save watchlists.");
        return;
    }

    showElement(watchlistLoading); // Show loading while saving
    clearErrorMessage(watchlistError);
    try {
        const response = await fetch(`${API_BASE_URL}/watchlists`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ watchlists }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("Failed to save watchlists:", error.message);
            displayErrorMessage(watchlistError, `Failed to save watchlists: ${error.message}`);
        } else {
            console.log("Watchlists saved successfully.");
        }
    } catch (error) {
        console.error("Error saving watchlists:", error);
        displayErrorMessage(watchlistError, `Network error saving watchlists: ${error.message}`);
    } finally {
        hideElement(watchlistLoading); // Hide loading after saving
    }
}

// --- Live Price Fetching (Adapted from your script.js) ---
async function fetchLivePrice(symbols) {
    const symbolsArray = Array.isArray(symbols) ? symbols : [symbols]; // Ensure it's an array

    symbolsArray.forEach(symbol => {
        const priceElement = document.getElementById(`price-${symbol}`);
        if (priceElement) {
            priceElement.textContent = 'Loading...'; // Set individual loading state
        }
    });

    try {
        // This endpoint assumes a backend that fetches stock prices from a real API
        const response = await fetch(`${STOCK_API_BACKEND_URL}/api/stock/live/${symbolsArray.join(',')}`);
        if (!response.ok) {
            console.error(`Error fetching live price for ${symbolsArray.join(',')}: HTTP error! status: ${response.status}`);
            symbolsArray.forEach(symbol => {
                const priceElement = document.getElementById(`price-${symbol}`);
                if (priceElement) {
                    priceElement.textContent = 'Error';
                }
            });
            return;
        }
        const data = await response.json();

        if (data && Array.isArray(data) && data.length > 0) { // Handle array of stock data
            data.forEach(stockData => {
                const priceElement = document.getElementById(`price-${stockData.symbol}`);
                if (priceElement) {
                    priceElement.textContent = `$${stockData.price.toFixed(2)}`;
                }
            });
        } else if (data && data.symbol && typeof data.price === 'number') { // Handle single stock response
            const priceElement = document.getElementById(`price-${data.symbol}`);
            if (priceElement) {
                priceElement.textContent = `$${data.price.toFixed(2)}`;
            } else {
                console.warn(`Price element not found for symbol: ${data.symbol}`);
            }
        } else { // No data or invalid data format
            symbolsArray.forEach(symbol => {
                const priceElement = document.getElementById(`price-${symbol}`);
                if (priceElement) {
                    priceElement.textContent = 'N/A'; // Indicate not available
                }
            });
        }
    } catch (error) {
        console.error(`Error fetching live price for ${symbolsArray.join(',')}:`, error);
        symbolsArray.forEach(symbol => {
            const priceElement = document.getElementById(`price-${symbol}`);
            if (priceElement) {
                priceElement.textContent = 'Error';
            }
        });
    }
}

// --- Initial Page Load ---
document.addEventListener("DOMContentLoaded", () => {
    loadPage('myportfolio.html'); // Load portfolio by default on initial page load
});