const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const path = require("path");
const axios = require('axios');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.error("MongoDB connection error:", err)); // More descriptive error

// User schema with watchlists and portfolio
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // Added validation
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    watchlists: {
        type: [[String]],
        default: [[], [], []],
        validate: { // Basic validation for watchlist structure
            validator: function (v) {
                return v.length === 3 && v.every(Array.isArray);
            },
            message: props => `${props.value} is not a valid watchlist format! Expected a 2D array with 3 inner arrays.`
        }
    },
    // Updated portfolio field to store detailed stock holdings including portfolioName and totalValue
    portfolio: [{
        symbol: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        purchasePrice: { type: Number, required: true },
        totalValue: { type: Number, required: true }, // Added totalValue
        portfolioName: { type: String, required: true, trim: true }, // Added portfolioName
        purchaseDate: { type: Date, default: Date.now }
    }]
});
const User = mongoose.model("User", UserSchema);

// Middleware to authenticate JWT
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        console.log("Authentication failed: No token provided");
        return res.status(401).json({ message: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.userId);
        if (!req.user) {
            console.log("Authentication failed: User not found for token");
            return res.status(401).json({ message: "Invalid token" });
        }
        next();
    } catch (err) {
        console.error("Authentication error:", err);
        // Distinguish between token expiration and other errors
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Token expired. Please log in again." });
        }
        res.status(401).json({ message: "Invalid token." });
    }
};

// --- Authentication Routes ---
// Sign-Up
app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: "Please provide all required fields." });
    }
    try {
        const existingUser = await User.findOne({ $or: [{ email }, { username }] }); // Check both email and username
        if (existingUser) {
            return res.status(400).json({ message: "User with this email or username already exists." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ success: true, message: "User registered successfully" });
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: "Error registering user." });
    }
});

// Sign-In
app.post("/signin", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Please provide both email and password." });
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials." });
        }
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        // --- START OF CHANGE ---
        res.status(200).json({ message: "Login successful", token, username: user.username }); // Added username
        // --- END OF CHANGE ---
    } catch (error) {
        console.error("Error during signin:", error);
        res.status(500).json({ message: "Error logging in." });
    }
});

// --- FMP API Proxy Endpoints (for Home) ---
// Endpoint to fetch single stock data from FMP (for watchlist price display)
app.get('/stock-data/:symbol', authenticate, async (req, res) => {
    const { symbol } = req.params;
    const FMP_API_KEY = process.env.FMP_API_KEY; // Use consistent key name

    if (!FMP_API_KEY) {
        console.error("FMP_API_KEY not set in environment variables.");
        return res.status(500).json({ message: "Server API key not configured for FMP." });
    }
    if (!symbol) {
        return res.status(400).json({ message: "Stock symbol is required." });
    }

    try {
        const response = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_API_KEY}`);
        if (response.data && response.data.length > 0) {
            res.json(response.data);
        } else {
            // FMP returns empty array for invalid symbols, so this is a valid 404 case
            res.status(404).json({ message: "Stock data not found for symbol or invalid symbol." });
        }
    } catch (error) {
        console.error(`Error fetching stock data for ${symbol}:`, error.message);
        if (axios.isAxiosError(error)) {
            console.error('Axios error response data:', error.response?.data);
            console.error('Axios error status:', error.response?.status);
            // Propagate specific FMP API errors if relevant (e.g., rate limits)
            if (error.response?.status === 401) { // Unauthorized with FMP key
                return res.status(500).json({ message: "FMP API key invalid or expired on server." });
            }
            if (error.response?.status === 403) { // Forbidden / Rate limit
                return res.status(429).json({ message: "FMP API rate limit reached or access forbidden." });
            }
        }
        res.status(500).json({ message: `Failed to fetch stock data for ${symbol} from external API.` });
    }
});

// API endpoint to get historical price data for a symbol (for the chart)
app.get('/api/stock-history/:symbol', authenticate, async (req, res) => {
    const { symbol } = req.params;
    const FMP_API_KEY = process.env.FMP_API_KEY; // Use consistent key name

    if (!FMP_API_KEY) {
        console.error("FMP_API_KEY not set in environment variables for historical data.");
        return res.status(500).json({ error: 'Server API key not configured.' });
    }

    try {
        const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?serietype=line&apikey=${FMP_API_KEY}`;
        const response = await axios.get(url);

        if (!response.data.historical || response.data.historical.length === 0) {
            return res.status(404).json({ error: 'No historical data found for this symbol.' });
        }

        const data = response.data.historical.map(day => ({
            time: day.date,
            value: day.close,
        }));

        res.json(data.reverse()); // Ensure chronological order for chart
    } catch (err) {
        console.error(`Error fetching historical stock data for ${symbol}:`, err.message);
        if (axios.isAxiosError(err)) {
            console.error('Axios error response data:', err.response?.data);
            console.error('Axios error status:', err.response?.status);
            if (err.response?.status === 401) {
                return res.status(500).json({ error: "FMP API key invalid or expired for historical data." });
            }
            if (err.response?.status === 403) {
                return res.status(429).json({ error: "FMP API rate limit reached for historical data." });
            }
            if (err.response?.status === 400) { // Often for invalid symbol in FMP
                return res.status(400).json({ error: "Invalid symbol or request for historical data." });
            }
        }
        res.status(500).json({ error: 'Failed to fetch historical stock data from API.' });
    }
});

