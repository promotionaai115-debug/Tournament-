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


// ✅ Razorpay Setup (FIXED)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET
});


// ✅ Root Route
app.get("/", (req, res) => {
  res.send("🚀 Tournament Backend Running Successfully");
});


// ✅ Create Order API
app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const options = {
      amount: amount * 100,
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


// ✅ Verify Payment API (FIXED)
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


// ✅ Start Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});