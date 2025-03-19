// Form validation and submission handler
class FormHandler {
    constructor() {
        this.form = document.getElementById('shipmentForm');
        this.setupEventListeners();
        this.testData = {
            shipmentInfo: {
                type: 'ltl',
                bookingReference: 'TEST-' + new Date().toISOString().slice(0,10),
                shipmentDate: new Date(Date.now() + 86400000).toISOString().slice(0,10), // Tomorrow
                pickupWindow: {
                    earliest: '09:00',
                    latest: '17:00'
                },
                deliveryWindow: {
                    earliest: '09:00',
                    latest: '17:00'
                }
            },
            fromAddress: {
                company: 'Tech Solutions Inc.',
                contactName: 'John Smith',
                contactPhone: '416-555-0123',
                contactEmail: 'john.smith@techsolutions.com',
                contactFax: '416-555-0124',
                addressLine1: '123 Technology Drive',
                addressLine2: 'Suite 400',
                city: 'Toronto',
                state: 'ON',
                postalCode: 'M5V 2H1',
                country: 'CA',
                specialInstructions: 'Please call before pickup'
            },
            toAddress: {
                company: 'Digital Dynamics LLC',
                contactName: 'Sarah Johnson',
                contactPhone: '212-555-0456',
                contactEmail: 'sarah.j@digitaldynamics.com',
                contactFax: '212-555-0457',
                addressLine1: '456 Innovation Avenue',
                addressLine2: 'Floor 12',
                city: 'New York',
                state: 'NY',
                postalCode: '10001',
                country: 'US',
                specialInstructions: 'Loading dock available 9AM-5PM'
            },
            packages: [{
                description: 'Server Equipment',
                quantity: 2,
                weight: 150,
                length: 48,
                width: 40,
                height: 36,
                freightClass: '92.5',
                value: 5000.00,
                stackable: false
            },
            {
                description: 'Network Switches',
                quantity: 1,
                weight: 75,
                length: 24,
                width: 20,
                height: 12,
                freightClass: '77.5',
                value: 2500.00,
                stackable: true
            }]
        };
        this.formData = null;
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
        let isValid = true;
        let errorMessages = [];

        if (packagesData.length === 0) {
            isValid = false;
            errorMessages.push('At least one package is required');
        } else {
            packagesData.forEach((pkg, index) => {
                if (!pkg.isValid) {
                    isValid = false;
                    const packageErrors = [];
                    
                    // Check each field
                    if (!pkg.description) packageErrors.push('Description');
                    if (!pkg.quantity || pkg.quantity <= 0) packageErrors.push('Quantity');
                    if (!pkg.weight || pkg.weight <= 0) packageErrors.push('Weight');
                    if (!pkg.length || pkg.length <= 0) packageErrors.push('Length');
                    if (!pkg.width || pkg.width <= 0) packageErrors.push('Width');
                    if (!pkg.height || pkg.height <= 0) packageErrors.push('Height');
                    if (!pkg.freightClass) packageErrors.push('Freight Class');
                    if (!pkg.value || pkg.value <= 0) packageErrors.push('Declared Value');

                    // Add error message with specific fields
                    errorMessages.push(`Package ${index + 1} has invalid fields: ${packageErrors.join(', ')}`);
                }
            });
        }

        // Show comprehensive error message if there are validation errors
        if (!isValid) {
            const errorMessage = 'Please fix the following package errors:\n' + errorMessages.join('\n');
            this.showFormError(errorMessage);
        }

        return isValid;
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
        let isValid = true;
        let errorMessages = [];

        // Validate Shipment Information
        const shipmentFields = [
            { id: 'shipmentType', label: 'Shipment Type' },
            { id: 'bookingReference', label: 'Booking Reference' },
            { id: 'shipmentDate', label: 'Shipment Date' },
            { id: 'earliestPickup', label: 'Earliest Pickup Time' },
            { id: 'latestPickup', label: 'Latest Pickup Time' },
            { id: 'earliestDelivery', label: 'Earliest Delivery Time' },
            { id: 'latestDelivery', label: 'Latest Delivery Time' }
        ];

        shipmentFields.forEach(field => {
            const element = document.getElementById(field.id);
            if (!element.value.trim()) {
                isValid = false;
                errorMessages.push(`${field.label} is required`);
                this.showError(element, `${field.label} is required`);
            } else {
                this.removeErrorMessage(element);
            }
        });

        // Validate Addresses
        const addressFields = [
            { prefix: 'from', label: 'Ship From' },
            { prefix: 'to', label: 'Ship To' }
        ];

        addressFields.forEach(addr => {
            const requiredFields = [
                { id: `${addr.prefix}Company`, label: 'Company Name' },
                { id: `${addr.prefix}AddressLine1`, label: 'Address Line 1' },
                { id: `${addr.prefix}City`, label: 'City' },
                { id: `${addr.prefix}Postal`, label: 'Postal Code' },
                { id: `${addr.prefix}Country`, label: 'Country' },
                { id: `${addr.prefix}ContactName`, label: 'Contact Name' },
                { id: `${addr.prefix}Phone`, label: 'Phone Number' },
                { id: `${addr.prefix}Email`, label: 'Email' }
            ];

            requiredFields.forEach(field => {
                const element = document.getElementById(field.id);
                if (!element.value.trim()) {
                    isValid = false;
                    errorMessages.push(`${addr.label} - ${field.label} is required`);
                    this.showError(element, `${field.label} is required`);
                } else {
                    this.removeErrorMessage(element);
                }
            });

            // Validate state/province based on country
            const country = document.getElementById(`${addr.prefix}Country`).value;
            const stateSelect = document.getElementById(`${addr.prefix}StateSelect`);
            const stateText = document.getElementById(`${addr.prefix}StateText`);
            
            if (country === 'US' || country === 'CA') {
                if (!stateSelect.value) {
                    isValid = false;
                    errorMessages.push(`${addr.label} - State/Province is required`);
                    this.showError(stateSelect, 'State/Province is required');
                } else {
                    this.removeErrorMessage(stateSelect);
                }
            } else {
                if (!stateText.value.trim()) {
                    isValid = false;
                    errorMessages.push(`${addr.label} - State/Province is required`);
                    this.showError(stateText, 'State/Province is required');
                } else {
                    this.removeErrorMessage(stateText);
                }
            }
        });

        // Validate Packages
        const packagesData = getPackagesData();
        if (packagesData.length === 0) {
            isValid = false;
            errorMessages.push('At least one package is required');
        } else {
            packagesData.forEach((pkg, index) => {
                if (!pkg.isValid) {
                    isValid = false;
                    const packageErrors = [];
                    
                    // Check each field
                    if (!pkg.description) packageErrors.push('Description');
                    if (!pkg.quantity || pkg.quantity <= 0) packageErrors.push('Quantity');
                    if (!pkg.weight || pkg.weight <= 0) packageErrors.push('Weight');
                    if (!pkg.length || pkg.length <= 0) packageErrors.push('Length');
                    if (!pkg.width || pkg.width <= 0) packageErrors.push('Width');
                    if (!pkg.height || pkg.height <= 0) packageErrors.push('Height');
                    if (!pkg.freightClass) packageErrors.push('Freight Class');
                    if (!pkg.value || pkg.value <= 0) packageErrors.push('Declared Value');

                    // Add error message with specific fields
                    errorMessages.push(`Package ${index + 1} has invalid fields: ${packageErrors.join(', ')}`);
                }
            });
        }

        // Show comprehensive error message if there are validation errors
        if (!isValid) {
            const errorMessage = 'Please fix the following errors:\n' + errorMessages.join('\n');
            this.showFormError(errorMessage);
        }

        return isValid;
    }