// API route to get sector performance data
app.get('/api/sector-performance', async (req, res) => { // NOTE: Not authenticated in your original code
    const FMP_API_KEY = process.env.FMP_API_KEY; // Use consistent key name

    if (!FMP_API_KEY) {
        console.error("FMP_API_KEY missing in .env for /api/sector-performance");
        return res.status(500).json({ message: "Server API key for FMP is not configured." });
    }

    try {
        const url = `https://financialmodelingprep.com/api/v3/sectors-performance?apikey=${FMP_API_KEY}`; // Corrected endpoint if needed, usually just `/sectors-performance`
        const response = await axios.get(url);

        // FMP's sector performance sometimes returns an array directly, sometimes nested.
        // Adjust based on actual FMP response structure for your endpoint.
        // Assuming it's an array of objects directly now, or inside a 'sectorPerformance' key.
        if (response.data && Array.isArray(response.data)) { // If it's an array directly
            res.json({ sectorPerformance: response.data });
        } else if (response.data && response.data.sectorPerformance && Array.isArray(response.data.sectorPerformance)) {
            res.json({ sectorPerformance: response.data.sectorPerformance });
        }
        else {
            console.warn("Unexpected FMP response structure for sector performance:", response.data);
            res.status(500).json({ message: "Invalid response from FMP API for sector performance" });
        }
    } catch (error) {
        console.error("Error fetching sector performance:", error.message);
        if (axios.isAxiosError(error)) {
            console.error('Axios error response data for sector performance:', error.response?.data);
            console.error('Axios error status for sector performance:', error.response?.status);
            if (error.response?.status === 401) {
                return res.status(500).json({ message: "FMP API key invalid or expired for sector performance." });
            }
            if (error.response?.status === 403) {
                return res.status(429).json({ message: "FMP API rate limit reached for sector performance." });
            }
        }
        res.status(500).json({ message: "Failed to fetch sector performance" });
    }
});


// --- Watchlist Management Endpoints ---
// Get Watchlists
app.get("/watchlists", authenticate, async (req, res) => {
    try {
        console.log("Getting watchlists for user ID:", req.user._id);
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        res.json({ watchlists: user.watchlists });
    } catch (error) {
        console.error("Error fetching watchlists:", error);
        res.status(500).json({ message: "Error fetching watchlists." });
    }
});

// Update Watchlists
app.put("/watchlists", authenticate, async (req, res) => {
    const { watchlists } = req.body;
    console.log("Updating watchlists for user ID:", req.user._id);
    if (!Array.isArray(watchlists) || watchlists.length !== 3 || !watchlists.every(Array.isArray)) {
        console.error("Invalid watchlists format received from client.");
        return res.status(400).json({ message: "Invalid watchlists format. Expected a 2D array with 3 inner arrays." });
    }
    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { watchlists: watchlists },
            { new: true, runValidators: true }
        );
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }
        console.log("Watchlists updated successfully.");
        res.json({ success: true, watchlists: updatedUser.watchlists });
    } catch (error) {
        console.error("Error updating watchlists:", error);
        res.status(500).json({ message: "Error updating watchlists." });
    }
});

// --- NEW ENDPOINT FOR WATCHLIST PIE CHART DATA ---
app.get('/api/user-watchlist-counts', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        const watchlistData = user.watchlists.map((watchlist, index) => ({
            watchlistName: `Watchlist ${index + 1}`,
            stockCount: watchlist.length
        }));
        res.json(watchlistData);
    } catch (error) {
        console.error('Error fetching user watchlist counts:', error);
        res.status(500).json({ message: 'Failed to fetch user watchlist counts.' });
    }
});

