const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const path = require("path");

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from client
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
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId);
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Sign-Up
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(400).json({ message: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, email, password: hashedPassword });
  await newUser.save();

  res.json({ success: true, message: "User registered successfully" });
});

// Sign-In
app.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

  res.status(200).json({ message: "Login successful", token });
});

// Get Watchlists
app.get("/watchlists", authenticate, async (req, res) => {
  console.log("Getting watchlists for user ID:", req.user._id);
  res.json({ watchlists: req.user.watchlists });
});

// Update Watchlists
app.put("/watchlists", authenticate, async (req, res) => {
  const { watchlists } = req.body;
  console.log("Updating watchlists for user ID:", req.user._id);

  if (!Array.isArray(watchlists) || watchlists.length !== 3) {
    console.error("Invalid watchlists format");
    return res.status(400).json({ message: "Invalid watchlists format" });
  }

  try {
    // Update the user with new watchlists
    req.user.watchlists = watchlists;
    await req.user.save();

    // Log the success and return the updated watchlists
    console.log("Watchlists updated successfully:", req.user.watchlists);
    res.json({ success: true, watchlists: req.user.watchlists });
  } catch (error) {
    console.error("Error updating watchlists:", error); // Log the error
    res.status(500).json({ message: "Error updating watchlists" });
  }
});

// '/Videos.html' या राऊटसाठी व्हिडिओ पेज सर्व्ह करा
app.get('/Videos.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/Videos.html'));
});

// Start Server
app.listen(5000, () => console.log("Server running on http://localhost:5000"));