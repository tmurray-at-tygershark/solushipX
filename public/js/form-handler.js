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

    loadDraft() {
        try {
            // Test data for development
            const draftData = {
                shipmentType: 'FTL',
                bookingReferenceNumber: 'REF123456',
                shipmentDate: '2025-03-20',
                from: {
                    company: "Tyger Shark Inc.",
                    attentionName: "Tyler Murray",
                    street: "123 Main Street",
                    street2: "Unit A",
                    postalCode: "53151",
                    city: "New Berlin",
                    state: "WI",
                    country: "US",
                    contactName: "Tyler Murray",
                    contactPhone: "647-262-1493",
                    contactEmail: "tyler@tygershark.com",
                    contactFax: "647-262-1493",
                    specialInstructions: "Pickup at Bay 1"
                },
                to: {
                    company: "Fantom Inc.",
                    attentionName: "Tyler Murray",
                    street: "321 King Street",
                    street2: "Unit B",
                    postalCode: "L4W 1N7",
                    city: "Mississauga",
                    state: "ON",
                    country: "CA",
                    contactName: "Tyler Murray",
                    contactPhone: "647-262-1493",
                    contactEmail: "tyler@tygershark.com",
                    contactFax: "647-262-1493",
                    specialInstructions: "Deliver to Bay 3"
                },
                earliestPickup: '05:00',
                latestPickup: '17:00',
                earliestDelivery: '09:00',
                latestDelivery: '22:00',
                packages: [{
                    description: 'Test Package',
                    quantity: 1,
                    weight: 100,
                    weightUnit: 'lb',
                    length: 48,
                    width: 48,
                    height: 48,
                    dimensionUnit: 'in',
                    freightClass: '50',
                    nmfcCode: '123456',
                    packageType: 'PLT',
                    stackable: true,
                    hazmat: false,
                    declaredValue: 1000
                }]
            };

            // Set shipment type and reference
            const elements = {
                shipmentType: document.getElementById('shipmentType'),
                bookingReference: document.getElementById('bookingReference'),
                shipmentDate: document.getElementById('shipmentDate'),
                earliestPickup: document.getElementById('earliestPickup'),
                latestPickup: document.getElementById('latestPickup'),
                earliestDelivery: document.getElementById('earliestDelivery'),
                latestDelivery: document.getElementById('latestDelivery')
            };

            // Check if all elements exist before proceeding
            for (const [key, element] of Object.entries(elements)) {
                if (!element) {
                    throw new Error(`Element with ID '${key}' not found`);
                }
            }

            // Set values
            elements.shipmentType.value = draftData.shipmentType;
            elements.bookingReference.value = draftData.bookingReferenceNumber;
            elements.shipmentDate.value = draftData.shipmentDate;
            elements.earliestPickup.value = draftData.earliestPickup;
            elements.latestPickup.value = draftData.latestPickup;
            elements.earliestDelivery.value = draftData.earliestDelivery;
            elements.latestDelivery.value = draftData.latestDelivery;

            // Populate addresses with error handling
            this.populateAddressSection('from', draftData.from);

            // Wait for the from country/state to be set before populating to address
            setTimeout(() => {
                this.populateAddressSection('to', draftData.to);
            }, 100);

            // Load packages
            if (draftData.packages && draftData.packages.length > 0) {
                if (typeof this.packageManager === 'undefined') {
                    console.warn('PackageManager not initialized, attempting to use global functions');
                    // Clear existing packages
                    if (typeof resetPackages === 'function') {
                        resetPackages();
                    }
                    // Add new packages
                    draftData.packages.forEach(pkg => {
                        if (typeof addPackage === 'function') {
                            const packageId = addPackage();
                            const packageFields = {
                                description: document.getElementById(`packageDescription_${packageId}`),
                                quantity: document.getElementById(`packageQuantity_${packageId}`),
                                weight: document.getElementById(`packageWeight_${packageId}`),
                                length: document.getElementById(`packageLength_${packageId}`),
                                width: document.getElementById(`packageWidth_${packageId}`),
                                height: document.getElementById(`packageHeight_${packageId}`),
                                freightClass: document.getElementById(`packageFreightClass_${packageId}`),
                                value: document.getElementById(`packageValue_${packageId}`),
                                stackable: document.getElementById(`packageStackable_${packageId}`)
                            };

                            if (packageFields.description) packageFields.description.value = pkg.description;
                            if (packageFields.quantity) packageFields.quantity.value = pkg.quantity;
                            if (packageFields.weight) packageFields.weight.value = pkg.weight;
                            if (packageFields.length) packageFields.length.value = pkg.length;
                            if (packageFields.width) packageFields.width.value = pkg.width;
                            if (packageFields.height) packageFields.height.value = pkg.height;
                            if (packageFields.freightClass) packageFields.freightClass.value = pkg.freightClass;
                            if (packageFields.value) packageFields.value.value = pkg.declaredValue;
                            if (packageFields.stackable) packageFields.stackable.checked = pkg.stackable;
                        }
                    });
                    // Update package count if function exists
                    if (typeof updatePackageCount === 'function') {
                        updatePackageCount();
                    }
                } else {
                    this.packageManager.clearPackages();
                    draftData.packages.forEach(pkg => {
                        this.packageManager.addPackage(pkg);
                    });
                }
            }

            // Validate form after loading
            setTimeout(() => {
                this.validateForm();
                this.showFormSuccess('Draft loaded successfully');
            }, 200);

        } catch (error) {
            console.error('Error loading draft:', error);
            this.showFormError('Error loading draft: ' + error.message);
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
        try {
            // Define all field mappings
            const fields = {
                company: `${prefix}Company`,
                attention: `${prefix}AttentionName`,
                contact: `${prefix}ContactName`,
                phone: `${prefix}Phone`,
                email: `${prefix}Email`,
                fax: `${prefix}Fax`,
                address1: `${prefix}AddressLine1`,
                address2: `${prefix}AddressLine2`,
                city: `${prefix}City`,
                postal: `${prefix}Postal`,
                country: `${prefix}Country`,
                state: `${prefix}State`,
                instructions: `${prefix}Instructions`
            };

            // Log the field IDs we're looking for
            console.log(`Attempting to populate ${prefix} address fields:`, fields);

            // Check if elements exist before setting values
            for (const [key, id] of Object.entries(fields)) {
                const element = document.getElementById(id);
                if (!element) {
                    console.warn(`Element with ID '${id}' not found`);
                    continue;
                }

                // Map the field to the corresponding address data
                switch (key) {
                    case 'company':
                        element.value = addressData.company || '';
                        break;
                    case 'attention':
                        element.value = addressData.attentionName || '';
                        break;
                    case 'contact':
                        element.value = addressData.contactName || '';
                        break;
                    case 'phone':
                        element.value = addressData.contactPhone || '';
                        break;
                    case 'email':
                        element.value = addressData.contactEmail || '';
                        break;
                    case 'fax':
                        element.value = addressData.contactFax || '';
                        break;
                    case 'address1':
                        element.value = addressData.street || '';
                        break;
                    case 'address2':
                        element.value = addressData.street2 || '';
                        break;
                    case 'city':
                        element.value = addressData.city || '';
                        break;
                    case 'postal':
                        element.value = addressData.postalCode || '';
                        break;
                    case 'country':
                        element.value = addressData.country || '';
                        // Trigger change event to update state/province list
                        element.dispatchEvent(new Event('change'));
                        break;
                    case 'state':
                        // Wait for country change to complete
                        setTimeout(() => {
                            if (element) {
                                element.value = addressData.state || '';
                                element.dispatchEvent(new Event('change'));
                            }
                        }, 100);
                        break;
                    case 'instructions':
                        element.value = addressData.specialInstructions || '';
                        break;
                }
            }
        } catch (error) {
            console.error(`Error populating ${prefix} address:`, error);
            throw new Error(`Failed to populate ${prefix} address: ${error.message}`);
        }
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
            console.log('Request Data:', requestData);

            const response = await fetch('https://getshippingrates-xedyh5vw7a-uc.a.run.app/rates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            const responseData = await response.json();
            console.log('Server Response:', responseData);

            if (responseData.success && responseData.data.availableRates) {
                const rates = responseData.data.availableRates.map(rate => ({
                    id: rate.quoteId,
                    carrier: rate.carrierName,
                    serviceLevel: rate.serviceMode,
                    transitDays: rate.transitTime,
                    estimatedDelivery: rate.estimatedDeliveryDate,
                    baseRate: rate.freightCharges,
                    fuelSurcharge: rate.fuelCharges,
                    accessorials: rate.billingDetails
                        .filter(detail => detail.category === 'Service')
                        .map(detail => ({
                            description: detail.description,
                            amount: detail.amountDue
                        })),
                    totalCharges: rate.totalCharges,
                    guaranteedService: rate.guarOptions && rate.guarOptions.length > 0,
                    guaranteeCharge: rate.guarOptions && rate.guarOptions.length > 0 ? 
                        rate.guarOptions[0].amountDue : 0
                }));
                console.log('Parsed Rates:', rates);
                this.displayRates(rates);
            } else {
                throw new Error('No rates found in the response');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showFormError('Error calculating rates: ' + error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    displayRates(rates) {
        // Store rates globally for filtering/sorting
        this.currentRates = rates;
        this.displayFilteredRates(rates);
    }

    displayFilteredRates(rates, sortBy = 'price', guaranteedOnly = false) {
        const ratesContainer = document.getElementById('ratesContainer');
        const ratesSection = document.getElementById('ratesSection');
        
        // Clear existing rates
        ratesContainer.innerHTML = '';
        
        // Show the rates section
        ratesSection.style.display = 'block';
        
        // Filter rates if guaranteedOnly is true
        let filteredRates = guaranteedOnly ? 
            rates.filter(rate => rate.guaranteedService) : 
            rates;

        // Sort rates based on selected criteria
        switch(sortBy) {
            case 'price':
                filteredRates.sort((a, b) => a.totalCharges - b.totalCharges);
                break;
            case 'transit':
                filteredRates.sort((a, b) => a.transitDays - b.transitDays);
                break;
            case 'carrier':
                filteredRates.sort((a, b) => a.carrier.localeCompare(b.carrier));
                break;
        }
        
        filteredRates.forEach(rate => {
            const rateCard = document.createElement('div');
            rateCard.className = 'col-md-4 mb-4';
            
            // Format estimated delivery date
            const estimatedDelivery = new Date(rate.estimatedDelivery);
            const deliveryDateStr = estimatedDelivery.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            // Calculate total accessorial charges
            const accessorialTotal = rate.accessorials.reduce((sum, acc) => sum + acc.amount, 0);
            
            // Calculate initial total without guarantee
            let currentTotal = rate.totalCharges;

            rateCard.innerHTML = `
                <div class="card h-100">
                    <div class="card-header bg-primary text-white">
                        <h5 class="card-title mb-0">${rate.carrier}</h5>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <h6 class="text-muted">Transit Time</h6>
                            <p class="mb-0">${rate.transitDays} Days</p>
                            <small class="text-muted">Est. Delivery: ${deliveryDateStr}</small>
                        </div>
                        <div class="mb-3">
                            <h6 class="text-muted">Service Level</h6>
                            <p class="mb-0">${rate.serviceLevel}</p>
                        </div>
                        <div class="mb-3">
                            <h6 class="text-muted">Charges Breakdown</h6>
                            <ul class="list-unstyled">
                                <li>Base Rate: $${rate.baseRate.toFixed(2)}</li>
                                <li>Fuel Surcharge: $${rate.fuelSurcharge.toFixed(2)}</li>
                                ${rate.accessorials.map(acc => 
                                    `<li>${acc.description}: $${acc.amount.toFixed(2)}</li>`
                                ).join('')}
                            </ul>
                        </div>
                        <div class="mb-3">
                            <h6 class="text-muted">Total Charges</h6>
                            <h4 class="text-primary mb-0" id="total_${rate.id}">$${currentTotal.toFixed(2)}</h4>
                        </div>
                        ${rate.guaranteedService ? `
                            <div class="mb-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" 
                                        id="guarantee_${rate.id}" 
                                        onchange="formHandler.updateRateTotal('${rate.id}', ${rate.totalCharges}, ${rate.guaranteeCharge}, this.checked)">
                                    <label class="form-check-label" for="guarantee_${rate.id}">
                                        Add Guarantee (+$${rate.guaranteeCharge.toFixed(2)})
                                    </label>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="card-footer">
                        <button type="button" class="btn btn-primary w-100" onclick="formHandler.selectRate('${rate.id}')">
                            Select Rate
                        </button>
                    </div>
                </div>
            `;
            ratesContainer.appendChild(rateCard);
        });

        // Add sorting controls if they don't exist
        let sortingControls = document.getElementById('rateSortingControls');
        if (!sortingControls) {
            const controls = document.createElement('div');
            controls.id = 'rateSortingControls';
            controls.className = 'mb-4';
            controls.innerHTML = `
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <select class="form-select" onchange="formHandler.sortRates(this.value)">
                            <option value="price" ${sortBy === 'price' ? 'selected' : ''}>Sort by Price</option>
                            <option value="transit" ${sortBy === 'transit' ? 'selected' : ''}>Sort by Transit Time</option>
                            <option value="carrier" ${sortBy === 'carrier' ? 'selected' : ''}>Sort by Carrier</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="guaranteedOnly" 
                                ${guaranteedOnly ? 'checked' : ''} 
                                onchange="formHandler.filterGuaranteed(this.checked)">
                            <label class="form-check-label" for="guaranteedOnly">
                                Show Guaranteed Services Only
                            </label>
                        </div>
                    </div>
                </div>
            `;
            ratesSection.insertBefore(controls, ratesContainer);
        } else {
            // Update existing controls state
            const sortSelect = sortingControls.querySelector('select');
            const guaranteedCheckbox = sortingControls.querySelector('#guaranteedOnly');
            if (sortSelect) sortSelect.value = sortBy;
            if (guaranteedCheckbox) guaranteedCheckbox.checked = guaranteedOnly;
        }
    }

    updateRateTotal(rateId, baseTotal, guaranteeCharge, isChecked) {
        const totalElement = document.getElementById(`total_${rateId}`);
        if (totalElement) {
            const newTotal = isChecked ? baseTotal + guaranteeCharge : baseTotal;
            totalElement.textContent = `$${newTotal.toFixed(2)}`;
        }
    }

    sortRates(sortBy) {
        const guaranteedOnly = document.getElementById('guaranteedOnly')?.checked || false;
        this.displayFilteredRates(this.currentRates, sortBy, guaranteedOnly);
    }

    filterGuaranteed(showGuaranteedOnly) {
        const sortSelect = document.querySelector('#rateSortingControls select');
        const sortBy = sortSelect ? sortSelect.value : 'price';
        this.displayFilteredRates(this.currentRates, sortBy, showGuaranteedOnly);
    }

    selectRate(rateId) {
        // Find the selected rate
        const rate = this.currentRates.find(r => r.id === rateId);
        if (!rate) return;

        // Check if guarantee was selected
        const guaranteeCheckbox = document.getElementById(`guarantee_${rateId}`);
        const includeGuarantee = guaranteeCheckbox?.checked || false;

        // Calculate final total
        const finalTotal = includeGuarantee ? 
            rate.totalCharges + rate.guaranteeCharge : 
            rate.totalCharges;

        // Store selected rate details (you can expand this based on your needs)
        const selectedRate = {
            ...rate,
            includeGuarantee,
            finalTotal
        };

        // You can add your logic here for what happens when a rate is selected
        console.log('Selected Rate:', selectedRate);
        alert(`Selected ${rate.carrier} rate with total $${finalTotal.toFixed(2)}`);
    }
}

// Initialize form handler
const formHandler = new FormHandler(); 