// --- NEW PORTFOLIO MANAGEMENT ENDPOINTS ---
// Add Stock to Portfolio
app.post("/portfolio/add", authenticate, async (req, res) => {
    // Destructure all expected fields, including the new ones
    const { symbol, quantity, purchasePrice, totalValue, portfolioName, dateAdded } = req.body;

    if (!symbol || !quantity || quantity <= 0 || !purchasePrice || purchasePrice <= 0 || !totalValue || totalValue <= 0 || !portfolioName) {
        return res.status(400).json({ message: "Missing required fields or invalid values for portfolio entry." });
    }

    try {
        const newHolding = {
            symbol: symbol.toUpperCase(),
            quantity: quantity,
            purchasePrice: purchasePrice,
            totalValue: totalValue, // Store totalValue
            portfolioName: portfolioName, // Store portfolioName
            purchaseDate: new Date(dateAdded) // Use the dateAdded from the client
        };

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $push: { portfolio: newHolding } }, // Add to the portfolio array
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        res.status(201).json({
            success: true,
            message: `${quantity} shares of ${symbol.toUpperCase()} added to portfolio '${portfolioName}'.`,
            portfolio: updatedUser.portfolio
        });

    } catch (error) {
        console.error("Error adding stock to portfolio:", error);
        // Catch and respond to Mongoose validation errors or other issues
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Error adding stock to portfolio." });
    }
});

// Get User Portfolio
app.get("/portfolio", authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        res.json({ portfolio: user.portfolio });
    } catch (error) {
        console.error("Error fetching user portfolio:", error);
        res.status(500).json({ message: "Error fetching user portfolio." });
    }
});

// NEW: Delete a specific stock holding from portfolio
app.delete("/portfolio/delete-holding/:holdingId", authenticate, async (req, res) => {
    const { holdingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(holdingId)) {
        return res.status(400).json({ message: "Invalid holding ID." });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $pull: { portfolio: { _id: holdingId } } }, // Remove the specific holding by _id
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        if (!updatedUser.portfolio.some(holding => holding._id.toString() === holdingId)) {
            // This check might be redundant if $pull works as expected, but good for explicit confirmation
            // It means the holding wasn't found in the first place or was already removed
            // Alternatively, you could check if the document was modified
            // const result = await User.updateOne(
            //     { _id: req.user._id },
            //     { $pull: { portfolio: { _id: holdingId } } }
            // );
            // if (result.modifiedCount === 0) { ... }
        }

        res.json({ success: true, message: "Stock holding deleted successfully.", portfolio: updatedUser.portfolio });
    } catch (error) {
        console.error("Error deleting stock holding:", error);
        res.status(500).json({ message: "Error deleting stock holding." });
    }
});

// NEW: Delete an entire portfolio by name
app.delete("/portfolio/delete-portfolio/:portfolioName", authenticate, async (req, res) => {
    const { portfolioName } = req.params;

    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $pull: { portfolio: { portfolioName: portfolioName } } }, // Remove all holdings with this portfolioName
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        res.json({ success: true, message: `Portfolio "${portfolioName}" and all its holdings deleted successfully.`, portfolio: updatedUser.portfolio });
    } catch (error) {
        console.error("Error deleting portfolio:", error);
        res.status(500).json({ message: "Error deleting portfolio." });
    }
});


// --- Youtube Endpoint ---
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const MAX_RESULTS = 10;

app.get('/search', async (req, res) => {
    const { query } = req.query;
    console.log("Received Youtube query:", query);
    if (!query) {
        console.log("Error: Missing search query");
        return res.status(400).json({ error: 'Missing search query.' });
    }
    if (!YOUTUBE_API_KEY) {
        console.error("YOUTUBE_API_KEY is not set in environment variables.");
        return res.status(500).json({ error: 'YouTube API key not configured on the server.' });
    }
    try {
        const response = await axios.get(
            'https://www.googleapis.com/youtube/v3/search',
            {
                params: {
                    part: 'snippet',
                    q: query,
                    key: YOUTUBE_API_KEY,
                    maxResults: MAX_RESULTS,
                    type: 'video',
                },
                timeout: 10000
            }
        );
        console.log("YouTube API response status:", response.status);
        const videos = response.data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails?.medium?.url,
        }));
        res.json(videos);
    } catch (error) {
        console.error('Error fetching videos from YouTube:', error.message);
        if (axios.isAxiosError(error)) {
            console.error('Axios error response data:', error.response?.data);
            console.error('Axios error status:', error.response?.status);
            if (error.response?.status === 400 && error.response.data.error?.message.includes("API key not valid")) {
                return res.status(401).json({ error: "YouTube API key is invalid or has insufficient permissions." });
            }
            if (error.response?.status === 403 && error.response.data.error?.message.includes("quotaExceeded")) {
                return res.status(429).json({ error: "YouTube API daily quota exceeded." });
            }
        }
        res.status(500).json({ error: 'Failed to fetch videos from YouTube.' });
    }
});

