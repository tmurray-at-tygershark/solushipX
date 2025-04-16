// Determine if this is for origin or destination based on currentField and context
const isDestination = currentField === 'destination' || currentField.startsWith('to') || selectedCustomer !== null;

// Set the current field based on the address type
if (!isDestination) {
    setCurrentField('origin');
}

const addressType = isDestination ? 'toAddress' : 'fromAddress';
const addressLabel = isDestination ? 'delivery' : 'pickup';

// Determine the next step based on whether this was origin or destination
let followUpMessage;
if (isDestination) {
    // If this was the destination, we're done with address collection
    followUpMessage = {
        id: Date.now() + 2,
        text: "Great! Now let's get the package details. What's the weight of your package in pounds?",
        sender: 'assistant'
    };
    setCurrentField('packageWeight');
} else {
    // If this was the origin, prompt for destination
    followUpMessage = {
        id: Date.now() + 2,
        text: "Now, let's find the destination. Please search for a customer to deliver to.",
        sender: 'assistant'
    };
    setCurrentField('destination');
    setShowCustomerSearch(true);
    fetchCustomers();
} 