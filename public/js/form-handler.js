// Form validation and submission handler
class FormHandler {
    constructor() {
        this.form = document.getElementById('shipmentForm');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add real-time validation
        const inputs = document.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.validateField(input));
        });
    }

    validateField(field) {
        let isValid = true;
        const value = field.value.trim();

        // Remove existing error messages
        this.removeErrorMessage(field);

        // Required field validation
        if (field.hasAttribute('required') && !value) {
            this.showError(field, 'This field is required');
            isValid = false;
        }

        // Date validation
        if (field.type === 'date') {
            const date = new Date(value);
            const today = new Date();
            if (date < today) {
                this.showError(field, 'Date cannot be in the past');
                isValid = false;
            }
        }

        // Time window validation
        if (field.id === 'latestPickup' || field.id === 'latestDelivery') {
            const earliest = document.getElementById(field.id.replace('latest', 'earliest')).value;
            if (earliest && value && value < earliest) {
                this.showError(field, 'Latest time must be after earliest time');
                isValid = false;
            }
        }

        // Postal code validation
        if (field.id === 'fromPostal' || field.id === 'toPostal') {
            const prefix = field.id === 'fromPostal' ? 'from' : 'to';
            const country = document.getElementById(`${prefix}Country`).value;
            const postalCode = value;

            if (country === 'US' && !/^\d{5}(-\d{4})?$/.test(postalCode)) {
                this.showError(field, 'Invalid US postal code format (e.g., 12345 or 12345-6789)');
                isValid = false;
            } else if (country === 'Canada' && !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(postalCode)) {
                this.showError(field, 'Invalid Canadian postal code format (e.g., M5V 2H1)');
                isValid = false;
            }
        }

        return isValid;
    }

    showError(field, message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'invalid-feedback d-block';
        errorDiv.textContent = message;
        field.classList.add('is-invalid');
        field.parentNode.appendChild(errorDiv);
    }

    removeErrorMessage(field) {
        field.classList.remove('is-invalid');
        const errorDiv = field.parentNode.querySelector('.invalid-feedback');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    validateAddresses() {
        const fromFields = ['fromAddressLine1', 'fromCity', 'fromPostal'];
        const toFields = ['toAddressLine1', 'toCity', 'toPostal'];
        
        let isValid = true;
        
        [...fromFields, ...toFields].forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    validateShipmentInfo() {
        const requiredFields = [
            'shipmentType',
            'bookingReference',
            'shipmentDate',
            'earliestPickup',
            'latestPickup',
            'earliestDelivery',
            'latestDelivery'
        ];

        let isValid = true;

        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    validatePackages() {
        const packagesData = getPackagesData();
        return packagesData.length > 0 && packagesData.every(pkg => pkg.isValid);
    }

    async submitShipment() {
        if (!this.validateForm()) {
            this.showFormError('Please fix the errors before submitting');
            return;
        }

        const formData = this.gatherFormData();
        
        try {
            const response = await this.sendToAPI(formData);
            if (response.success) {
                this.showSuccess('Shipment created successfully!');
                // Redirect to shipment details or clear form
            } else {
                this.showFormError(response.message || 'Failed to create shipment');
            }
        } catch (error) {
            this.showFormError('An error occurred while creating the shipment');
            console.error('Submission error:', error);
        }
    }

    validateForm() {
        return (
            this.validateShipmentInfo() &&
            this.validateAddresses() &&
            this.validatePackages()
        );
    }

    gatherFormData() {
        return {
            shipmentInfo: {
                type: document.getElementById('shipmentType').value,
                bookingReference: document.getElementById('bookingReference').value,
                shipmentDate: document.getElementById('shipmentDate').value,
                pickupWindow: {
                    earliest: document.getElementById('earliestPickup').value,
                    latest: document.getElementById('latestPickup').value
                },
                deliveryWindow: {
                    earliest: document.getElementById('earliestDelivery').value,
                    latest: document.getElementById('latestDelivery').value
                }
            },
            fromAddress: {
                addressLine1: document.getElementById('fromAddressLine1').value,
                addressLine2: document.getElementById('fromAddressLine2').value,
                city: document.getElementById('fromCity').value,
                state: document.getElementById('fromStateSelect').value || document.getElementById('fromStateText').value,
                postalCode: document.getElementById('fromPostal').value,
                country: document.getElementById('fromCountry').value
            },
            toAddress: {
                addressLine1: document.getElementById('toAddressLine1').value,
                addressLine2: document.getElementById('toAddressLine2').value,
                city: document.getElementById('toCity').value,
                state: document.getElementById('toStateSelect').value || document.getElementById('toStateText').value,
                postalCode: document.getElementById('toPostal').value,
                country: document.getElementById('toCountry').value
            },
            packages: getPackagesData()
        };
    }

    async sendToAPI(formData) {
        // Replace with your actual API endpoint
        const API_ENDPOINT = '/api/shipments';
        
        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            return await response.json();
        } catch (error) {
            throw new Error('API request failed');
        }
    }

    showSuccess(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-success alert-dismissible fade show';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.querySelector('.container').insertAdjacentElement('afterbegin', alert);
    }

    showFormError(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger alert-dismissible fade show';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.querySelector('.container').insertAdjacentElement('afterbegin', alert);
    }

    saveAsDraft() {
        const formData = this.gatherFormData();
        localStorage.setItem('shipmentDraft', JSON.stringify(formData));
        this.showSuccess('Draft saved successfully!');
    }

    loadDraft() {
        const draft = localStorage.getItem('shipmentDraft');
        if (draft) {
            const formData = JSON.parse(draft);
            this.populateForm(formData);
            this.showSuccess('Draft loaded successfully!');
        }
    }

    populateForm(formData) {
        // Populate shipment info
        Object.entries(formData.shipmentInfo).forEach(([key, value]) => {
            if (typeof value === 'object') {
                Object.entries(value).forEach(([subKey, subValue]) => {
                    const fieldId = `${key}${subKey.charAt(0).toUpperCase() + subKey.slice(1)}`;
                    const field = document.getElementById(fieldId);
                    if (field) field.value = subValue;
                });
            } else {
                const field = document.getElementById(key);
                if (field) field.value = value;
            }
        });

        // Populate addresses
        ['from', 'to'].forEach(prefix => {
            const address = formData[`${prefix}Address`];
            Object.entries(address).forEach(([key, value]) => {
                const fieldId = `${prefix}${key.charAt(0).toUpperCase() + key.slice(1)}`;
                const field = document.getElementById(fieldId);
                if (field) field.value = value;
            });
        });

        // Populate packages
        packages = formData.packages;
        refreshPackagesList();
        updatePackageCount();
    }
}

// Initialize form handler
document.addEventListener('DOMContentLoaded', () => {
    window.formHandler = new FormHandler();
}); 