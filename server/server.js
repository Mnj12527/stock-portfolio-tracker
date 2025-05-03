const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const path = require("path");
const axios = require('axios');

dotenv.config(); // Load .env file once at the beginning

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from client - Adjust the path based on your project structure
// Assuming your client folder is in the project root:
app.use(express.static(path.join(__dirname, "../client")));

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
        type: [[String]], // 2D array of strings
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

// Sign-Up
app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;

    // Basic input validation
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
            { new: true } // To get the updated document
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        console.log("Watchlists updated successfully:", updatedUser.watchlists);
        res.json({ success: true, watchlists: updatedUser.watchlists });
    } catch (error) {
        console.error("Error updating watchlists:", error);
        res.status(500).json({ message: "Error updating watchlists." });
    }
});

const port = process.env.PORT || 5000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const MAX_RESULTS = 10;

console.log("YOUTUBE_API_KEY:", YOUTUBE_API_KEY); // Debug: Check if API key is loaded

app.get('/search', async (req, res) => {
    const { query } = req.query;

    console.log("Received query:", query); // Debug: Check the query

    if (!query) {
        console.log("Error: Missing search query");
        return res.status(400).json({ error: 'Missing search query.' });
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
                timeout: 10000 // Added timeout to the YouTube API request (10 seconds)
            }
        );
        console.log("YouTube API response:", response.data);
        const videos = response.data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails?.medium?.url,
            // No change here, the frontend will construct the correct URL
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));
        res.json(videos);
    } catch (error) {
        console.error('Error fetching videos from YouTube:', error);
        res.status(500).json({ error: 'Failed to fetch videos from YouTube.' });
    }
});

// Serve Videos.html (assuming it's in your client directory)
app.get('/Videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/Videos.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});