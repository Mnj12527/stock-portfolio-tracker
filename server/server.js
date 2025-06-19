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
// ... (rest of your server.js code)

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected");
        // Optional: Create an admin user if not exists (for development)
        async function createAdminUser() {
            const adminEmail = "mnj12527@gmail.com";
            const adminPassword = "Mnj@12527";
            const adminUsername = "MNJ";

            const existingAdmin = await User.findOne({ email: adminEmail });
            // Add this line for debugging:
            console.log("DEBUG: Result of User.findOne for admin:", existingAdmin ? existingAdmin.email : "NOT FOUND"); // Will show the email if found, or 'NOT FOUND'

            if (!existingAdmin) {
                const hashedPassword = await bcrypt.hash(adminPassword, 10);
                const newAdmin = new User({
                    username: adminUsername,
                    email: adminEmail,
                    password: hashedPassword,
                    role: 'admin'
                });
                await newAdmin.save();
                console.log("Admin user created:", adminEmail);
            } else {
                console.log("Admin user already exists.");
            }
        }
        createAdminUser();
    })
    .catch(err => console.error("MongoDB connection error:", err));
// ... (rest of your server.js code)

// User schema with watchlists, portfolio, and new profile fields
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // Added validation
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mobileNumber: { type: String, default: '' }, // New field
    address: { type: String, default: '' },       // New field
    profession: { type: String, default: '' },   // New field
    role: { type: String, default: 'user', enum: ['user', 'admin'] }, // NEW: Added role field
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

// NEW: Middleware to authenticate and check for admin role
const authenticateAdmin = (req, res, next) => {
    authenticate(req, res, () => { // First, authenticate the user
        if (!req.user) {
            // This case should be handled by 'authenticate'
            return res.status(401).json({ message: "Authentication required." });
        }
        if (req.user.role !== 'admin') {
            console.warn("Unauthorized access attempt by user:", req.user.username, "Role:", req.user.role);
            return res.status(403).json({ message: "Access forbidden: Admin privilege required." });
        }
        next();
    });
};

// --- Authentication Routes ---
// Sign-Up
app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;
    console.log("Signup attempt:", { username, email });
    if (!username || !email || !password) {
        return res.status(400).json({ message: "Please provide all required fields." });
    }
    try {
        const existingUser = await User.findOne({ $or: [{ email }, { username }] }); // Check both email and username
        if (existingUser) {
            console.log("Signup failed: User already exists.");
            return res.status(400).json({ message: "User with this email or username already exists." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        // Do not ask for mobileNumber, address, profession during signup, they default to empty string
        const newUser = new User({ username, email, password: hashedPassword, role: 'user' }); // Default role is 'user'
        await newUser.save();
        console.log("User registered successfully:", username);
        res.status(201).json({ success: true, message: "User registered successfully" });
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: "Error registering user." });
    }
});

// Sign-In
app.post("/signin", async (req, res) => {
    const { email, password } = req.body;
    console.log("Signin attempt for email:", email);
    if (!email || !password) {
        return res.status(400).json({ message: "Please provide both email and password." });
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            console.log("Signin failed: User not found for email:", email);
            return res.status(404).json({ message: "User not found." });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log("Signin failed: Invalid credentials for email:", email);
            return res.status(401).json({ message: "Invalid credentials." });
        }
        // Include user's role in the JWT payload
        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
        console.log("Login successful for user:", user.username, "Role:", user.role);
        // Also send the role in the response
        res.status(200).json({ message: "Login successful", token, username: user.username, role: user.role });
    } catch (error) {
        console.error("Error during signin:", error);
        res.status(500).json({ message: "Error logging in." });
    }
});

// --- NEW PROFILE MANAGEMENT ENDPOINTS ---

