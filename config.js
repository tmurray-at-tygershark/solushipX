require('dotenv').config();

if (!process.env.ESHIPPLUS_ACCESS_CODE) {
    console.error("⚠️  ERROR: .env file not loaded properly.");
    process.exit(1); // Stop execution if env variables are missing
}

const config = {
    eshipplus: {
        accessCode: process.env.ESHIPPLUS_ACCESS_CODE,
        username: process.env.ESHIPPLUS_USERNAME,
        password: process.env.ESHIPPLUS_PASSWORD,
        accessKey: process.env.ESHIPPLUS_ACCESS_KEY
    },
    server: {
        port: process.env.PORT || 3000
    }
};

module.exports = config;
