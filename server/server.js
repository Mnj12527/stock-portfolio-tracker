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
    .then(() => {
        console.log("MongoDB Connected");
        // Optional: Create an admin user if not exists (for development)
        async function createAdminUser() {
            const adminEmail = "mnj12527@gmail.com";
            const adminPassword = "Mnj@12527";
            const adminUsername = "MNJ";

            const existingAdmin = await User.findOne({ email: adminEmail });
            console.log("DEBUG: Result of User.findOne for admin:", existingAdmin ? existingAdmin.email : "NOT FOUND");

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

// --- Mongoose Models ---

// Activity Schema for logging user actions
const ActivitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    type: { type: String, required: true, enum: ['signup', 'profile_update', 'stock_added', 'stock_removed', 'portfolio_deleted'] },
    description: { type: String, required: true },
    date: { type: Date, default: Date.now }
});
const Activity = mongoose.model("Activity", ActivitySchema);


// User schema with watchlists, portfolio, and new profile fields
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mobileNumber: { type: String, default: '' },
    address: { type: String, default: '' },
    profession: { type: String, default: '' },
    role: { type: String, default: 'user', enum: ['user', 'admin'] },
    createdAt: { type: Date, default: Date.now }, // Added for user growth chart
    watchlists: {
        type: [[String]],
        default: [[], [], []],
        validate: {
            validator: function (v) {
                return v.length === 3 && v.every(Array.isArray);
            },
            message: props => `${props.value} is not a valid watchlist format! Expected a 2D array with 3 inner arrays.`
        }
    },
    portfolio: [{
        symbol: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        purchasePrice: { type: Number, required: true },
        totalValue: { type: Number, required: true }, // This is the purchase value
        portfolioName: { type: String, required: true, trim: true },
        purchaseDate: { type: Date, default: Date.now }
    }],
    // NEW: To store realized gains/losses from sold positions
    realizedTransactions: [{
        symbol: { type: String, required: true },
        quantity: { type: Number, required: true },
        purchasePrice: { type: Number, required: true }, // Price at which it was bought
        sellPrice: { type: Number, required: true },     // Price at which it was sold
        gainLoss: { type: Number, required: true },      // Calculated gain/loss
        dateSold: { type: Date, default: Date.now }      // Date of sale
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
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Token expired. Please log in again." });
        }
        res.status(401).json({ message: "Invalid token." });
    }
};

// NEW: Middleware to authenticate and check for admin role
const authenticateAdmin = (req, res, next) => {
    authenticate(req, res, () => {
        if (!req.user || req.user.role !== 'admin') {
            console.warn("Unauthorized access attempt by user:", req.user ? req.user.username : 'Unknown', "Role:", req.user ? req.user.role : 'N/A');
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
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            console.log("Signup failed: User already exists.");
            return res.status(400).json({ message: "User with this email or username already exists." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword, role: 'user' });
        await newUser.save();

        // Log signup activity
        await Activity.create({
            userId: newUser._id,
            username: newUser.username,
            type: 'signup',
            description: `New user ${newUser.username} signed up.`
        });

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
        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
        console.log("Login successful for user:", user.username, "Role:", user.role);
        res.status(200).json({ message: "Login successful", token, username: user.username, role: user.role });
    } catch (error) {
        console.error("Error during signin:", error);
        res.status(500).json({ message: "Error logging in." });
    }
});

// --- PROFILE MANAGEMENT ENDPOINTS ---
app.get("/api/profile", authenticate, async (req, res) => {
    console.log("GET /api/profile requested by user ID:", req.user._id);
    try {
        const user = await User.findById(req.user._id).select('-password');
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
            role: user.role
        });
    } catch (error) {
        console.error("Error fetching user profile for ID:", req.user._id, error);
        res.status(500).json({ message: "Error fetching user profile." });
    }
});

