document.getElementById("getRatesButton").addEventListener("click", async function() {
    console.log("Get Rates Clicked");
    const ratesOutput = document.getElementById("ratesOutput");
    const aiOutput = document.getElementById("aiOutput");
    const carrierRatesContainer = document.getElementById("carrierRates");
    const spinner = document.getElementById("loadingSpinner");

    ratesOutput.innerText = "Fetching shipping rates...";
    aiOutput.innerText = "Waiting for AI response...";
    carrierRatesContainer.innerHTML = ""; // Clear previous results
    spinner.style.display = "block";

    try {
        const response = await fetch("https://us-central1-solushipx.cloudfunctions.net/getShippingRates");

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        spinner.style.display = "none"; // Hide spinner once data is loaded

        if (data.success && data.rates) {
            // ✅ **Show Raw Response**
            ratesOutput.innerText = JSON.stringify(data.rates, null, 2);

            // ✅ **Process Carrier Rates**
            displayCarrierRates(data.rates);

            // ✅ **Start AI Analysis in Background**
            analyzeRatesWithAI(data.rates);
        } else {
            throw new Error("No valid rates received.");
        }
    } catch (error) {
        spinner.style.display = "none";
        ratesOutput.innerText = `🚨 Fetch Error: ${error.message}`;
        aiOutput.innerText = "Error contacting AI.";
        console.error("❌ Debugging Fetch Error:", error);
    }
});

function displayCarrierRates(ratesData) {
    const carrierRatesContainer = document.getElementById("carrierRates");

    if (!ratesData || !ratesData["soap:Envelope"] || !ratesData["soap:Envelope"]["soap:Body"]) {
        carrierRatesContainer.innerHTML = "<p class='text-danger'>⚠️ No valid carrier rates received.</p>";
        return;
    }

    let rateResponse = ratesData &&
    ratesData["soap:Envelope"] &&
    ratesData["soap:Envelope"]["soap:Body"] &&
    ratesData["soap:Envelope"]["soap:Body"][0] &&
    ratesData["soap:Envelope"]["soap:Body"][0].RateResponse &&
    ratesData["soap:Envelope"]["soap:Body"][0].RateResponse[0] &&
    ratesData["soap:Envelope"]["soap:Body"][0].RateResponse[0].RateResult &&
    ratesData["soap:Envelope"]["soap:Body"][0].RateResponse[0].RateResult[0] &&
    ratesData["soap:Envelope"]["soap:Body"][0].RateResponse[0].RateResult[0].AvailableRates &&
    ratesData["soap:Envelope"]["soap:Body"][0].RateResponse[0].RateResult[0].AvailableRates[0] &&
    ratesData["soap:Envelope"]["soap:Body"][0].RateResponse[0].RateResult[0].AvailableRates[0].WSRate2
    ? ratesData["soap:Envelope"]["soap:Body"][0].RateResponse[0].RateResult[0].AvailableRates[0].WSRate2
    : [];


    if (!rateResponse || rateResponse.length === 0) {
        carrierRatesContainer.innerHTML = "<p class='text-danger'>⚠️ No carrier rates available.</p>";
        return;
    }

    // ✅ **Loop through each carrier and create a UI block**
    rateResponse.forEach(carrier => {
        const carrierBlock = document.createElement("div");
        carrierBlock.classList.add("col-md-4"); // Grid Layout

        carrierBlock.innerHTML = `
                    <div class="carrier-card">
                        <div class="carrier-title">${carrier.CarrierName[0]}</div>
                        <p><strong>Total Charges:</strong> $${parseFloat(carrier.TotalCharges[0]).toFixed(2)}</p>
                        <p><strong>Freight Charges:</strong> $${parseFloat(carrier.FreightCharges[0]).toFixed(2)}</p>
                        <p><strong>Fuel Charges:</strong> $${parseFloat(carrier.FuelCharges[0]).toFixed(2)}</p>
                        <p><strong>Service Charges:</strong> $${parseFloat(carrier.ServiceCharges[0]).toFixed(2)}</p>
                        <p><strong>Transit Time:</strong> ${carrier.TransitTime[0]} days</p>
                        <p><strong>Quote Expiration:</strong> ${new Date(carrier.QuoteExpirationDateTime[0]).toLocaleDateString()}</p>
                    </div>
                `;

        carrierRatesContainer.appendChild(carrierBlock);
    });
}

async function analyzeRatesWithAI(ratesData) {
    const aiOutput = document.getElementById("aiOutput");
    aiOutput.innerText = "🔄 Sending data to AI for analysis...";

    try {
        const aiResponse = await fetch("https://us-central1-solushipx.cloudfunctions.net/analyzeRatesWithAI", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                rates: ratesData
            })
        });

        if (!aiResponse.ok) {
            throw new Error(`AI API Error: ${aiResponse.status} - ${aiResponse.statusText}`);
        }

        const aiData = await aiResponse.json();

        if (aiData && aiData.analysis) {
            aiOutput.innerText = aiData.analysis;
        } else {
            throw new Error("AI returned no valid analysis.");
        }
    } catch (error) {
        aiOutput.innerText = `🚨 AI Error: ${error.message}`;
        console.error("❌ AI Debugging Error:", error);
    }
}