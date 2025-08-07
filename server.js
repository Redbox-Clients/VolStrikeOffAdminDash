require("dotenv").config();

const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bodyParser = require("body-parser");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// Check for required env vars
if (!JWT_SECRET || !MONGO_URI) {
  console.error("❌ Missing environment variables.");
  process.exit(1);
}

const app = express();

// Replace with your MongoDB Atlas connection string
const DB_NAME = "strike_offs";
const COLLECTION_NAME = "requests";
const COLLECTION_NAME_2 = "users";

let db, collection;

// Middleware
app.use(cors());
app.use(bodyParser.json());

app.use(express.static("public"));

// Connect to MongoDB
const client = new MongoClient(MONGO_URI);

client
  .connect()
  .then(() => {
    db = client.db(DB_NAME);
    collection = db.collection(COLLECTION_NAME);
    console.log("Connected to MongoDB Atlas");

    collection2 = db.collection(COLLECTION_NAME_2);
    console.log("Connected to MongoDB Atlas");

    // ✅ Start server only after DB connection is ready
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1); // Stop the app if DB can't connect
  });

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; // user.username is now available
    next();
  });
}

// ---- ROUTES ----

// POST /api/login
app.post("/api/login", async (req, res) => {
  const { name, password } = req.body;

  try {
    const user = await db.collection("users").findOne({ name });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const token = jwt.sign({ name }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/records?processed=true|false
app.get("/api/records", authenticateToken, async (req, res) => {
  try {
    const processed = req.query.processed === "true";
    const records = await collection.find({ processed }).toArray();
    res.json(records);
  } catch (err) {
    console.error("Error fetching records:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /api/records/:id/action
app.post("/api/records/:id/action", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  const webhookUrls = {
    processed:
      "https://redboxrob.app.n8n.cloud/webhook-test/058b1272-d6dc-4773-9429-d20a651e452a",
    unprocessed:
      "https://redboxrob.app.n8n.cloud/webhook-test/f28dd0fb-2522-4cc9-b930-84a444b743bf",
    delete: "https://n8n.example.com/webhook/delete",
  };

  if (!["processed", "unprocessed", "delete"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  try {
    const recordId = new ObjectId(id);
    if (action === "delete") {
      await collection.deleteOne({ _id: recordId });
    } else {
      const newStatus = action === "processed";
      await collection.updateOne(
        { _id: recordId },
        { $set: { processed: newStatus } }
      );
    }

    // Trigger webhook
    const webhookUrl = webhookUrls[action];
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId: id, action }),
    })
      .then((res) => res.json())
      .then((data) => console.log("Webhook response:", data))
      .catch((err) => console.error("Webhook error:", err));

    res.json({ success: true });
  } catch (err) {
    console.error("Action error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Server start
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
