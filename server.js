const express = require('express');
const { getShippingRates } = require('./solushipX/testEshipPlus'); // Import function

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (HTML, JS, CSS)
app.use(express.static('public'));

// API to call eShipPlus via testEshipPlus.js
app.get('/run-test', async (req, res) => {
    try {
        const data = await getShippingRates();
        res.json({ success: true, output: data });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
