// State and province constants
const usStates = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

const canadianProvinces = {
    'AB': 'Alberta', 'BC': 'British Columbia', 'MB': 'Manitoba', 'NB': 'New Brunswick',
    'NL': 'Newfoundland and Labrador', 'NS': 'Nova Scotia', 'NT': 'Northwest Territories',
    'NU': 'Nunavut', 'ON': 'Ontario', 'PE': 'Prince Edward Island', 'QC': 'Quebec',
    'SK': 'Saskatchewan', 'YT': 'Yukon'
};

// Form handling functionality
class FormHandler {
    constructor(options = {}) {
        this.currentStep = 0;
        this.formData = {
            shipmentInfo: {},
            shipFrom: {},
            shipTo: {},
            packages: []
        };
        this.skipMapsInit = options.skipMapsInit || false;
        this.setupStepValidation();
        this.initializeForm();
    }

    initializeForm() {
        try {
            // Initialize form elements
            this.form = document.getElementById('shipmentForm');
            this.stepItems = document.querySelectorAll('.step-item');
            this.formSections = document.querySelectorAll('.form-section');
            
            // Validate required elements exist
            if (!this.form) {
                throw new Error('Shipment form not found');
            }
            
            // Setup step validation first
            this.setupStepValidation();
            
            // Initialize event listeners
            this.setupEventListeners();
            
            // Setup step navigation
            this.setupStepNavigation();
            
            // Load saved data if exists
            this.loadSavedData();
            
            // Show initial step only if we have step items
            if (this.stepItems.length > 0) {
                this.showStep(0);
            } else {
                console.warn('No step items found');
            }
        } catch (error) {
            console.error('Error initializing form:', error);
            // Try to show error in the container if it exists
            const container = document.querySelector('.container');
            if (container) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'alert alert-danger';
                errorDiv.textContent = 'Error initializing form: ' + error.message;
                container.insertAdjacentElement('afterbegin', errorDiv);
            } else {
                // Fallback to console if container doesn't exist
                console.error('Could not display error message:', error);
            }
        }
    }

    setupEventListeners() {
        try {
            // Add input event listeners for real-time validation
            document.querySelectorAll('input, select, textarea').forEach(input => {
                input.addEventListener('input', () => this.validateField(input));
            });

            // Setup country change handlers
            this.setupCountryChangeHandler('from');
            this.setupCountryChangeHandler('to');

            // Setup package management
            this.setupPackageManagement();

            // Add form submit handler
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitShipment();
            });

            // Add navigation buttons handlers
            const nextButton = document.getElementById('nextStep');
            const prevButton = document.getElementById('prevStep');
            
            if (nextButton) {
                nextButton.addEventListener('click', () => this.nextStep());
            }
            
            if (prevButton) {
                prevButton.addEventListener('click', () => this.prevStep());
            }
        } catch (error) {
            console.error('Error setting up event listeners:', error);
            this.showFormError('Error setting up form: ' + error.message);
        }
    }

    setupCountryChangeHandler(prefix) {
        const countrySelect = document.getElementById(`${prefix}Country`);
        if (!countrySelect) return;

        countrySelect.addEventListener('change', () => {
            this.handleCountryChange(prefix);
        });
    }

    setupStepValidation() {
        this.stepValidation = {
            0: () => this.validateShipmentInfo(),
            1: () => this.validateAddress('from'),
            2: () => this.validateAddress('to'),
            3: () => this.validatePackages(),
            4: () => true // Rates step doesn't need validation
        };
    }

    setupStepNavigation() {
        const stepItems = document.querySelectorAll('.step-item');
        stepItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                // Only allow navigation to previous steps
                if (index < this.currentStep) {
                    this.currentStep = index;
                    this.showStep(index);
                }
            });
        });
    }

    loadSavedData() {
        const savedData = localStorage.getItem('shipmentFormData');
        if (savedData) {
            try {
                this.formData = JSON.parse(savedData);
                this.populateFormWithData();
            } catch (error) {
                console.error('Error loading saved data:', error);
            }
        }
    }

    saveFormData() {
        localStorage.setItem('shipmentFormData', JSON.stringify(this.formData));
    }

    populateFormWithData() {
        // Populate Shipment Info
        if (this.formData.shipmentInfo) {
            const { shipmentType, specialInstructions } = this.formData.shipmentInfo;
            if (shipmentType) {
                const shipmentTypeSelect = document.getElementById('shipmentType');
                if (shipmentTypeSelect) {
                    const matchingOption = Array.from(shipmentTypeSelect.options).find(option => 
                        option.value === shipmentType
                    );
                    if (matchingOption) {
                        matchingOption.selected = true;
                    }
                }
            }
            if (specialInstructions) {
                const specialInstructionsInput = document.getElementById('specialInstructions');
                if (specialInstructionsInput) {
                    specialInstructionsInput.value = specialInstructions;
                }
            }
        }

        // Populate Ship From
        if (this.formData.shipFrom) {
            Object.entries(this.formData.shipFrom).forEach(([key, value]) => {
                const input = document.getElementById(`from${key.charAt(0).toUpperCase() + key.slice(1)}`);
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('change'));
                }
            });
        }

        // Populate Ship To
        if (this.formData.shipTo) {
            Object.entries(this.formData.shipTo).forEach(([key, value]) => {
                const input = document.getElementById(`to${key.charAt(0).toUpperCase() + key.slice(1)}`);
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('change'));
                }
            });
        }

        // Populate Packages
        if (this.formData.packages && this.formData.packages.length > 0) {
            const packagesList = document.getElementById('packagesList');
            if (packagesList) {
                packagesList.innerHTML = '';
                this.formData.packages.forEach(pkg => {
                    const packageCard = this.createPackageCard(pkg);
                    packagesList.appendChild(packageCard);
                });
                this.updatePackageCount();
            }
        }
    }

    createPackageCard(pkg = {}) {
        const card = document.createElement('div');
        card.className = 'package-card';
        card.innerHTML = `
            <div class="package-header">
                <h5>Package ${document.querySelectorAll('.package-card').length + 1}</h5>
                <button type="button" class="btn btn-sm btn-danger remove-package">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
            <div class="package-content">
                <div class="mb-3">
                    <label class="form-label">Description</label>
                    <input type="text" class="form-control package-description" 
                           value="${pkg.description || ''}" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Quantity</label>
                    <input type="number" class="form-control package-quantity" 
                           value="${pkg.quantity || 1}" min="1" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Package Type</label>
                    <select class="form-select package-type">
                        ${window.PACKAGE_TYPES.map(type => 
                            `<option value="${type}" ${pkg.type === type ? 'selected' : ''}>${type}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Weight (lbs)</label>
                    <input type="number" class="form-control package-weight" 
                           value="${pkg.weight || ''}" min="0" step="0.1">
                </div>
                <div class="mb-3">
                    <label class="form-label">Dimensions</label>
                    <div class="row g-2">
                        <div class="col">
                            <input type="number" class="form-control package-length" 
                                   placeholder="Length" value="${pkg.length || ''}" min="0" step="0.1">
                        </div>
                        <div class="col">
                            <input type="number" class="form-control package-width" 
                                   placeholder="Width" value="${pkg.width || ''}" min="0" step="0.1">
                        </div>
                        <div class="col">
                            <input type="number" class="form-control package-height" 
                                   placeholder="Height" value="${pkg.height || ''}" min="0" step="0.1">
                        </div>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label">Declared Value ($)</label>
                    <input type="number" class="form-control package-value" 
                           value="${pkg.declaredValue || ''}" min="0" step="0.01">
                </div>
                <div class="mb-3">
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input package-stackable" 
                               ${pkg.stackable ? 'checked' : ''}>
                        <label class="form-check-label">Stackable</label>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        card.querySelector('.remove-package').addEventListener('click', () => {
            card.remove();
            this.updatePackageCount();
            this.saveFormData();
        });

        const inputs = card.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.saveFormData();
            });
        });

        return card;
    }

    goToStep(step) {
        if (step >= 0 && step < 5) {
            this.currentStep = step;
            this.showStep(step);
            this.updateStepper();
            this.saveFormData();
        }
    }

    updateStepper() {
        const stepItems = document.querySelectorAll('.step-item');
        const progress = document.querySelector('.progress');
        
        stepItems.forEach((item, index) => {
            if (index < this.currentStep) {
                item.classList.add('completed');
                item.classList.remove('active');
            } else if (index === this.currentStep) {
                item.classList.add('active');
                item.classList.remove('completed');
            } else {
                item.classList.remove('active', 'completed');
            }
        });

        // Update progress bar
        const progressWidth = (this.currentStep / 4) * 100;
        progress.style.width = `${progressWidth}%`;
    }

    nextStep() {
        if (this.validateCurrentStep()) {
            const nextStepIndex = this.currentStep + 1;
            if (nextStepIndex < 5) { // We have 5 steps (0-4)
                this.showStep(nextStepIndex);
            }
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }

    showStep(step) {
        try {
            // Update current step
            this.currentStep = step;

            // Get all required elements
            const stepItems = document.querySelectorAll('.step-item');
            const progressBar = document.querySelector('.progress');
            const sections = document.querySelectorAll('.form-section');

            if (!stepItems.length) {
                console.warn('Step items not found');
                return;
            }

            // Update stepper UI
            stepItems.forEach((item, index) => {
                if (index < step) {
                    item.classList.add('completed');
                    item.classList.remove('active');
                } else if (index === step) {
                    item.classList.add('active');
                    item.classList.remove('completed');
                } else {
                    item.classList.remove('active', 'completed');
                }
            });

            // Update progress bar if it exists
            if (progressBar) {
                const progress = (step / (stepItems.length - 1)) * 100;
                progressBar.style.width = `${progress}%`;
            }

            // Show/hide form sections with animation
            if (sections.length) {
                sections.forEach(section => {
                    const sectionStep = parseInt(section.dataset.step);
                    if (sectionStep === step) {
                        section.style.display = 'block';
                        setTimeout(() => section.classList.add('active'), 50);
                        
                        // Special handling for packages section (step 3)
                        if (step === 3) {
                            // Ensure packages list is initialized
                            const packagesList = document.getElementById('packagesList');
                            if (packagesList && (!this.packages || this.packages.length === 0)) {
                                // Add an initial empty package if none exist
                                this.packages = [{
                                    description: "Standard Wooden Pallet",
                                    quantity: 2,
                                    type: 'PLT',
                                    weight: 100,
                                    length: 48,
                                    width: 48,
                                    height: 48,
                                    declaredValue: 1000,
                                    stackable: true
                                }];
                                this.updatePackagesList();
                            }
                        }
                    } else {
                        section.classList.remove('active');
                        setTimeout(() => {
                            section.style.display = 'none';
                        }, 300);
                    }
                });
            }

            // Special handling for rates step
            if (step === 4) {
                this.calculateRates();
            }
        } catch (error) {
            console.error('Error showing step:', error);
        }
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
        if (field.id === 'shipmentDate') {
            const date = new Date(value);
            const today = new Date();
            
            // Reset time components for comparison
            date.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);
            
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
            if (field) {
                if (!this.validateField(field)) {
                    isValid = false;
                }
            } else {
                console.warn(`Field with ID '${fieldId}' not found`);
            }
        });

        return isValid;
    }

    validatePackages() {
        const packagesData = this.getPackagesData();
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
                    if (!pkg.quantity || pkg.quantity < 1) packageErrors.push('Quantity');
                    if (!pkg.type) packageErrors.push('Type');
                    if (!pkg.weight || pkg.weight <= 0) packageErrors.push('Weight');
                    if (!pkg.length || pkg.length <= 0) packageErrors.push('Length');
                    if (!pkg.width || pkg.width <= 0) packageErrors.push('Width');
                    if (!pkg.height || pkg.height <= 0) packageErrors.push('Height');
                    if (!pkg.declaredValue || pkg.declaredValue <= 0) packageErrors.push('Declared Value');

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
            if (element && !element.value.trim()) {
                isValid = false;
                errorMessages.push(`${field.label} is required`);
                this.showError(element, `${field.label} is required`);
            } else if (element) {
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
                { id: `${addr.prefix}CompanyName`, label: 'Company Name' },
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
                if (element && !element.value.trim()) {
                    isValid = false;
                    errorMessages.push(`${addr.label} - ${field.label} is required`);
                    this.showError(element, `${field.label} is required`);
                } else if (element) {
                    this.removeErrorMessage(element);
                }
            });

            // Validate state/province based on country
            const country = document.getElementById(`${addr.prefix}Country`);
            const stateSelect = document.getElementById(`${addr.prefix}State`);
            
            if (country && stateSelect) {
                if ((country.value === 'US' || country.value === 'CA') && !stateSelect.value) {
                    isValid = false;
                    errorMessages.push(`${addr.label} - State/Province is required`);
                    this.showError(stateSelect, 'State/Province is required');
                } else {
                    this.removeErrorMessage(stateSelect);
                }
            }
        });

        // Only validate packages if we're on the packages step or later
        if (this.currentStep >= 3) {
            const packagesData = this.getPackagesData();
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
                        if (!pkg.quantity || pkg.quantity < 1) packageErrors.push('Quantity');
                        if (!pkg.type) packageErrors.push('Type');
                        if (!pkg.weight || pkg.weight <= 0) packageErrors.push('Weight');
                        if (!pkg.length || pkg.length <= 0) packageErrors.push('Length');
                        if (!pkg.width || pkg.width <= 0) packageErrors.push('Width');
                        if (!pkg.height || pkg.height <= 0) packageErrors.push('Height');
                        if (!pkg.declaredValue || pkg.declaredValue <= 0) packageErrors.push('Declared Value');

                        // Add error message with specific fields
                        errorMessages.push(`Package ${index + 1} has invalid fields: ${packageErrors.join(', ')}`);
                    }
                });
            }
        }

        // Show comprehensive error message if there are validation errors
        if (!isValid) {
            const errorMessage = 'Please fix the following errors:\n' + errorMessages.join('\n');
            this.showFormError(errorMessage);
        }

        return isValid;
    }

    gatherFormData() {
        const packages = this.getPackagesData();
        const items = packages.map(pkg => ({
            name: pkg.description,
            packageType: pkg.type,
            weight: pkg.weight,
            length: pkg.length,
            width: pkg.width,
            height: pkg.height,
            declaredValue: pkg.declaredValue,
            value: pkg.declaredValue,
            quantity: pkg.quantity,
            stackable: pkg.stackable ? true : false,
            freightClass: pkg.type === 'PLT' ? '400' : '500'
        }));

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
            fromAddress: {
                company: document.getElementById('fromCompanyName').value,
                street: document.getElementById('fromAddressLine1').value,
                street2: document.getElementById('fromAddressLine2')?.value || '',
                postalCode: document.getElementById('fromPostal').value,
                city: document.getElementById('fromCity').value,
                state: document.getElementById('fromState').value,
                country: document.getElementById('fromCountry').value,
                contactName: document.getElementById('fromContactName').value,
                contactPhone: document.getElementById('fromPhone').value,
                contactEmail: document.getElementById('fromEmail').value,
                specialInstructions: document.getElementById('fromSpecialInstructions')?.value || ''
            },
            toAddress: {
                company: document.getElementById('toCompanyName').value,
                street: document.getElementById('toAddressLine1').value,
                street2: document.getElementById('toAddressLine2')?.value || '',
                postalCode: document.getElementById('toPostal').value,
                city: document.getElementById('toCity').value,
                state: document.getElementById('toState').value,
                country: document.getElementById('toCountry').value,
                contactName: document.getElementById('toContactName').value,
                contactPhone: document.getElementById('toPhone').value,
                contactEmail: document.getElementById('toEmail').value,
                specialInstructions: document.getElementById('toSpecialInstructions')?.value || ''
            },
            items: items
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
            // Get tomorrow's date
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowFormatted = tomorrow.toISOString().split('T')[0];

            // Test data for development
            const draftData = {
                shipmentInfo: {
                    shipmentType: 'FTL',
                    bookingReference: 'REF123456',
                    shipmentDate: tomorrowFormatted,
                    earliestPickup: '05:00',
                    latestPickup: '17:00',
                    earliestDelivery: '09:00',
                    latestDelivery: '22:00'
                },
                shipFrom: {
                    company: "Tyger Shark Inc.",
                    contact: "Tyler Murray",
                    phone: "647-262-1493",
                    email: "tyler@tygershark.com",
                    address1: "123 Main Street",
                    address2: "Unit A",
                    city: "New Berlin",
                    state: "WI",
                    postal: "53151",
                    country: "US",
                    specialInstructions: "Pickup at Bay 1"
                },
                shipTo: {
                    company: "Fantom Inc.",
                    contact: "Tyler Murray",
                    phone: "647-262-1493",
                    email: "tyler@tygershark.com",
                    address1: "321 King Street",
                    address2: "Unit B",
                    city: "Mississauga",
                    state: "ON",
                    postal: "L4W 1N7",
                    country: "CA",
                    specialInstructions: "Deliver to Bay 3"
                },
                packages: [{
                    description: "Standard Wooden Pallet",
                    quantity: 2,
                    type: 'PLT',
                    weight: 100,
                    length: 48,
                    width: 48,
                    height: 48,
                    declaredValue: 1000,
                    stackable: true
                }]
            };

            // First, populate shipment info
            this.populateShipmentInfo(draftData.shipmentInfo);

            // Then populate address sections
            if (draftData.shipFrom) {
                this.populateAddressSection('from', draftData.shipFrom);
            }
            if (draftData.shipTo) {
                this.populateAddressSection('to', draftData.shipTo);
            }

            // Finally, populate packages if they exist
            if (draftData.packages && draftData.packages.length > 0) {
                this.packages = draftData.packages;
                this.updatePackagesList();
            }

            // Always show the first section
            this.showSection(0);

            // Store the draft data for later use
            this.formData = draftData;

            // Update the stepper UI
            this.updateStepper();
            
            // Update navigation buttons
            this.updateNavigationButtons();

            // Disable the Load Draft button
            const loadDraftButton = document.querySelector('button[onclick="formHandler.loadDraft()"]');
            if (loadDraftButton) {
                loadDraftButton.disabled = true;
                loadDraftButton.innerHTML = '<i class="bi bi-folder-symlink"></i> Draft Loaded';
            }

            // Show success message
            this.showFormSuccess('Draft loaded successfully');
        } catch (error) {
            console.error('Error loading draft:', error);
            this.showFormError('Error loading draft: ' + error.message);
        }
    }

    populateShipmentInfo(info) {
        if (!info) return;

        // Map of field IDs to their corresponding data keys
        const fieldMappings = {
            'shipmentType': 'shipmentType',
            'bookingReference': 'bookingReference',
            'shipmentDate': 'shipmentDate',
            'earliestPickup': 'earliestPickup',
            'latestPickup': 'latestPickup',
            'earliestDelivery': 'earliestDelivery',
            'latestDelivery': 'latestDelivery'
        };

        // Log the field mappings for debugging
        console.log('Populating shipment info with mappings:', fieldMappings);

        // Populate each field
        for (const [fieldId, dataKey] of Object.entries(fieldMappings)) {
            const element = document.getElementById(fieldId);
            if (element) {
                if (fieldId === 'shipmentType') {
                    // Special handling for shipmentType select
                    const value = info[dataKey] || '';
                    const matchingOption = Array.from(element.options).find(option => 
                        option.value === value
                    );
                    if (matchingOption) {
                        matchingOption.selected = true;
                    }
                } else {
                    element.value = info[dataKey] || '';
                }
                // Trigger change event to ensure any dependent fields are updated
                element.dispatchEvent(new Event('change'));
            } else {
                console.warn(`Element with ID '${fieldId}' not found`);
            }
        }
    }

    populateAddressSection(prefix, addressData) {
        if (!addressData) return;

        // Map of field IDs to their corresponding data keys
        const fieldMappings = {
            'CompanyName': 'company',
            'ContactName': 'contact',
            'Phone': 'phone',
            'Email': 'email',
            'AddressLine1': 'address1',
            'AddressLine2': 'address2',
            'City': 'city',
            'Postal': 'postal',
            'Country': 'country',
            'State': 'state',
            'SpecialInstructions': 'specialInstructions'
        };

        // Log the field mappings for debugging
        console.log(`Populating ${prefix} address fields with mappings:`, fieldMappings);

        // Populate each field
        for (const [fieldSuffix, dataKey] of Object.entries(fieldMappings)) {
            const fieldId = `${prefix}${fieldSuffix}`;
            const element = document.getElementById(fieldId);
            
            if (element) {
                element.value = addressData[dataKey] || '';
                
                // Special handling for country and state
                if (fieldSuffix === 'Country') {
                    element.dispatchEvent(new Event('change'));
                    // Wait for state options to load
                    setTimeout(() => {
                        const stateElement = document.getElementById(`${prefix}State`);
                        if (stateElement && addressData.state) {
                            stateElement.value = addressData.state;
                            stateElement.dispatchEvent(new Event('change'));
                        }
                    }, 100);
                } else if (fieldSuffix === 'State') {
                    element.dispatchEvent(new Event('change'));
                }
            } else {
                console.warn(`Element with ID '${fieldId}' not found`);
            }
        }
    }

    showSection(step) {
        // Hide all sections first
        document.querySelectorAll('.form-section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });

        // Show the requested section
        const section = document.querySelector(`.form-section[data-step="${step}"]`);
        if (section) {
            section.style.display = 'block';
            section.classList.add('active');
            
            // Update the current step
            this.currentStep = step;
            
            // Update the stepper UI
            this.updateStepper();
            
            // Update navigation buttons
            this.updateNavigationButtons();
        } else {
            console.warn(`Section for step ${step} not found`);
        }
    }

    showFormSuccess(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-success alert-dismissible fade show';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.querySelector('.container').insertAdjacentElement('afterbegin', alert);
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

    async calculateRates() {
        try {
            // Get required elements
            const ratesContainer = document.getElementById('ratesContainer');
            const rateFilters = document.querySelector('.rate-filters');
            
            // Create elements if they don't exist
            if (!ratesContainer) {
                const ratesDiv = document.createElement('div');
                ratesDiv.id = 'ratesContainer';
                ratesDiv.className = 'row';
                document.querySelector('.form-section[data-step="4"]').appendChild(ratesDiv);
            }
            
            if (!rateFilters) {
                const filtersDiv = document.createElement('div');
                filtersDiv.className = 'rate-filters';
                filtersDiv.innerHTML = `
                    <div class="row align-items-center">
                        <div class="col-md-4">
                            <label class="form-label">Sort By</label>
                            <select class="form-select" onchange="formHandler.sortRates(this.value)">
                                <option value="price">Price (Lowest First)</option>
                                <option value="transit">Transit Time (Fastest First)</option>
                                <option value="carrier">Carrier (A-Z)</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Service Type</label>
                            <select class="form-select" onchange="formHandler.filterService(this.value)">
                                <option value="all">All Services</option>
                                <option value="guaranteed">Guaranteed Only</option>
                                <option value="economy">Economy</option>
                                <option value="express">Express</option>
                            </select>
                        </div>
                    </div>
                `;
                document.querySelector('.form-section[data-step="4"]').insertBefore(
                    filtersDiv,
                    document.getElementById('ratesContainer')
                );
            }
            
            // Hide rate filters and show loading state
            if (rateFilters) {
                rateFilters.style.display = 'none';
            }
            if (ratesContainer) {
                ratesContainer.innerHTML = `
                    <div class="col-12">
                        <div class="loading-overlay">
                            <div class="text-center">
                                <div id="rateLottieContainer" style="width: 300px; height: 300px; margin: -20px auto 0;"></div>
                                <p class="mt-2">
                                    <span class="spinner-border spinner-border-sm me-2" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </span>
                                    Searching All Carrier Rates
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Validate form before calculating rates
            if (!this.validateForm()) {
                throw new Error('Please fix form errors before calculating rates');
            }

            const requestData = this.gatherFormData();

            // Initialize Lottie animation
            const lottieContainer = document.getElementById('rateLottieContainer');
            if (lottieContainer) {
                const animation = lottie.loadAnimation({
                    container: lottieContainer,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    path: '/animations/truck.json'
                });

                // Scale up the animation
                const svg = lottieContainer.querySelector('svg');
                if (svg) {
                    svg.style.transform = 'scale(1.5)';
                    svg.style.transformOrigin = 'center center';
                }

                // Handle animation error
                animation.addEventListener('error', () => {
                    if (lottieContainer) {
                        lottieContainer.innerHTML = `
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        `;
                    }
                });
            }

            const response = await fetch('https://getshippingrates-xedyh5vw7a-uc.a.run.app/rates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();

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

                // Show rate filters and display rates
                if (rateFilters) {
                    rateFilters.style.display = 'block';
                }
                this.displayRates(rates);
            } else {
                throw new Error(responseData.message || 'No rates found in the response');
            }
        } catch (error) {
            console.error('Error calculating rates:', error);
            const ratesContainer = document.getElementById('ratesContainer');
            const rateFilters = document.querySelector('.rate-filters');
            
            if (ratesContainer) {
                ratesContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Error calculating rates. Please try again.
                    </div>
                `;
            }
            
            if (rateFilters) {
                rateFilters.style.display = 'block';
            }
        }
    }

    displayRates(rates) {
        this.currentRates = rates;
        const ratesContainer = document.getElementById('ratesContainer');
        ratesContainer.innerHTML = '';

        // Sort rates by price (lowest first) by default
        rates.sort((a, b) => a.totalCharges - b.totalCharges);

        // Add the global rate details toggle button
        const rateFilters = document.querySelector('.rate-filters');
        if (rateFilters) {
            // Check if toggle button already exists
            let toggleButton = document.querySelector('.rate-details-toggle');
            if (!toggleButton) {
                toggleButton = document.createElement('button');
                toggleButton.type = 'button'; // Prevent form submission
                toggleButton.className = 'btn btn-outline-primary rate-details-toggle';
                toggleButton.setAttribute('data-expanded', 'false');
                toggleButton.innerHTML = '<i class="bi bi-list-ul"></i> Rate Details';
                toggleButton.onclick = (e) => {
                    e.preventDefault(); // Prevent form submission
                    this.toggleAllRateDetails();
                };

                // Find the row containing the filters
                const filterRow = rateFilters.querySelector('.row');
                if (filterRow) {
                    // Create a new column for the toggle button with right alignment
                    const toggleCol = document.createElement('div');
                    toggleCol.className = 'col-md-4 text-end';
                    toggleCol.appendChild(toggleButton);
                    filterRow.appendChild(toggleCol);
                } else {
                    rateFilters.appendChild(toggleButton);
                }
            }
        }

        rates.forEach((rate, index) => {
            const rateCard = document.createElement('div');
            rateCard.className = 'col-md-4 mb-4';
            
            const estimatedDelivery = new Date(rate.estimatedDelivery);
            const deliveryDateStr = estimatedDelivery.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            const accessorialTotal = rate.accessorials.reduce((sum, acc) => sum + acc.amount, 0);
            let currentTotal = rate.totalCharges;

            rateCard.innerHTML = `
                <div class="card h-100 rate-card" data-rate-id="${rate.id}">
                    <div class="card-header bg-dark text-white">
                        <h5 class="card-title mb-0 fw-bold">${rate.carrier}</h5>
                    </div>
                    <div class="card-body pb-2">
                        <div class="mb-4">
                            <div class="d-flex align-items-center mb-2">
                                <i class="bi bi-truck text-primary me-2"></i>
                                <span class="h2 mb-0">${rate.transitDays}</span>
                                <span class="ms-2 text-muted">days</span>
                            </div>
                            <small class="text-muted">Est. Delivery: ${deliveryDateStr}</small>
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
                        <div class="rate-details" id="details_${rate.id}" style="display: none;">
                            <div class="mb-3">
                                <h6 class="text-muted fw-bold">Service Level</h6>
                                <p class="mb-0">${rate.serviceLevel}</p>
                            </div>
                            <div class="mb-3">
                                <h6 class="text-muted fw-bold">Charges Breakdown</h6>
                                <ul class="list-unstyled">
                                    <li>Base Rate: $${rate.baseRate.toFixed(2)}</li>
                                    <li>Fuel Surcharge: $${rate.fuelSurcharge.toFixed(2)}</li>
                                    ${rate.accessorials.map(acc => 
                                        `<li>${acc.description}: $${acc.amount.toFixed(2)}</li>`
                                    ).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="card-footer">
                        <button type="button" class="btn btn-outline-dark w-100" onclick="formHandler.selectRate('${rate.id}')">
                            <i class="bi bi-check-circle me-1"></i>Select
                        </button>
                    </div>
                </div>
            `;
            ratesContainer.appendChild(rateCard);

            // Add staggered animation
            setTimeout(() => {
                rateCard.querySelector('.rate-card').classList.add('show');
            }, index * 100);
        });
    }

    toggleAllRateDetails() {
        const toggleButton = document.querySelector('.rate-details-toggle');
        const detailsDivs = document.querySelectorAll('.rate-details');
        const isExpanded = toggleButton.getAttribute('data-expanded') === 'true';
        
        detailsDivs.forEach(div => {
            div.style.display = isExpanded ? 'none' : 'block';
        });
        
        // Update button icon and state
        toggleButton.innerHTML = isExpanded ? 
            '<i class="bi bi-list-ul"></i> Rate Details' : 
            '<i class="bi bi-list-check"></i> Hide Details';
        toggleButton.setAttribute('data-expanded', !isExpanded);
    }

    updateRateTotal(rateId, baseTotal, guaranteeCharge, isChecked) {
        const totalElement = document.getElementById(`total_${rateId}`);
        if (totalElement) {
            const newTotal = isChecked ? baseTotal + guaranteeCharge : baseTotal;
            totalElement.textContent = `$${newTotal.toFixed(2)}`;
        }
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

    setupAddressAutocomplete(prefix) {
        const addressInput = document.getElementById(`${prefix}Address`);
        if (!addressInput) return;

        if (typeof google === 'undefined' || this.skipMapsInit) {
            console.log(`Skipping Google Maps autocomplete initialization for ${prefix}`);
            return;
        }

        try {
            const autocomplete = new google.maps.places.Autocomplete(addressInput, {
                types: ['address'],
                componentRestrictions: { country: ['us', 'ca'] }
            });

            // Add place_changed event listener
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.address_components) {
                    this.fillAddressFields(place, prefix);
                }
            });
        } catch (error) {
            console.warn(`Error setting up Google Maps autocomplete for ${prefix}:`, error);
        }
    }

    fillAddressFields(place, prefix) {
        let streetNumber = '';
        let streetName = '';
        let city = '';
        let state = '';
        let postalCode = '';
        let country = '';

        // Extract address components
        place.address_components.forEach(component => {
            const type = component.types[0];
            switch (type) {
                case 'street_number':
                    streetNumber = component.long_name;
                    break;
                case 'route':
                    streetName = component.long_name;
                    break;
                case 'locality':
                    city = component.long_name;
                    break;
                case 'administrative_area_level_1':
                    state = component.short_name;
                    break;
                case 'postal_code':
                    postalCode = component.long_name;
                    break;
                case 'country':
                    country = component.short_name;
                    break;
            }
        });

        // Fill form fields
        document.getElementById(`${prefix}Address1`).value = `${streetNumber} ${streetName}`.trim();
        document.getElementById(`${prefix}City`).value = city;
        document.getElementById(`${prefix}Zip`).value = postalCode;
        
        const countrySelect = document.getElementById(`${prefix}Country`);
        countrySelect.value = country;
        countrySelect.dispatchEvent(new Event('change'));

        // Wait for state options to load
        setTimeout(() => {
            const stateElement = document.getElementById(`${prefix}State`);
            if (stateElement && state) {
                stateElement.value = state;
                stateElement.dispatchEvent(new Event('change'));
            }
        }, 100);
    }

    handleCountryChange(prefix) {
        const country = document.getElementById(`${prefix}Country`).value;
        const stateSelect = document.getElementById(`${prefix}State`);
        
        if (country === 'US' || country === 'CA') {
            // Clear and populate state select options
            stateSelect.innerHTML = '';
            const states = country === 'US' ? usStates : canadianProvinces;
            
            Object.entries(states).forEach(([code, name]) => {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = name;
                stateSelect.appendChild(option);
            });
        }
    }

    validateAddress(prefix) {
        const requiredFields = [
            `${prefix}CompanyName`,
            `${prefix}ContactName`,
            `${prefix}Phone`,
            `${prefix}Email`,
            `${prefix}AddressLine1`,
            `${prefix}City`,
            `${prefix}Postal`,
            `${prefix}Country`
        ];

        let isValid = true;

        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                if (!this.validateField(field)) {
                    isValid = false;
                }
            } else {
                console.warn(`Field with ID '${fieldId}' not found`);
            }
        });

        // Validate state/province based on country
        const country = document.getElementById(`${prefix}Country`);
        const state = document.getElementById(`${prefix}State`);

        if (country && state) {
            if (country.value === 'US' || country.value === 'CA') {
                if (!state.value) {
                    this.showError(state, 'State/Province is required');
                    isValid = false;
                }
            }
        }

        return isValid;
    }

    validateCurrentStep() {
        if (this.stepValidation[this.currentStep]()) {
            return true;
        } else {
            this.showFormError('Please fix the errors before proceeding');
            return false;
        }
    }

    setupPackageManagement() {
        try {
            const addPackageButton = document.querySelector('.btn-add-package');
            const packagesList = document.getElementById('packagesList');
            
            if (!addPackageButton || !packagesList) {
                console.warn('Package management elements not found');
                return;
            }
        } catch (error) {
            console.error('Error setting up package management:', error);
            this.showFormError('Error setting up package management: ' + error.message);
        }
    }

    addPackage() {
        try {
            const packagesList = document.getElementById('packagesList');
            if (!packagesList) {
                console.warn('Packages list element not found');
                return;
            }

            const packageCard = this.createPackageCard();
            packagesList.appendChild(packageCard);
            this.updatePackageCount();
            this.saveFormData();
        } catch (error) {
            console.error('Error adding package:', error);
            this.showFormError('Error adding package: ' + error.message);
        }
    }

    loadFormData() {
        try {
            const savedData = localStorage.getItem('shipmentFormData');
            if (savedData) {
                const formData = JSON.parse(savedData);
                this.populateForm(formData);
            }
        } catch (error) {
            console.error('Error loading form data:', error);
            this.showFormError('Error loading saved data: ' + error.message);
        }
    }

    getPackagesData() {
        const packages = [];
        const packageCards = document.querySelectorAll('.package-card');
        
        packageCards.forEach(card => {
            const pkg = {
                description: card.querySelector('.package-description').value,
                quantity: parseInt(card.querySelector('.package-quantity').value) || 1,
                type: card.querySelector('.package-type').value,
                weight: parseFloat(card.querySelector('.package-weight').value) || 0,
                length: parseFloat(card.querySelector('.package-length').value) || 0,
                width: parseFloat(card.querySelector('.package-width').value) || 0,
                height: parseFloat(card.querySelector('.package-height').value) || 0,
                declaredValue: parseFloat(card.querySelector('.package-value').value) || 0,
                stackable: card.querySelector('.package-stackable').checked,
                isValid: true
            };

            // Validate package data
            if (!pkg.description || !pkg.quantity || !pkg.type || 
                pkg.weight <= 0 || pkg.length <= 0 || 
                pkg.width <= 0 || pkg.height <= 0 || pkg.declaredValue <= 0) {
                pkg.isValid = false;
            }

            packages.push(pkg);
        });

        return packages;
    }

    initializeAutocomplete() {
        if (typeof google === 'undefined') {
            console.warn('Google Maps API not loaded');
            return;
        }
        
        try {
            this.setupAddressAutocomplete('from');
            this.setupAddressAutocomplete('to');
            this.skipMapsInit = false;
        } catch (error) {
            console.error('Error initializing Google Maps autocomplete:', error);
        }
    }

    updatePackageCount() {
        const packageCount = document.querySelectorAll('.package-card').length;
        const packageCountElement = document.getElementById('packageCount');
        if (packageCountElement) {
            packageCountElement.textContent = packageCount;
        }
    }

    updateNavigationButtons() {
        const prevButton = document.getElementById('prevStep');
        const nextButton = document.getElementById('nextStep');
        const submitButton = document.getElementById('submitShipment');

        if (prevButton) {
            prevButton.style.display = this.currentStep === 0 ? 'none' : 'block';
        }

        if (nextButton) {
            nextButton.style.display = this.currentStep === 4 ? 'none' : 'block';
        }

        if (submitButton) {
            submitButton.style.display = this.currentStep === 4 ? 'block' : 'none';
        }
    }

    updatePackagesList() {
        const packagesList = document.getElementById('packagesList');
        if (!packagesList) {
            console.warn('Packages list element not found');
            return;
        }

        // Clear existing packages
        packagesList.innerHTML = '';

        // Add each package from the packages array
        if (this.packages && this.packages.length > 0) {
            this.packages.forEach(pkg => {
                const packageCard = this.createPackageCard(pkg);
                packagesList.appendChild(packageCard);
            });
        }

        // Update package count
        this.updatePackageCount();
    }

    filterService(serviceType) {
        if (!this.currentRates) return;
        
        const ratesContainer = document.getElementById('ratesContainer');
        const rateCards = ratesContainer.querySelectorAll('.col-md-4');
        
        rateCards.forEach(card => {
            const rateCard = card.querySelector('.rate-card');
            if (!rateCard) return;
            
            const serviceLevel = rateCard.querySelector('.card-body p').textContent.toLowerCase();
            let shouldShow = true;
            
            switch(serviceType) {
                case 'guaranteed':
                    shouldShow = rateCard.querySelector('.form-check') !== null;
                    break;
                case 'economy':
                    shouldShow = serviceLevel.includes('economy');
                    break;
                case 'express':
                    shouldShow = serviceLevel.includes('express');
                    break;
                default: // 'all'
                    shouldShow = true;
            }
            
            card.style.display = shouldShow ? 'block' : 'none';
        });
    }

    sortRates(sortBy) {
        if (!this.currentRates) return;
        
        const ratesContainer = document.getElementById('ratesContainer');
        const rateCards = Array.from(ratesContainer.querySelectorAll('.col-md-4'));
        
        rateCards.sort((a, b) => {
            const rateA = this.currentRates.find(r => r.id === a.querySelector('.rate-card').dataset.rateId);
            const rateB = this.currentRates.find(r => r.id === b.querySelector('.rate-card').dataset.rateId);
            
            switch(sortBy) {
                case 'price':
                    return rateA.totalCharges - rateB.totalCharges; // Lowest price first
                case 'transit':
                    return rateA.transitDays - rateB.transitDays; // Fastest transit first
                case 'carrier':
                    return rateA.carrier.localeCompare(rateB.carrier); // Alphabetical order
                default:
                    return rateA.totalCharges - rateB.totalCharges; // Default to lowest price first
            }
        });
        
        // Clear and re-append sorted cards
        rateCards.forEach(card => ratesContainer.appendChild(card));
    }
}

// Make FormHandler available globally
window.FormHandler = FormHandler;

// Initialize form handler when DOM is loaded and all dependencies are available
document.addEventListener('DOMContentLoaded', () => {
    // Wait for constants to be available
    const checkDependencies = () => {
        if (window.PACKAGE_TYPES && window.US_STATES && window.CANADIAN_PROVINCES) {
            window.formHandler = new FormHandler();
        } else {
            setTimeout(checkDependencies, 100);
        }
    };
    checkDependencies();
});

// Add theme toggle functionality
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-bs-theme') === 'dark';
    html.setAttribute('data-bs-theme', isDark ? 'light' : 'dark');
    
    const icon = document.querySelector('.theme-toggle i');
    icon.className = isDark ? 'bi bi-moon-stars' : 'bi bi-sun';
}