// Package management functionality
let packages = [];
let packageCounter = 0;

const PACKAGE_TYPES = [
    'Box',
    'Pallet',
    'Crate',
    'Envelope',
    'Tube',
    'Custom'
];

const freightClasses = [
    "50", "55", "60", "65", "70", "77.5", "85", "92.5", 
    "100", "110", "125", "150", "175", "200", "250", "300", "400", "500"
];

function createPackageCard(index) {
    return `
        <div class="package-card" id="package-${index}">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">Package #${index + 1}</h5>
                <button type="button" class="btn btn-outline-danger btn-sm" onclick="removePackage(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
            
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label">Package Type</label>
                    <select class="form-select" onchange="updatePackage(${index}, 'type', this.value)">
                        ${PACKAGE_TYPES.map(type => `<option value="${type}">${type}</option>`).join('')}
                    </select>
                </div>
                
                <div class="col-md-6">
                    <label class="form-label">Weight</label>
                    <div class="input-group">
                        <input type="number" class="form-control" placeholder="0.00" 
                               onchange="updatePackage(${index}, 'weight', this.value)">
                        <select class="form-select" style="max-width: 80px"
                                onchange="updatePackage(${index}, 'weightUnit', this.value)">
                            <option value="kg">kg</option>
                            <option value="lb">lb</option>
                        </select>
                    </div>
                </div>

                <div class="col-md-12">
                    <label class="form-label">Dimensions</label>
                    <div class="input-group">
                        <input type="number" class="form-control" placeholder="Length" 
                               onchange="updatePackage(${index}, 'length', this.value)">
                        <input type="number" class="form-control" placeholder="Width" 
                               onchange="updatePackage(${index}, 'width', this.value)">
                        <input type="number" class="form-control" placeholder="Height" 
                               onchange="updatePackage(${index}, 'height', this.value)">
                        <select class="form-select" style="max-width: 80px"
                                onchange="updatePackage(${index}, 'dimensionUnit', this.value)">
                            <option value="cm">cm</option>
                            <option value="in">in</option>
                        </select>
                    </div>
                </div>

                <div class="col-md-6">
                    <label class="form-label">Declared Value</label>
                    <div class="input-group">
                        <span class="input-group-text">$</span>
                        <input type="number" class="form-control" placeholder="0.00" 
                               onchange="updatePackage(${index}, 'declaredValue', this.value)">
                    </div>
                </div>

                <div class="col-md-6">
                    <label class="form-label">Stackable</label>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" 
                               onchange="updatePackage(${index}, 'stackable', this.checked)">
                        <label class="form-check-label">Yes</label>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function addPackage() {
    const packagesList = document.getElementById('packagesList');
    const packageId = ++packageCounter;
    
    const packageCard = document.createElement('div');
    packageCard.className = 'package-card mb-4';
    packageCard.id = `package_${packageId}`;
    
    packageCard.innerHTML = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Package #${packageId}</h5>
                <button type="button" class="btn btn-outline-danger btn-sm" onclick="removePackage(${packageId})">
                    <i class="bi bi-trash"></i> Remove
                </button>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label">Description</label>
                        <input type="text" class="form-control" id="packageDescription_${packageId}" required>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Quantity</label>
                        <input type="number" class="form-control" id="packageQuantity_${packageId}" value="1" min="1" required>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Weight (lbs)</label>
                        <input type="number" class="form-control" id="packageWeight_${packageId}" step="0.01" required>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Length (in)</label>
                        <input type="number" class="form-control" id="packageLength_${packageId}" required>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Width (in)</label>
                        <input type="number" class="form-control" id="packageWidth_${packageId}" required>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Height (in)</label>
                        <input type="number" class="form-control" id="packageHeight_${packageId}" required>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Freight Class</label>
                        <select class="form-select" id="packageFreightClass_${packageId}" required>
                            ${freightClasses.map(fc => `<option value="${fc}">${fc}</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Declared Value ($)</label>
                        <input type="number" class="form-control" id="packageValue_${packageId}" step="0.01" value="0.00">
                    </div>
                    <div class="col-md-6">
                        <div class="form-check mt-4">
                            <input class="form-check-input" type="checkbox" id="packageStackable_${packageId}" checked>
                            <label class="form-check-label" for="packageStackable_${packageId}">
                                Stackable
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    packagesList.appendChild(packageCard);
    
    // Add to packages array
    packages.push({
        id: packageId,
        description: '',
        quantity: 1,
        weight: 0,
        length: 0,
        width: 0,
        height: 0,
        freightClass: '77.5',
        value: 0,
        stackable: true
    });
    
    updatePackageCount();
    return packageId;
}

function removePackage(packageId) {
    const packageCard = document.getElementById(`package_${packageId}`);
    if (packageCard) {
        packageCard.remove();
        packages = packages.filter(pkg => pkg.id !== packageId);
        updatePackageCount();
    }
}

function updatePackage(index, field, value) {
    packages[index][field] = value;
    // Optional: Add validation here
    validatePackage(index);
}

function validatePackage(index) {
    const package = packages[index];
    let isValid = true;

    // Weight validation
    if (package.weight <= 0) {
        isValid = false;
        // Add visual feedback
    }

    // Dimensions validation
    if (package.length <= 0 || package.width <= 0 || package.height <= 0) {
        isValid = false;
        // Add visual feedback
    }

    return isValid;
}

function refreshPackagesList() {
    const packagesList = document.getElementById('packagesList');
    packagesList.innerHTML = packages.map((_, index) => createPackageCard(index)).join('');
}

function updatePackageCount() {
    const count = document.querySelectorAll('.package-card').length;
    const badge = document.getElementById('packageCount');
    if (badge) {
        badge.textContent = `${count} package${count !== 1 ? 's' : ''}`;
    }
    
    // Show/hide the "Calculate Rates" button based on package count
    const calculateBtn = document.querySelector('button[type="submit"]');
    if (calculateBtn) {
        calculateBtn.disabled = count === 0;
    }
}

function getPackagesData() {
    const packages = [];
    const packageElements = document.querySelectorAll('.package-card');
    
    packageElements.forEach((element) => {
        const packageId = element.id.split('_')[1];
        const description = document.getElementById(`packageDescription_${packageId}`).value;
        const quantity = parseFloat(document.getElementById(`packageQuantity_${packageId}`).value);
        const weight = parseFloat(document.getElementById(`packageWeight_${packageId}`).value);
        const length = parseFloat(document.getElementById(`packageLength_${packageId}`).value);
        const width = parseFloat(document.getElementById(`packageWidth_${packageId}`).value);
        const height = parseFloat(document.getElementById(`packageHeight_${packageId}`).value);
        const freightClass = document.getElementById(`packageFreightClass_${packageId}`).value;
        const value = parseFloat(document.getElementById(`packageValue_${packageId}`).value);
        const isStackable = document.getElementById(`packageStackable_${packageId}`).checked;

        const isValid = description && 
                       quantity > 0 && 
                       weight > 0 && 
                       length > 0 && 
                       width > 0 && 
                       height > 0 && 
                       freightClass && 
                       value > 0;

        packages.push({
            description,
            quantity,
            weight,
            length,
            width,
            height,
            freightClass,
            value,
            isStackable,
            isValid
        });
    });

    return packages;
}

// Reset packages state
function resetPackages() {
    packages = [];
    packageCounter = 0;
    const packagesList = document.getElementById('packagesList');
    if (packagesList) {
        packagesList.innerHTML = '';
    }
    updatePackageCount();
}

// Add initial package on page load
document.addEventListener('DOMContentLoaded', () => {
    resetPackages();
}); 