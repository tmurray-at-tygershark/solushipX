// Package management functionality
let packages = [];

const PACKAGE_TYPES = [
    'Box',
    'Pallet',
    'Crate',
    'Envelope',
    'Tube',
    'Custom'
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
    const index = packages.length;
    packages.push({
        type: 'Box',
        weight: 0,
        weightUnit: 'kg',
        length: 0,
        width: 0,
        height: 0,
        dimensionUnit: 'cm',
        declaredValue: 0,
        stackable: false
    });

    const packagesList = document.getElementById('packagesList');
    packagesList.insertAdjacentHTML('beforeend', createPackageCard(index));
    updatePackageCount();
}

function removePackage(index) {
    packages.splice(index, 1);
    refreshPackagesList();
    updatePackageCount();
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
    const count = packages.length;
    const badge = document.getElementById('packageCount');
    badge.textContent = `${count} package${count !== 1 ? 's' : ''}`;
}

function getPackagesData() {
    return packages.map((pkg, index) => ({
        ...pkg,
        isValid: validatePackage(index)
    }));
}

// Initialize with one package
document.addEventListener('DOMContentLoaded', () => {
    addPackage();
}); 