app.put("/api/profile", authenticate, async (req, res) => {
    const { username, mobileNumber, address, profession } = req.body;
    console.log("PUT /api/profile requested by user ID:", req.user._id);
    console.log("Received profile data for update:", { username, mobileNumber, address, profession });

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            console.log("PUT /api/profile failed: User not found for ID:", req.user._id);
            return res.status(404).json({ message: "User not found." });
        }

        let changes = [];
        if (username && username !== user.username) {
            const existingUserWithNewUsername = await User.findOne({ username: username });
            if (existingUserWithNewUsername && existingUserWithNewUsername._id.toString() !== user._id.toString()) {
                console.log("PUT /api/profile failed: Username already taken:", username);
                return res.status(400).json({ message: "This username is already taken." });
            }
            changes.push(`username from '${user.username}' to '${username}'`);
            user.username = username;
        }
        if (mobileNumber !== undefined && mobileNumber !== user.mobileNumber) {
            changes.push(`mobile number from '${user.mobileNumber}' to '${mobileNumber}'`);
            user.mobileNumber = mobileNumber;
        }
        if (address !== undefined && address !== user.address) {
            changes.push(`address from '${user.address}' to '${address}'`);
            user.address = address;
        }
        if (profession !== undefined && profession !== user.profession) {
            changes.push(`profession from '${user.profession}' to '${profession}'`);
            user.profession = profession;
        }

        await user.save({ validateBeforeSave: true });

        if (changes.length > 0) {
            await Activity.create({
                userId: user._id,
                username: user.username,
                type: 'profile_update',
                description: `User ${user.username} updated profile: ${changes.join(', ')}.`
            });
        }

        console.log("Profile updated successfully for user ID:", req.user._id);
        res.json({
            success: true,
            message: "Profile updated successfully.",
            username: user.username,
            mobileNumber: user.mobileNumber,
            address: user.address,
            profession: user.profession,
            email: user.email,
            role: user.role
        });
    } catch (error) {
        console.error("Error updating user profile for ID:", req.user._id, error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Error updating user profile." });
    }
});

app.put("/api/profile/change-password", authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    console.log("PUT /api/profile/change-password requested by user ID:", req.user._id);

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Please provide both current and new passwords." });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long." });
    }

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect current password." });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;
        await user.save();
        console.log("Password updated successfully for user ID:", req.user._id);

        res.json({ success: true, message: "Password updated successfully." });
    } catch (error) {
        console.error("Error changing password for user ID:", req.user._id, error);
        res.status(500).json({ message: "Error changing password." });
    }
});


// --- FMP API Proxy Endpoints (for Home) ---
app.get('/stock-data/:symbol', authenticate, async (req, res) => {
    const { symbol } = req.params;
    const FMP_API_KEY = process.env.FMP_API_KEY;

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
            res.status(404).json({ message: "Stock data not found for symbol or invalid symbol." });
        }
    } catch (error) {
        console.error(`Error fetching stock data for ${symbol}:`, error.message);
        if (axios.isAxiosError(error)) {
            console.error('Axios error response data:', error.response?.data);
            console.error('Axios error status:', error.response?.status);
            if (error.response?.status === 401) {
                return res.status(500).json({ message: "FMP API key invalid or expired on server." });
            }
            if (error.response?.status === 403) {
                return res.status(429).json({ message: "FMP API rate limit reached or access forbidden." });
            }
        }
        res.status(500).json({ message: `Failed to fetch stock data for ${symbol} from external API.` });
    }
});

app.get('/api/stock-history/:symbol', authenticate, async (req, res) => {
    const { symbol } = req.params;
    const FMP_API_KEY = process.env.FMP_API_KEY;

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

        res.json(data.reverse());
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
            if (err.response?.status === 400) {
                return res.status(400).json({ error: "Invalid symbol or request for historical data." });
            }
        }
        res.status(500).json({ error: 'Failed to fetch historical stock data from API.' });
    }
});

