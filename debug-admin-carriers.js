// Debug script for AdminCarriers save functionality
// Run this in the browser console on the /admin/carriers page

console.log('🔧 AdminCarriers Debug Script Loaded');

// Override the form submission to add debugging
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 Looking for carrier form...');
    
    // Find the save button and add debugging
    const saveButton = document.querySelector('button[type="submit"]');
    if (saveButton) {
        console.log('✅ Found save button:', saveButton);
        console.log('Button disabled?', saveButton.disabled);
        console.log('Button text:', saveButton.textContent);
        
        // Add click listener
        saveButton.addEventListener('click', function(e) {
            console.log('🔥 SAVE BUTTON CLICKED!');
            console.log('Event:', e);
            console.log('Button disabled?', this.disabled);
            console.log('Form:', this.closest('form'));
        });
    } else {
        console.log('❌ Save button not found');
    }
    
    // Find the form and add debugging
    const form = document.querySelector('form');
    if (form) {
        console.log('✅ Found form:', form);
        form.addEventListener('submit', function(e) {
            console.log('🔥 FORM SUBMITTED!');
            console.log('Event:', e);
            console.log('Form data:', new FormData(this));
        });
    } else {
        console.log('❌ Form not found');
    }
});

// Alternative: Run this manually after page loads
function debugAdminCarriers() {
    console.log('🔍 Manual debug check...');
    
    const saveButton = document.querySelector('button[type="submit"]');
    const form = document.querySelector('form');
    
    console.log('Save button:', saveButton);
    console.log('Form:', form);
    
    if (saveButton) {
        console.log('Button disabled?', saveButton.disabled);
        console.log('Button text:', saveButton.textContent);
    }
    
    // Check for any required fields that might be empty
    const requiredFields = document.querySelectorAll('input[required]');
    console.log('Required fields:', requiredFields);
    
    requiredFields.forEach((field, index) => {
        console.log(`Required field ${index}:`, field.name, 'Value:', field.value, 'Valid:', field.checkValidity());
    });
}

console.log('🎯 To manually debug, run: debugAdminCarriers()'); 