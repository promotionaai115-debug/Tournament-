require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ MongoDB Error:", err));


// ✅ Registration Schema
const RegistrationSchema = new mongoose.Schema({
  matchId: String,
  teamName: String,
  players: Array,
  phone: String,
  paymentId: String,
  orderId: String,
  amount: Number,
  createdAt: { type: Date, default: Date.now }
});

const Registration = mongoose.model("Registration", RegistrationSchema);


// ✅ Razorpay Setup
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET
});


// ✅ Root Route
app.get("/", (req, res) => {
  res.send("🚀 Tournament Backend Running Successfully");
});


// ✅ Create Order API (Same)
app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const options = {
      amount: Number(amount) * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    };

    const order = await razorpay.orders.create(options);
    res.json(order);

  } catch (error) {
    console.log("Order Error:", error);
    res.status(500).json({ error: "Order creation failed" });
  }
});


// ✅ Verify Payment API (Same + Duplicate Block Added)
app.post("/verify-payment", async (req, res) => {
  try {

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      formData
    } = req.body;

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

if (generated_signature === razorpay_signature) {
      // 🔒 Duplicate Payment Check
      const exists = await Registration.findOne({
        paymentId: razorpay_payment_id
      });

      if (exists) {
        return res.status(400).json({ error: "Already Registered" });
      }

      await Registration.create({
        matchId: formData.matchId,
        teamName: formData.teamName,
        players: formData.players,
        phone: formData.phone,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: formData.amount
      });

      res.json({ success: true });

    } else {
      res.status(400).json({ success: false });
    }

  } catch (error) {
    console.log("Verification Error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});


// ✅ NEW: Admin Panel Data Route (Added Only)
app.get("/admin-data", async (req, res) => {
  try {
    const data = await Registration.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch data" });
  }
});


// ✅ Start Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});