app.get('/api/sector-performance', async (req, res) => {
    const FMP_API_KEY = process.env.FMP_API_KEY;

    if (!FMP_API_KEY) {
        console.error("FMP_API_KEY missing in .env for /api/sector-performance");
        return res.status(500).json({ message: "Server API key for FMP is not configured." });
    }

    try {
        const url = `https://financialmodelingprep.com/api/v3/sectors-performance?apikey=${FMP_API_KEY}`;
        const response = await axios.get(url);

        if (response.data && Array.isArray(response.data)) {
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

// --- Portfolio Management Endpoints ---
app.post("/portfolio/add", authenticate, async (req, res) => {
    const { symbol, quantity, purchasePrice, totalValue, portfolioName, dateAdded } = req.body;

    if (!symbol || !quantity || quantity <= 0 || !purchasePrice || purchasePrice <= 0 || !totalValue || totalValue <= 0 || !portfolioName) {
        return res.status(400).json({ message: "Missing required fields or invalid values for portfolio entry." });
    }

    try {
        const newHolding = {
            symbol: symbol.toUpperCase(),
            quantity: quantity,
            purchasePrice: purchasePrice,
            totalValue: totalValue,
            portfolioName: portfolioName,
            purchaseDate: new Date(dateAdded)
        };

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $push: { portfolio: newHolding } },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        // Log stock addition activity
        await Activity.create({
            userId: req.user._id,
            username: req.user.username,
            type: 'stock_added',
            description: `User ${req.user.username} added ${quantity} shares of ${symbol} to portfolio '${portfolioName}'.`
        });

        res.status(201).json({
            success: true,
            message: `${quantity} shares of ${symbol.toUpperCase()} added to portfolio '${portfolioName}'.`,
            portfolio: updatedUser.portfolio
        });

    } catch (error) {
        console.error("Error adding stock to portfolio:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Error adding stock to portfolio." });
    }
});

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

// NEW ENDPOINT: Fetch portfolio data for charts (stock counts and current values by portfolio name)
// NEW ENDPOINT: Fetch portfolio data for charts (stock counts and current values by portfolio name)
app.get("/api/portfolio-charts-data", authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('portfolio');
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const portfolio = user.portfolio;

        const portfolioStockCounts = {};
        const portfolioCurrentValues = {};
        const symbolsToFetch = new Set();

        portfolio.forEach(holding => {
            portfolioStockCounts[holding.portfolioName] = (portfolioStockCounts[holding.portfolioName] || 0) + holding.quantity;
            symbolsToFetch.add(holding.symbol);
        });

        const FMP_API_KEY = process.env.FMP_API_KEY;
        const currentPrices = {};
        const pricePromises = Array.from(symbolsToFetch).map(async (symbol) => {
            try {
                const response = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_API_KEY}`);
                if (response.data && response.data.length > 0) {
                    currentPrices[symbol] = response.data[0].price;
                } else {
                    currentPrices[symbol] = null;
                }
            } catch (error) {
                console.error(`Error fetching current price for ${symbol}:`, error.message);
                currentPrices[symbol] = null;
            }
        });
        await Promise.allSettled(pricePromises);

        portfolio.forEach(holding => {
            const currentPrice = currentPrices[holding.symbol] !== null ? currentPrices[holding.symbol] : holding.purchasePrice;
            const holdingCurrentValue = currentPrice * holding.quantity;
            portfolioCurrentValues[holding.portfolioName] = (portfolioCurrentValues[holding.portfolioName] || 0) + holdingCurrentValue;
        });

        res.json({
            stockCounts: portfolioStockCounts,
            currentValues: portfolioCurrentValues
        });

    } catch (error) {
        console.error("Error fetching portfolio chart data:", error);
        res.status(500).json({ message: "Error fetching portfolio chart data." });
    }
});


// NEW: Dedicated endpoint for Portfolio Unique Stock Counts
app.get("/api/portfolio/unique-stock-counts", authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('portfolio');
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const portfolioStockCounts = {};
        user.portfolio.forEach(holding => {
            // Count unique stock symbols per portfolioName
            if (!portfolioStockCounts[holding.portfolioName]) {
                portfolioStockCounts[holding.portfolioName] = new Set();
            }
            portfolioStockCounts[holding.portfolioName].add(holding.symbol);
        });

        // Convert Sets to their sizes
        const uniqueStockCountsResult = {};
        for (const portfolioName in portfolioStockCounts) {
            uniqueStockCountsResult[portfolioName] = portfolioStockCounts[portfolioName].size;
        }
        
        res.json(uniqueStockCountsResult);
    } catch (error) {
        console.error("Error fetching unique stock counts for portfolio:", error);
        res.status(500).json({ message: "Error fetching unique stock counts." });
    }
});

// NEW: Dedicated endpoint for Portfolio Total Values
app.get("/api/portfolio/total-values", authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('portfolio');
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const portfolio = user.portfolio;
        const portfolioCurrentValues = {};
        const symbolsToFetch = new Set();

        portfolio.forEach(holding => {
            symbolsToFetch.add(holding.symbol);
        });

        const FMP_API_KEY = process.env.FMP_API_KEY;
        const currentPrices = {};
        const pricePromises = Array.from(symbolsToFetch).map(async (symbol) => {
            try {
                const response = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_API_KEY}`);
                if (response.data && response.data.length > 0) {
                    currentPrices[symbol] = response.data[0].price;
                } else {
                    currentPrices[symbol] = null;
                }
            } catch (error) {
                console.error(`Error fetching current price for ${symbol} in total-values endpoint:`, error.message);
                currentPrices[symbol] = null;
            }
        });
        await Promise.allSettled(pricePromises);

        portfolio.forEach(holding => {
            const currentPrice = currentPrices[holding.symbol] !== null ? currentPrices[holding.symbol] : holding.purchasePrice;
            const holdingCurrentValue = currentPrice * holding.quantity;
            portfolioCurrentValues[holding.portfolioName] = (portfolioCurrentValues[holding.portfolioName] || 0) + holdingCurrentValue;
        });
        
        res.json(portfolioCurrentValues);
    } catch (error) {
        console.error("Error fetching portfolio total values:", error);
        res.status(500).json({ message: "Error fetching portfolio total values." });
    }
});


