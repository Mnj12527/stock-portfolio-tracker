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
    .catch(err => console.error(err));

// User schema with watchlists
const UserSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    watchlists: {
        type: [[String]],
        default: [[], [], []]
    }
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
        res.status(401).json({ message: "Invalid token" });
    }
};

// --- Authentication Routes ---
// Sign-Up
app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: "Please provide all required fields." });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists." });
    }
    try {
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
        res.status(200).json({ message: "Login successful", token });
    } catch (error) {
        console.error("Error during signin:", error);
        res.status(500).json({ message: "Error logging in." });
    }
});

// --- FMP API Proxy Endpoints (for Portfolio) ---
// Endpoint to fetch single stock data from FMP (for watchlist price display)
app.get('/stock-data/:symbol', authenticate, async (req, res) => {
    const { symbol } = req.params;
    const FMP_API_KEY = process.env.FMP_API_KEY;

    if (!FMP_API_KEY) {
        console.error("FMP_API_KEY not set in environment variables.");
        return res.status(500).json({ message: "Server API key not configured." });
    }
    if (!symbol) {
        return res.status(400).json({ message: "Stock symbol is required." });
    }

    try {
        // FIXED: Correct template literal interpolation for FMP_API_KEY
        const response = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_API_KEY}`);
        if (response.data && response.data.length > 0) {
            res.json(response.data);
        } else {
            res.status(404).json({ message: "Stock data not found for symbol." });
        }
    } catch (error) {
        console.error(`Error fetching stock data for ${symbol}:`, error.message);
        if (axios.isAxiosError(error)) {
            console.error('Axios error response data:', error.response?.data);
            console.error('Axios error status:', error.response?.status);
            if (error.response?.status === 404) {
                return res.status(404).json({ message: `Stock data not found for ${symbol}.` });
            }
        }
        res.status(500).json({ message: `Failed to fetch stock data for ${symbol}.` });
    }
});

// API endpoint to get historical price data for a symbol (for the chart)
app.get('/api/stock-history/:symbol', authenticate, async (req, res) => {
    const { symbol } = req.params;
    const FMP_API_KEY = process.env.FMP_API_KEY;

    if (!FMP_API_KEY) {
        console.error("FMP_API_KEY not set in environment variables for historical data.");
        return res.status(500).json({ error: 'Server API key not configured.' });
    }

    try {
        // FIXED: Correct template literal interpolation for FMP_API_KEY
        const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?serietype=line&apikey=${FMP_API_KEY}`;
        const response = await axios.get(url);

        if (!response.data.historical || response.data.historical.length === 0) {
            return res.status(404).json({ error: 'No historical data found for this symbol.' });
        }

        const data = response.data.historical.map(day => ({
            time: day.date,
            value: day.close,
        }));

        res.json(data.reverse());
    } catch (err) {
        console.error(`Error fetching historical stock data for ${symbol}:`, err.message);
        if (axios.isAxiosError(err)) {
            console.error('Axios error response data:', err.response?.data);
            console.error('Axios error status:', err.response?.status);
        }
        res.status(500).json({ error: 'Failed to fetch historical stock data from API.' });
    }
});

// API route to get sector performance data
app.get('/api/sector-performance', async (req, res) => { // NOTE: Not authenticated in your original code
    const FMP_API_KEY = process.env.FMP_API_KEY;

    if (!FMP_API_KEY) {
        console.error("FMP_API_KEY missing in .env for /api/sector-performance");
        return res.status(500).json({ message: "Server API key for FMP is not configured." });
    }

    try {
        // Correct template literal interpolation for FMP_API_KEY
        const url = `https://financialmodelingprep.com/api/v3/stock/sectors-performance?apikey=${FMP_API_KEY}`;
        const response = await axios.get(url);

        if (response.data && response.data.sectorPerformance) {
            res.json({ sectorPerformance: response.data.sectorPerformance });
        } else {
            res.status(500).json({ message: "Invalid response from FMP API for sector performance" });
        }
    } catch (error) {
        console.error("Error fetching sector performance:", error.message);
        if (axios.isAxiosError(error)) {
            console.error('Axios error response data for sector performance:', error.response?.data);
            console.error('Axios error status for sector performance:', error.response?.status);
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
        console.error("Invalid watchlists format");
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
        // FIXED: Correct template literal interpolation for TWELVEDATA_API_KEY
        const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVEDATA_API_KEY}`;
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching Twelve Data quote for ${symbol}:`, error.message);
        if (axios.isAxiosError(error)) {
            console.error('Axios error response data:', error.response?.data);
            console.error('Axios error status:', error.response?.status);
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
        // FIXED: Correct template literal interpolation for TWELVEDATA_API_KEY
        const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1min&outputsize=30&apikey=${TWELVEDATA_API_KEY}`;
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching Twelve Data time series for ${symbol}:`, error.message);
        if (axios.isAxiosError(error)) {
            console.error('Axios error response data:', error.response?.data);
            console.error('Axios error status:', error.response?.status);
        }
        res.status(500).json({ message: `Failed to fetch time series data for ${symbol}.` });
    }
});


// --- Static File Serving (ensure this is placed after all API routes) ---
app.use(express.static(path.join(__dirname, "../client")));

// Catch-all for HTML files (optional, but good for direct URL access)
app.get('/:pageName.html', (req, res) => {
    const { pageName } = req.params;
    const filePath = path.join(__dirname, `../client/${pageName}.html`);
    console.log(`Server is attempting to send file: ${filePath}`); // Debug log
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error serving ${pageName}.html:`, err);
            res.status(404).send('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Error</title></head><body><pre>Page Not Found</pre></body></html>');
        }
    });
});

// Root route for the main page (if you have one, e.g., index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
