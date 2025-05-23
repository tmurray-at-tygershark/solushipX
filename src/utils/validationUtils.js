export const isValidCustomerID = (id) => {
  if (!id) return false;
  // Regex to check for alphanumeric characters only (no spaces, no special characters)
  const regex = /^[a-zA-Z0-9]+$/;
  return regex.test(id);
};

export const isValidEmail = (email) => {
  if (!email) return false;
  const regex = /^\S+@\S+\.\S+$/;
  return regex.test(email);
};

// Add other validation functions here as needed 