    gatherFormData() {
        return {
            bookingReferenceNumber: document.getElementById('bookingReference').value,
            bookingReferenceNumberType: "Shipment",
            shipmentBillType: "DefaultLogisticsPlus",
            shipmentDate: new Date(document.getElementById('shipmentDate').value).toISOString(),
            pickupWindow: {
                earliest: document.getElementById('earliestPickup').value,
                latest: document.getElementById('latestPickup').value
            },
            deliveryWindow: {
                earliest: document.getElementById('earliestDelivery').value,
                latest: document.getElementById('latestDelivery').value
            },
            fromAddress: this.gatherAddressData('from'),
            toAddress: this.gatherAddressData('to'),
            items: getPackageItems()
        };
    }

    gatherAddressData(prefix) {
        return {
            company: document.getElementById(`${prefix}Company`).value,
            street: document.getElementById(`${prefix}AddressLine1`).value,
            street2: document.getElementById(`${prefix}AddressLine2`).value || '',
            postalCode: document.getElementById(`${prefix}Postal`).value,
            city: document.getElementById(`${prefix}City`).value,
            state: document.getElementById(`${prefix}StateSelect`).value || document.getElementById(`${prefix}StateText`).value,
            country: document.getElementById(`${prefix}Country`).value,
            contactName: document.getElementById(`${prefix}ContactName`).value,
            contactPhone: document.getElementById(`${prefix}Phone`).value,
            contactEmail: document.getElementById(`${prefix}Email`).value,
            contactFax: document.getElementById(`${prefix}Fax`).value || '',
            specialInstructions: document.getElementById(`${prefix}Instructions`).value || ''
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

    async loadDraft() {
        try {
            // Hardcoded draft data for testing
            const draftData = {
                shipmentType: 'FTL',
                bookingReferenceNumber: 'REF123456',
                shipmentDate: '2025-03-20',
                fromAddress: {
                    companyName: 'Sender Company',
                    addressLine1: '123 Sender Street',
                    addressLine2: 'Suite 100',
                    city: 'Toronto',
                    state: 'ON',
                    postalCode: 'M5V 2L7',
                    country: 'CA',
                    contactName: 'John Sender',
                    email: 'john.sender@example.com',
                    phone: '647-262-1493',
                    fax: '647-262-1494',
                    specialInstructions: 'Please call before pickup'
                },
                toAddress: {
                    companyName: 'Receiver Company',
                    addressLine1: '456 Receiver Avenue',
                    addressLine2: 'Unit 200',
                    city: 'Vancouver',
                    state: 'BC',
                    postalCode: 'V6B 2Y9',
                    country: 'CA',
                    contactName: 'Jane Receiver',
                    email: 'jane.receiver@example.com',
                    phone: '604-555-0123',
                    fax: '604-555-0124',
                    specialInstructions: 'Loading dock available 9AM-5PM'
                },
                earliestPickup: '05:00',
                latestPickup: '17:00',
                earliestDelivery: '09:00',
                latestDelivery: '22:00',
                packages: [
                    {
                        description: 'Pallet',
                        quantity: 1,
                        weight: 500,
                        length: 48,
                        width: 40,
                        height: 48,
                        freightClass: '400',
                        declaredValue: 1000,
                        isStackable: true
                    }
                ]
            };

            // Populate form fields
            document.getElementById('shipmentType').value = draftData.shipmentType;
            document.getElementById('bookingReference').value = draftData.bookingReferenceNumber;
            document.getElementById('shipmentDate').value = draftData.shipmentDate;
            document.getElementById('earliestPickup').value = draftData.earliestPickup;
            document.getElementById('latestPickup').value = draftData.latestPickup;
            document.getElementById('earliestDelivery').value = draftData.earliestDelivery;
            document.getElementById('latestDelivery').value = draftData.latestDelivery;

            // Populate Ship From section
            document.getElementById('fromCompany').value = draftData.fromAddress.companyName;
            document.getElementById('fromAddressLine1').value = draftData.fromAddress.addressLine1;
            document.getElementById('fromAddressLine2').value = draftData.fromAddress.addressLine2;
            document.getElementById('fromCity').value = draftData.fromAddress.city;
            document.getElementById('fromPostal').value = draftData.fromAddress.postalCode;
            document.getElementById('fromCountry').value = draftData.fromAddress.country;
            document.getElementById('fromContactName').value = draftData.fromAddress.contactName;
            document.getElementById('fromPhone').value = draftData.fromAddress.phone;
            document.getElementById('fromEmail').value = draftData.fromAddress.email;
            document.getElementById('fromFax').value = draftData.fromAddress.fax;
            document.getElementById('fromInstructions').value = draftData.fromAddress.specialInstructions;

            // Populate Ship To section
            document.getElementById('toCompany').value = draftData.toAddress.companyName;
            document.getElementById('toAddressLine1').value = draftData.toAddress.addressLine1;
            document.getElementById('toAddressLine2').value = draftData.toAddress.addressLine2;
            document.getElementById('toCity').value = draftData.toAddress.city;
            document.getElementById('toPostal').value = draftData.toAddress.postalCode;
            document.getElementById('toCountry').value = draftData.toAddress.country;
            document.getElementById('toContactName').value = draftData.toAddress.contactName;
            document.getElementById('toPhone').value = draftData.toAddress.phone;
            document.getElementById('toEmail').value = draftData.toAddress.email;
            document.getElementById('toFax').value = draftData.toAddress.fax;
            document.getElementById('toInstructions').value = draftData.toAddress.specialInstructions;

            // Update state/province fields based on country
            this.updateStateField('from', draftData.fromAddress.state, draftData.fromAddress.country);
            this.updateStateField('to', draftData.toAddress.state, draftData.toAddress.country);

            // Clear existing packages
            const packagesList = document.getElementById('packagesList');
            packagesList.innerHTML = '';

            // Add packages
            draftData.packages.forEach(pkg => {
                const packageId = addPackage();
                document.getElementById(`packageDescription_${packageId}`).value = pkg.description;
                document.getElementById(`packageQuantity_${packageId}`).value = pkg.quantity;
                document.getElementById(`packageWeight_${packageId}`).value = pkg.weight;
                document.getElementById(`packageLength_${packageId}`).value = pkg.length;
                document.getElementById(`packageWidth_${packageId}`).value = pkg.width;
                document.getElementById(`packageHeight_${packageId}`).value = pkg.height;
                document.getElementById(`packageFreightClass_${packageId}`).value = pkg.freightClass;
                document.getElementById(`packageValue_${packageId}`).value = pkg.declaredValue;
                document.getElementById(`packageStackable_${packageId}`).checked = pkg.isStackable;
            });

            // Update package count
            updatePackageCount();

            // Trigger form validation
            this.validateForm();

            // Show success message
            this.showSuccess('Draft loaded successfully');
        } catch (error) {
            console.error('Error loading draft:', error);
            this.showFormError('Failed to load draft: ' + error.message);
        }
    }

    populateForm(formData) {
        // Shipment Info
        document.getElementById('shipmentType').value = formData.shipmentInfo.type;
        document.getElementById('bookingReference').value = formData.shipmentInfo.bookingReference;
        document.getElementById('shipmentDate').value = formData.shipmentInfo.shipmentDate;
        document.getElementById('earliestPickup').value = formData.shipmentInfo.earliestPickup;
        document.getElementById('latestPickup').value = formData.shipmentInfo.latestPickup;
        document.getElementById('earliestDelivery').value = formData.shipmentInfo.earliestDelivery;
        document.getElementById('latestDelivery').value = formData.shipmentInfo.latestDelivery;

        // From Address
        this.populateAddressSection('from', formData.fromAddress);

        // To Address
        this.populateAddressSection('to', formData.toAddress);

        // Reset packages state
        resetPackages();

        // Add and populate packages
        if (formData.packages && formData.packages.length > 0) {
            formData.packages.forEach(pkg => {
                const packageId = addPackage();
                document.getElementById(`packageDescription_${packageId}`).value = pkg.description;
                document.getElementById(`packageQuantity_${packageId}`).value = pkg.quantity;
                document.getElementById(`packageWeight_${packageId}`).value = pkg.weight;
                document.getElementById(`packageLength_${packageId}`).value = pkg.length;
                document.getElementById(`packageWidth_${packageId}`).value = pkg.width;
                document.getElementById(`packageHeight_${packageId}`).value = pkg.height;
                document.getElementById(`packageFreightClass_${packageId}`).value = pkg.freightClass;
                document.getElementById(`packageValue_${packageId}`).value = pkg.value;
                document.getElementById(`packageStackable_${packageId}`).checked = pkg.stackable;
            });
        }

        updatePackageCount();
        
        // Validate the form after populating
        this.validateForm();
    }

    populateAddressSection(prefix, addressData) {
        // Set the country first to trigger the state/province list update
        const countrySelect = document.getElementById(`${prefix}Country`);
        countrySelect.value = addressData.country;
        // Trigger the change event to update state/province list
        countrySelect.dispatchEvent(new Event('change'));

        // Company and contact info
        document.getElementById(`${prefix}Company`).value = addressData.company;
        document.getElementById(`${prefix}ContactName`).value = addressData.contactName;
        document.getElementById(`${prefix}Phone`).value = addressData.contactPhone;
        document.getElementById(`${prefix}Email`).value = addressData.contactEmail;
        document.getElementById(`${prefix}Fax`).value = addressData.contactFax;

        // Address fields
        document.getElementById(`${prefix}AddressLine1`).value = addressData.addressLine1;
        document.getElementById(`${prefix}AddressLine2`).value = addressData.addressLine2;
        document.getElementById(`${prefix}City`).value = addressData.city;
        document.getElementById(`${prefix}Postal`).value = addressData.postalCode;
        document.getElementById(`${prefix}Instructions`).value = addressData.specialInstructions;

        // Set state/province after a short delay to ensure the dropdown has been populated
        setTimeout(() => {
            const stateSelect = document.getElementById(`${prefix}StateSelect`);
            const stateText = document.getElementById(`${prefix}StateText`);
            
            if (addressData.country === 'US' || addressData.country === 'CA') {
                stateSelect.value = addressData.state;
                stateSelect.classList.remove('hidden');
                stateText.classList.add('hidden');
            } else {
                stateText.value = addressData.state;
                stateText.classList.remove('hidden');
                stateSelect.classList.add('hidden');
            }
        }, 100);
    }

    updateStateField(prefix, stateValue, countryValue) {
        const stateSelect = document.getElementById(`${prefix}StateSelect`);
        const stateText = document.getElementById(`${prefix}StateText`);
        
        if (countryValue === 'US' || countryValue === 'CA') {
            stateSelect.value = stateValue;
            stateSelect.classList.remove('hidden');
            stateText.classList.add('hidden');
        } else {
            stateText.value = stateValue;
            stateText.classList.remove('hidden');
            stateSelect.classList.add('hidden');
        }
    }

    async calculateRates(event) {
        event.preventDefault();
        
        if (!this.validateForm()) {
            this.showFormError('Please fix the errors before calculating rates');
            return;
        }

        // Show loading state
        const submitBtn = event.target;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Calculating...';
        submitBtn.disabled = true;

        try {
            const requestData = this.gatherFormData();
            const response = await fetch('https://getshippingrates-xedyh5vw7a-uc.a.run.app/rates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                this.displayRates(result.data);
            } else {
                throw new Error(result.error?.message || 'Invalid response format from rates API');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showFormError('Error calculating rates: ' + error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    displayRates(ratesData) {
        const ratesSection = document.getElementById('ratesSection');
        const ratesContainer = document.getElementById('ratesContainer');
        
        // Clear existing rates
        ratesContainer.innerHTML = '';
        
        // Show the rates section
        ratesSection.style.display = 'block';
        
        // Sort rates by total charge
        const rates = ratesData.sort((a, b) => parseFloat(a.totalCharges) - parseFloat(b.totalCharges));
        
        rates.forEach(rate => {
            const rateCard = document.createElement('div');
            rateCard.className = 'col-md-4 mb-4';
            rateCard.innerHTML = `
                <div class="card h-100">
                    <div class="card-header bg-primary text-white">
                        <h5 class="card-title mb-0">${rate.carrier}</h5>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <h6 class="text-muted">Transit Time</h6>
                            <p class="mb-0">${rate.transitDays} Days</p>
                        </div>
                        <div class="mb-3">
                            <h6 class="text-muted">Service Level</h6>
                            <p class="mb-0">${rate.serviceLevel}</p>
                        </div>
                        <div class="mb-3">
                            <h6 class="text-muted">Charges Breakdown</h6>
                            <ul class="list-unstyled">
                                <li>Base Rate: $${parseFloat(rate.baseRate).toFixed(2)}</li>
                                <li>Fuel Surcharge: $${parseFloat(rate.fuelSurcharge).toFixed(2)}</li>
                                ${rate.accessorials ? rate.accessorials.map(acc => 
                                    `<li>${acc.description}: $${parseFloat(acc.amount).toFixed(2)}</li>`
                                ).join('') : ''}
                            </ul>
                        </div>
                        <div class="mb-3">
                            <h6 class="text-muted">Total Charges</h6>
                            <h4 class="text-primary mb-0">$${parseFloat(rate.totalCharges).toFixed(2)}</h4>
                        </div>
                        ${rate.guaranteedService ? `
                            <div class="mb-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="guarantee_${rate.id}">
                                    <label class="form-check-label" for="guarantee_${rate.id}">
                                        Add Guarantee (+$${parseFloat(rate.guaranteeCharge).toFixed(2)})
                                    </label>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="card-footer">
                        <button type="button" class="btn btn-primary w-100" onclick="selectRate('${rate.id}')">
                            Select Rate
                        </button>
                    </div>
                </div>
            `;
            ratesContainer.appendChild(rateCard);
        });

        // Add sorting controls
        const sortingControls = document.getElementById('rateSortingControls');
        if (!sortingControls) {
            const controls = document.createElement('div');
            controls.id = 'rateSortingControls';
            controls.className = 'mb-4';
            controls.innerHTML = `
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <select class="form-select" onchange="sortRates(this.value)">
                            <option value="price">Sort by Price</option>
                            <option value="transit">Sort by Transit Time</option>
                            <option value="carrier">Sort by Carrier</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="guaranteedOnly" onchange="filterGuaranteed(this.checked)">
                            <label class="form-check-label" for="guaranteedOnly">
                                Show Guaranteed Services Only
                            </label>
                        </div>
                    </div>
                </div>
            `;
            ratesSection.insertBefore(controls, ratesContainer);
        }
    }
}

// Initialize form handler
const formHandler = new FormHandler(); 