// NEW: Delete a specific stock holding from portfolio and record realized transaction
app.delete("/portfolio/delete-holding/:holdingId", authenticate, async (req, res) => {
    const { holdingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(holdingId)) {
        return res.status(400).json({ message: "Invalid holding ID." });
    }

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const holdingIndex = user.portfolio.findIndex(h => h._id.toString() === holdingId);
        if (holdingIndex === -1) {
            return res.status(404).json({ message: "Stock holding not found in portfolio." });
        }

        const holdingToRemove = user.portfolio[holdingIndex];

        // Fetch current price to calculate realized gain/loss
        let currentPriceResponse;
        try {
            currentPriceResponse = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${holdingToRemove.symbol}?apikey=${process.env.FMP_API_KEY}`);
        } catch (fmpError) {
            console.error(`Error fetching current price for ${holdingToRemove.symbol} during deletion:`, fmpError.message);
            // Even if price fetch fails, proceed with deletion, but record gain/loss as 0 or N/A
            currentPriceResponse = { data: [] };
        }

        const sellPrice = (currentPriceResponse.data && currentPriceResponse.data.length > 0) ?
            currentPriceResponse.data[0].price : holdingToRemove.purchasePrice; // Fallback to purchase price if current price not found
        const gainLoss = (sellPrice - holdingToRemove.purchasePrice) * holdingToRemove.quantity;

        // Add to realized transactions
        user.realizedTransactions.push({
            symbol: holdingToRemove.symbol,
            quantity: holdingToRemove.quantity,
            purchasePrice: holdingToRemove.purchasePrice,
            sellPrice: sellPrice,
            gainLoss: gainLoss,
            dateSold: new Date()
        });

        // Remove from portfolio
        user.portfolio.splice(holdingIndex, 1);
        await user.save();

        // Log stock removal activity
        await Activity.create({
            userId: req.user._id,
            username: req.user.username,
            type: 'stock_removed',
            description: `User ${req.user.username} removed ${holdingToRemove.quantity} shares of ${holdingToRemove.symbol} from portfolio '${holdingToRemove.portfolioName}'. Realized Gain/Loss: $${gainLoss.toFixed(2)}.`
        });

        res.json({ success: true, message: "Stock holding deleted successfully.", portfolio: user.portfolio });
    } catch (error) {
        console.error("Error deleting stock holding:", error);
        res.status(500).json({ message: "Error deleting stock holding." });
    }
});

// NEW: Delete an entire portfolio by name and record realized transactions
app.delete("/portfolio/delete-portfolio/:portfolioName", authenticate, async (req, res) => {
    const { portfolioName } = req.params;

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const holdingsToDelete = user.portfolio.filter(h => h.portfolioName === portfolioName);
        if (holdingsToDelete.length === 0) {
            return res.status(404).json({ message: `Portfolio "${portfolioName}" not found or empty.` });
        }

        for (const holding of holdingsToDelete) {
            let currentPriceResponse;
            try {
                currentPriceResponse = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${holding.symbol}?apikey=${process.env.FMP_API_KEY}`);
            } catch (fmpError) {
                console.error(`Error fetching current price for ${holding.symbol} during portfolio deletion:`, fmpError.message);
                currentPriceResponse = { data: [] };
            }

            const sellPrice = (currentPriceResponse.data && currentPriceResponse.data.length > 0) ?
                currentPriceResponse.data[0].price : holding.purchasePrice;
            const gainLoss = (sellPrice - holding.purchasePrice) * holding.quantity;

            user.realizedTransactions.push({
                symbol: holding.symbol,
                quantity: holding.quantity,
                purchasePrice: holding.purchasePrice,
                sellPrice: sellPrice,
                gainLoss: gainLoss,
                dateSold: new Date()
            });
        }

        // Remove all holdings for this portfolio name
        user.portfolio = user.portfolio.filter(h => h.portfolioName !== portfolioName);
        await user.save();

        // Log portfolio deletion activity
        await Activity.create({
            userId: req.user._id,
            username: req.user.username,
            type: 'portfolio_deleted',
            description: `User ${req.user.username} deleted portfolio '${portfolioName}' and all its holdings.`
        });

        res.json({ success: true, message: `Portfolio "${portfolioName}" and all its holdings deleted successfully.`, portfolio: user.portfolio });
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


