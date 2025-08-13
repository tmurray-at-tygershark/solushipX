import { getFirestore, doc, setDoc, getDoc, collection } from 'firebase/firestore';
import { app } from './firebase';

export const db = getFirestore(app);

// Function to save customer data
export const saveCustomerData = async (userId, customerData) => {
  try {
    const customerRef = doc(db, 'customers', userId);
    await setDoc(customerRef, {
      ...customerData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    });
    return { success: true };
  } catch (error) {
    console.error('Error saving customer data:', error);
    return { success: false, error };
  }
};

// Function to get customer data
export const getCustomerData = async (userId) => {
  try {
    const customerRef = doc(db, 'customers', userId);
    const customerSnap = await getDoc(customerRef);
    
    if (customerSnap.exists()) {
      return { success: true, data: customerSnap.data() };
    } else {
      return { success: false, error: 'Customer not found' };
    }
  } catch (error) {
    console.error('Error getting customer data:', error);
    return { success: false, error };
  }
};

// Function to update customer data
export const updateCustomerData = async (userId, updates) => {
  try {
    const customerRef = doc(db, 'customers', userId);
    await setDoc(customerRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error updating customer data:', error);
    return { success: false, error };
  }
}; 