// --- Twelve Data API Proxy Endpoints (for Markets) ---
app.get('/api/twelvedata/quote/:symbol', authenticate, async (req, res) => {
    const { symbol } = req.params;
    const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY;

    if (!TWELVEDATA_API_KEY) {
        console.error("TWELVEDATA_API_KEY not set in environment variables for quote.");
        return res.status(500).json({ message: "Server API key for Twelve Data is not configured." });
    }

    try {
        const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVEDATA_API_KEY}`;
        const response = await axios.get(url);
        // Twelve Data often returns a specific status or message for invalid symbols
        if (response.data.status === 'error') {
            return res.status(400).json({ message: response.data.message || `Invalid symbol: ${symbol}` });
        }
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching Twelve Data quote for ${symbol}:`, error.message);
        if (axios.isAxiosError(error)) {
            console.error('Axios error response data:', error.response?.data);
            console.error('Axios error status:', error.response?.status);
            if (error.response?.status === 401) {
                return res.status(500).json({ message: "Twelve Data API key invalid or expired." });
            }
            if (error.response?.status === 429) {
                return res.status(429).json({ message: "Twelve Data API rate limit reached." });
            }
        }
        res.status(500).json({ message: `Failed to fetch quote data for ${symbol}.` });
    }
});

app.get('/api/twelvedata/time_series/:symbol', authenticate, async (req, res) => {
    const { symbol } = req.params;
    const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY;

    if (!TWELVEDATA_API_KEY) {
        console.error("TWELVEDATA_API_KEY not set in environment variables for time series.");
        return res.status(500).json({ message: "Server API key for Twelve Data is not configured." });
    }

    try {
        const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1min&outputsize=30&apikey=${TWELVEDATA_API_KEY}`;
        const response = await axios.get(url);
        if (response.data.status === 'error') {
            return res.status(400).json({ message: response.data.message || `Invalid symbol: ${symbol}` });
        }
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching Twelve Data time series for ${symbol}:`, error.message);
        if (axios.isAxiosError(error)) {
            console.error('Axios error response data:', error.response?.data);
            console.error('Axios error status:', error.response?.status);
            if (error.response?.status === 401) {
                return res.status(500).json({ message: "Twelve Data API key invalid or expired." });
            }
            if (error.response?.status === 429) {
                return res.status(429).json({ message: "Twelve Data API rate limit reached." });
            }
        }
        res.status(500).json({ message: `Failed to fetch time series data for ${symbol}.` });
    }
});


// --- Static File Serving (ensure this is placed after all API routes) ---
// Serve static assets from the 'client' directory
app.use(express.static(path.join(__dirname, "../client")));

// Catch-all for HTML files (optional, but good for direct URL access, e.g., /Markets.html)
app.get('/:pageName.html', (req, res) => {
    const { pageName } = req.params;
    const filePath = path.join(__dirname, `../client/${pageName}.html`);
    console.log(`Server is attempting to send file: ${filePath}`); // Debug log
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error serving ${pageName}.html:`, err);
            // More user-friendly 404 page
            res.status(404).send('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>404 Not Found</title><style>body { font-family: sans-serif; text-align: center; margin-top: 50px; } h1 { color: #dc3545; }</style></head><body><h1>404 Page Not Found</h1><p>The page you requested could not be found.</p><a href="/">Go to Home</a></body></html>');
        }
    });
});


const fetch = require('node-fetch'); // or axios

const TWELVE_DATA_API_KEY=process.env.TWELVE_DATA_API_KEY; // Get from environment variable

// Middleware to verify JWT token (as per your existing client-side code)
// ... (your authentication middleware here)

app.get('/api/twelvedata/quote/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    if (!TWELVE_DATA_API_KEY) {
        return res.status(500).json({ message: "Server API key for Twelve Data is not configured." });
    }
    try {
        const response = await fetch(`https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`);
        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json(errorData);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error fetching quote from Twelve Data:", error);
        res.status(500).json({ message: "Failed to fetch data from Twelve Data API." });
    }
});

app.get('/api/twelvedata/time_series/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    if (!TWELVE_DATA_API_KEY) {
        return res.status(500).json({ message: "Server API key for Twelve Data is not configured." });
    }
    try {
        // Adjust interval as needed, e.g., '1min', '5min', '1day'
        const response = await fetch(`https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1min&outputsize=30&apikey=${TWELVE_DATA_API_KEY}`);
        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json(errorData);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error fetching time series from Twelve Data:", error);
        res.status(500).json({ message: "Failed to fetch time series data from Twelve Data API." });
    }
});

// Root route for the main page (e.g., when accessing http://localhost:5000/)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html')); // Assuming your login/entry point is index.html
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});