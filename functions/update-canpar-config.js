const admin = require("firebase-admin");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function updateCanparConfig() {
    try {
        console.log("Updating CANPAR carrier configuration...");
        const carriersRef = db.collection("carriers");
        const snapshot = await carriersRef.where("carrierID", "==", "CANPAR").get();

        if (snapshot.empty) {
            console.error("CANPAR carrier not found");
            return;
        }

        const doc = snapshot.docs[0];
        await doc.ref.update({
            "apiCredentials.endpoints": {
                rate: "canshipws/services/CanparRatingService/rateShipment",
                cancel: "canshipws/services/CanparAddonsService/voidShipment",
                labels: "canshipws/services/CanparAddonsService/getLabels",
                status: "canshipws/services/CanparAddonsService/getShipment",
                tracking: "canshipws/services/CanparAddonsService/trackShipment"
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("✅ CANPAR carrier configuration updated");
    } catch (error) {
        console.error("Error:", error);
    } finally {
        process.exit(0);
    }
}

updateCanparConfig(); 