// --- ADMIN ROUTES ---

// GET all users (for admin user profiles and total users count)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclude passwords
        res.json(users);
    } catch (error) {
        console.error('Error fetching all users for admin:', error);
        res.status(500).json({ message: 'Failed to fetch users.' });
    }
});

// DELETE a user
app.delete('/api/admin/delete-user/:userId', authenticateAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        const deletedUser = await User.findByIdAndDelete(userId);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        // Optionally, delete associated activities as well
        await Activity.deleteMany({ userId: userId });
        res.json({ success: true, message: `User ${deletedUser.username} deleted successfully.` });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Failed to delete user.' });
    }
});

// GET user growth data
app.get('/api/admin/user-growth', authenticateAdmin, async (req, res) => {
    try {
        const userGrowth = await User.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateFromParts: {
                            year: "$_id.year",
                            month: "$_id.month",
                            day: "$_id.day"
                        }
                    },
                    count: 1
                }
            },
            { $sort: { date: 1 } }
        ]);
        res.json(userGrowth);
    } catch (error) {
        console.error('Error fetching user growth data:', error);
        res.status(500).json({ message: 'Failed to fetch user growth data.' });
    }
});

// GET demanding stocks (count of stocks in all watchlists)
app.get('/api/admin/demanding-stocks', authenticateAdmin, async (req, res) => {
    try {
        const allUsers = await User.find().select('watchlists');
        const stockCounts = {};

        allUsers.forEach(user => {
            user.watchlists.flat().forEach(symbol => {
                stockCounts[symbol] = (stockCounts[symbol] || 0) + 1;
            });
        });

        // Convert to array of objects for easier display
        const demandingStocks = Object.entries(stockCounts).map(([symbol, count]) => ({ symbol, count }));
        res.json(demandingStocks.sort((a, b) => b.count - a.count)); // Sort by count descending
    } catch (error) {
        console.error('Error fetching demanding stocks:', error);
        res.status(500).json({ message: 'Failed to fetch demanding stocks.' });
    }
});