// GET User Profile
app.get("/api/profile", authenticate, async (req, res) => {
    console.log("GET /api/profile requested by user ID:", req.user._id);
    try {
        const user = await User.findById(req.user._id).select('-password'); // Exclude password from response
        if (!user) {
            console.log("GET /api/profile failed: User not found for ID:", req.user._id);
            return res.status(404).json({ message: "User not found." });
        }
        console.log("Successfully fetched profile for user:", user.username);
        res.json({
            username: user.username,
            email: user.email,
            mobileNumber: user.mobileNumber,
            address: user.address,
            profession: user.profession,
            role: user.role // Include role in profile API response
        });
    } catch (error) {
        console.error("Error fetching user profile for ID:", req.user._id, error);
        res.status(500).json({ message: "Error fetching user profile." });
    }
});

// PUT Update User Profile
app.put("/api/profile", authenticate, async (req, res) => {
    // Only allow updating these fields from the profile page
    const { username, mobileNumber, address, profession } = req.body;
    console.log("PUT /api/profile requested by user ID:", req.user._id);
    console.log("Received profile data for update:", { username, mobileNumber, address, profession });

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            console.log("PUT /api/profile failed: User not found for ID:", req.user._id);
            return res.status(404).json({ message: "User not found." });
        }

        // Validate username change to avoid conflicts
        if (username && username !== user.username) {
            const existingUserWithNewUsername = await User.findOne({ username: username });
            if (existingUserWithNewUsername && existingUserWithNewUsername._id.toString() !== user._id.toString()) {
                console.log("PUT /api/profile failed: Username already taken:", username);
                return res.status(400).json({ message: "This username is already taken." });
            }
            user.username = username; // Update if valid and changed
            console.log("Username updated to:", user.username);
        }

        // Update other fields if provided, otherwise retain current value
        // Note: Using '!== undefined' to allow saving empty strings if intended
        if (mobileNumber !== undefined) user.mobileNumber = mobileNumber;
        if (address !== undefined) user.address = address;
        if (profession !== undefined) user.profession = profession;

        await user.save({ validateBeforeSave: true }); // Mongoose validates schema before saving
        console.log("Profile updated successfully for user ID:", req.user._id);

        res.json({
            success: true,
            message: "Profile updated successfully.",
            username: user.username, // Send back updated username
            mobileNumber: user.mobileNumber,
            address: user.address,
            profession: user.profession,
            email: user.email, // Email is display-only, but returned for confirmation
            role: user.role // Include role in profile API response
        });
    } catch (error) {
        console.error("Error updating user profile for ID:", req.user._id, error);
        if (error.name === 'ValidationError') {
            console.error("Profile update validation error:", error.message);
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Error updating user profile." });
    }
});

// PUT Change User Password
app.put("/api/profile/change-password", authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    console.log("PUT /api/profile/change-password requested by user ID:", req.user._id);

    if (!currentPassword || !newPassword) {
        console.log("Password change failed: Missing current or new password.");
        return res.status(400).json({ message: "Please provide both current and new passwords." });
    }
    if (newPassword.length < 6) { // Basic password policy, adjust as needed
        console.log("Password change failed: New password too short.");
        return res.status(400).json({ message: "New password must be at least 6 characters long." });
    }

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            console.log("Password change failed: User not found for ID:", req.user._id);
            return res.status(404).json({ message: "User not found." });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            console.log("Password change failed: Incorrect current password for user ID:", req.user._id);
            return res.status(401).json({ message: "Incorrect current password." });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword; // Update the password
        await user.save(); // Save the user document
        console.log("Password updated successfully for user ID:", req.user._id);

        res.json({ success: true, message: "Password updated successfully." });
    } catch (error) {
        console.error("Error changing password for user ID:", req.user._id, error);
        res.status(500).json({ message: "Error changing password." });
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
            console.error('Axios error response data:', error.response?.data);
            console.error('Axios error status:', error.response?.status);
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
    }
    catch (error) {
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
        res.json(response.data); // Corrected to use response.data
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


// Root route for the main page (e.g., when accessing http://localhost:5000/)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html')); // Assuming your login/entry point is index.html
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});