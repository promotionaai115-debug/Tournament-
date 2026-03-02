require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Cashfree, CFEnvironment } = require("cashfree-pg");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ MongoDB Error:", err));

// ✅ Registration Schema (UNCHANGED)
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

// ✅ Cashfree Setup (SANDBOX MODE)
const cashfree = new Cashfree(
  CFEnvironment.SANDBOX,   // 👈 TEST MODE
  process.env.CF_APP_ID,
  process.env.CF_SECRET_KEY
);

// ✅ Root Route
app.get("/", (req, res) => {
  res.send("🚀 Tournament Backend Running Successfully (Cashfree Test Mode)");
});


// ✅ Create Order API
app.post("/create-order", async (req, res) => {
  try {

    const { amount, phone } = req.body;

    const request = {
      order_amount: Number(amount),
      order_currency: "INR",
      customer_details: {
        customer_id: "user_" + Date.now(),
        customer_phone: phone
      }
    };

    const response = await cashfree.PGCreateOrder(request);

    res.json({
      payment_session_id: response.data.payment_session_id,
      orderId: response.data.order_id
    });

  } catch (error) {
    console.log("Order Error:", error);
    res.status(500).json({ error: "Order creation failed" });
  }
});


// ✅ Webhook Verification
app.post("/cashfree-webhook", async (req, res) => {
  try {

    const data = req.body;

    if (data.type === "PAYMENT_SUCCESS_WEBHOOK") {

      const payment = data.data;

      // 🔒 Duplicate Payment Check
      const exists = await Registration.findOne({
        paymentId: payment.cf_payment_id
      });

      if (exists) {
        return res.status(200).send("Already Registered");
      }

      await Registration.create({
        matchId: payment.order_meta?.matchId || "",
        teamName: payment.order_meta?.teamName || "",
        players: payment.order_meta?.players || [],
        phone: payment.customer_details.customer_phone,
        paymentId: payment.cf_payment_id,
        orderId: payment.order_id,
        amount: payment.order_amount
      });

      console.log("✅ Test Payment Saved in MongoDB");
    }

    res.status(200).send("Webhook Received");

  } catch (error) {
    console.log("Webhook Error:", error);
    res.status(500).json({ error: "Webhook failed" });
  }
});


// ✅ Admin Panel Route (UNCHANGED)
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