// Helper function to get current prices for a list of symbols
async function getCurrentPricesForSymbols(symbols) {
    const FMP_API_KEY = process.env.FMP_API_KEY;
    const prices = {};
    if (!symbols || symbols.length === 0) return prices;

    const uniqueSymbols = [...new Set(symbols)];
    const pricePromises = uniqueSymbols.map(async (symbol) => {
        try {
            const response = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_API_KEY}`);
            if (response.data && response.data.length > 0) {
                prices[symbol] = { price: response.data[0].price, name: response.data[0].name };
            } else {
                prices[symbol] = { price: null, name: 'N/A' };
            }
        } catch (error) {
            console.error(`Error fetching current price for ${symbol} in admin route:`, error.message);
            prices[symbol] = { price: null, name: 'N/A' };
        }
    });
    await Promise.allSettled(pricePromises);
    return prices;
}

// GET total portfolio values per user
app.get('/api/admin/total-portfolio-values', authenticateAdmin, async (req, res) => {
    try {
        const users = await User.find().select('username portfolio');
        const allSymbols = [...new Set(users.flatMap(user => user.portfolio.map(h => h.symbol)))];
        const currentPrices = await getCurrentPricesForSymbols(allSymbols);

        const portfolioValues = users.map(user => {
            let totalCurrentValue = 0;
            user.portfolio.forEach(holding => {
                const priceData = currentPrices[holding.symbol];
                const currentPrice = priceData?.price || holding.purchasePrice; // Fallback
                totalCurrentValue += (currentPrice * holding.quantity);
            });
            return {
                username: user.username,
                totalPortfolioValue: totalCurrentValue
            };
        });
        res.json(portfolioValues.sort((a, b) => b.totalPortfolioValue - a.totalPortfolioValue));
    } catch (error) {
        console.error('Error fetching total portfolio values for admin:', error);
        res.status(500).json({ message: 'Failed to fetch total portfolio values.' });
    }
});

// GET total returns (realized gain/loss) per user
app.get('/api/admin/total-returns', authenticateAdmin, async (req, res) => {
    try {
        const users = await User.find().select('username realizedTransactions');

        const totalReturns = users.map(user => {
            const totalRealizedGainLoss = user.realizedTransactions.reduce((sum, txn) => sum + txn.gainLoss, 0);
            const totalPurchaseValueRealized = user.realizedTransactions.reduce((sum, txn) => sum + (txn.purchasePrice * txn.quantity), 0);
            const percentageGainLoss = totalPurchaseValueRealized > 0 ? (totalRealizedGainLoss / totalPurchaseValueRealized) * 100 : 0;

            return {
                username: user.username,
                totalRealizedGainLoss: totalRealizedGainLoss,
                percentageGainLoss: percentageGainLoss
            };
        });
        res.json(totalReturns.sort((a, b) => b.totalRealizedGainLoss - a.totalRealizedGainLoss));
    } catch (error) {
        console.error('Error fetching total returns for admin:', error);
        res.status(500).json({ message: 'Failed to fetch total returns.' });
    }
});

// GET stock performance across all users' portfolios
app.get('/api/admin/stock-performance', authenticateAdmin, async (req, res) => {
    try {
        const users = await User.find().select('username portfolio');
        const allSymbols = [...new Set(users.flatMap(user => user.portfolio.map(h => h.symbol)))];
        const currentPrices = await getCurrentPricesForSymbols(allSymbols);

        const allHoldingsPerformance = [];
        users.forEach(user => {
            user.portfolio.forEach(holding => {
                const priceData = currentPrices[holding.symbol];
                const currentPrice = priceData?.price || holding.purchasePrice; // Fallback
                const gainLossValue = (currentPrice * holding.quantity) - (holding.purchasePrice * holding.quantity);
                const gainLossPercent = (holding.purchasePrice * holding.quantity) > 0 ?
                    (gainLossValue / (holding.purchasePrice * holding.quantity)) * 100 : 0;

                allHoldingsPerformance.push({
                    username: user.username,
                    symbol: holding.symbol,
                    companyName: priceData?.name || 'N/A', // Use fetched name or N/A
                    buyingPrice: holding.purchasePrice,
                    currentPrice: currentPrice,
                    quantity: holding.quantity,
                    gainLossValue: gainLossValue,
                    gainLossPercent: gainLossPercent
                });
            });
        });
        res.json(allHoldingsPerformance.sort((a, b) => b.gainLossValue - a.gainLossValue));
    } catch (error) {
        console.error('Error fetching stock performance for admin:', error);
        res.status(500).json({ message: 'Failed to fetch stock performance.' });
    }
});

// GET dashboard statistics
app.get('/api/admin/dashboard-stats', authenticateAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const allUsers = await User.find().select('portfolio realizedTransactions');

        let totalBuyingValue = 0;
        let totalSellingValue = 0;
        let totalStocksCount = 0; // Total number of individual stock holdings

        // Calculate total buying value (current portfolio cost basis)
        // and total number of stocks (sum of quantities)
        allUsers.forEach(user => {
            user.portfolio.forEach(holding => {
                totalBuyingValue += (holding.purchasePrice * holding.quantity);
                totalStocksCount += holding.quantity;
            });
            // Calculate total selling value from realized transactions
            user.realizedTransactions.forEach(txn => {
                totalSellingValue += (txn.sellPrice * txn.quantity);
            });
        });

        res.json({
            totalUsers,
            totalBuyingValue,
            totalSellingValue,
            totalStocksCount
        });

    } catch (error) {
        console.error('Error fetching dashboard statistics:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard statistics.' });
    }
});

// GET recent activities for dashboard
app.get('/api/admin/recent-activities', authenticateAdmin, async (req, res) => {
    try {
        // Fetch recent activities, e.g., last 20, sorted by date
        const activities = await Activity.find()
            .sort({ date: -1 })
            .limit(20)
            .select('username type description date');
        res.json(activities);
    } catch (error) {
        console.error('Error fetching recent activities for admin:', error);
        res.status(500).json({ message: 'Failed to fetch recent activities.' });
    }
});

// --- Static File Serving (THIS MUST BE LAST) ---
// Serve static assets from the 'client' directory
app.use(express.static(path.join(__dirname, "../client")));

// Catch-all for HTML files (optional, but good for direct URL access, e.g., /Markets.html)
app.get('/:pageName.html', (req, res) => {
    const { pageName } = req.params;
    const filePath = path.join(__dirname, `../client/${pageName}.html`);
    console.log(`Server is attempting to send file: ${filePath}`);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error serving ${pageName}.html:`, err);
            res.status(404).send('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>404 Not Found</title><style>body { font-family: sans-serif; text-align: center; margin-top: 50px; } h1 { color: #dc3545; }</style></head><body><h1>404 Page Not Found</h1><p>The page you requested could not be found.</p><a href="/">Go to Home</a></body></html>');
        }
    });
});


// Root route for the main page (e.g., when accessing http://localhost:5000/)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
