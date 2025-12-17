// ============================================
// SECRET SANTA DART SPINNER - MAIN SCRIPT
// ============================================

// LocalStorage Keys
const STORAGE_KEYS = {
    PARTICIPANTS: 'allParticipants',
    PAIRS: 'secretSantaPairs'
};

// Global State
let allParticipants = [];
let secretSantaPairs = [];
let currentSpinner = null;
let availableReceivers = [];
let isSpinning = false;
let pendingPair = null; // Store pair before saving

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadDataFromStorage();
    initializeEventListeners();
    updateUI();
});

// ============================================
// DATA PERSISTENCE
// ============================================

/**
 * Load all data from LocalStorage on page load
 */
function loadDataFromStorage() {
    // Load participants
    const storedParticipants = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
    if (storedParticipants) {
        allParticipants = JSON.parse(storedParticipants);
    }

    // Load pairs
    const storedPairs = localStorage.getItem(STORAGE_KEYS.PAIRS);
    if (storedPairs) {
        secretSantaPairs = JSON.parse(storedPairs);
    }

    // Recalculate available receivers
    updateAvailableReceivers();
}

/**
 * Save participants to LocalStorage
 */
function saveParticipants() {
    localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(allParticipants));
}

/**
 * Save pairs to LocalStorage
 */
function savePairs() {
    localStorage.setItem(STORAGE_KEYS.PAIRS, JSON.stringify(secretSantaPairs));
}

// ============================================
// CSV UPLOAD HANDLING
// ============================================

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
    // CSV File Upload
    const csvFileInput = document.getElementById('csvFile');
    csvFileInput.addEventListener('change', handleCSVUpload);

    // Download Sample CSV
    const downloadSampleButton = document.getElementById('downloadSampleButton');
    downloadSampleButton.addEventListener('click', downloadSampleCSV);

    // Admin Search
    const adminSearch = document.getElementById('adminSearch');
    adminSearch.addEventListener('input', filterAdminDropdown);

    // Admin Selector
    const adminSelector = document.getElementById('adminSelector');
    adminSelector.addEventListener('change', handleAdminSelection);

    // Spin Button
    const spinButton = document.getElementById('spinButton');
    spinButton.addEventListener('click', handleSpin);

    // Save Pair Button
    const savePairButton = document.getElementById('savePairButton');
    savePairButton.addEventListener('click', savePair);

    // Spin Again Button
    const spinAgainButton = document.getElementById('spinAgainButton');
    spinAgainButton.addEventListener('click', spinAgain);

    // View Pairs Button (opens modal) - Update table when modal is shown
    const pairsModal = document.getElementById('pairsModal');
    if (pairsModal) {
        pairsModal.addEventListener('show.bs.modal', () => {
            updatePairsTable();
        });
    }

    // Download Button
    const downloadButton = document.getElementById('downloadButton');
    downloadButton.addEventListener('click', downloadPairsExcel);

    // Reset Button
    const confirmResetButton = document.getElementById('confirmResetButton');
    if (confirmResetButton) {
        confirmResetButton.addEventListener('click', resetAllData);
    }
}

/**
 * Handle Excel file upload
 */
function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if SheetJS is loaded
    if (typeof XLSX === 'undefined') {
        showAlert('uploadStatus', 'danger', 'Excel library not loaded. Please refresh the page.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get the first worksheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON (array of arrays)
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            
            parseExcelData(jsonData);
        } catch (error) {
            showAlert('uploadStatus', 'danger', 'Error reading Excel file. Please make sure it is a valid Excel file.');
            console.error('Excel parsing error:', error);
        }
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Parse Excel data (single column)
 */
function parseExcelData(excelData) {
    const names = [];
    const seen = new Set();

    // Extract names from first column of Excel data
    excelData.forEach(row => {
        if (Array.isArray(row) && row.length > 0) {
            const name = String(row[0]).trim();
            if (name && name !== '' && !seen.has(name.toLowerCase())) {
                names.push(name);
                seen.add(name.toLowerCase());
            }
        }
    });

    // Check for minimum 2 names
    if (names.length < 2) {
        showAlert('uploadStatus', 'danger', 'Excel file must contain at least 2 unique names in the first column.');
        return;
    }

    // Store participants
    allParticipants = names;
    saveParticipants();

    // Show success message
    showAlert('uploadStatus', 'success', `Successfully uploaded ${names.length} participants!`);
    document.getElementById('uploadedNames').innerHTML = `
        <strong>Uploaded Names:</strong> ${names.join(', ')}
    `;

    // Reset state
    currentSpinner = null;
    secretSantaPairs = [];
    savePairs();
    updateUI();
}

// ============================================
// ADMIN SELECTOR
// ============================================

/**
 * Get available spinners (people who haven't spun yet)
 */
function getAvailableSpinners() {
    const spunGivers = secretSantaPairs.map(pair => pair.giver);
    return allParticipants.filter(name => !spunGivers.includes(name));
}

/**
 * Filter admin dropdown based on search input
 */
function filterAdminDropdown() {
    const searchTerm = document.getElementById('adminSearch').value.toLowerCase();
    const availableSpinners = getAvailableSpinners();
    const filtered = availableSpinners.filter(name => 
        name.toLowerCase().includes(searchTerm)
    );
    populateAdminDropdown(filtered);
}

/**
 * Populate admin dropdown
 */
function populateAdminDropdown(names) {
    const adminSelector = document.getElementById('adminSelector');
    adminSelector.innerHTML = '';

    if (names.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'No available spinners';
        option.disabled = true;
        adminSelector.appendChild(option);
        return;
    }

    names.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        adminSelector.appendChild(option);
    });
}

/**
 * Handle admin selection
 */
function handleAdminSelection(event) {
    const selectedName = event.target.value;
    if (!selectedName || selectedName === 'No available spinners') return;

    currentSpinner = selectedName;
    showAlert('selectedAdmin', 'success', `Current Spinner: <strong>${selectedName}</strong>`);
    updateUI();
}

// ============================================
// AVAILABLE RECEIVERS
// ============================================

/**
 * Update list of available receivers
 */
function updateAvailableReceivers() {
    const assignedReceivers = secretSantaPairs.map(pair => pair.receiver);
    availableReceivers = allParticipants.filter(name => 
        !assignedReceivers.includes(name) && name !== currentSpinner
    );
}

// ============================================
// DART WHEEL
// ============================================

/**
 * Create dart wheel with names (circular)
 */
function createDartWheel() {
    const dartWheel = document.getElementById('dartWheel');
    dartWheel.innerHTML = '';
    dartWheel.style.transform = 'rotate(0deg)';

    // Hide center display when creating new wheel
    const centerDisplay = document.getElementById('centerDisplay');
    if (centerDisplay) {
        centerDisplay.style.display = 'none';
    }

    if (availableReceivers.length === 0) {
        dartWheel.innerHTML = '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 20px;">No available receivers</div>';
        return;
    }

    const angleStep = 360 / availableReceivers.length;
    
    // Calculate radius dynamically based on container size
    const container = dartWheel.parentElement;
    const containerSize = Math.min(container.offsetWidth, container.offsetHeight) || 500;
    const radius = (containerSize / 2) - 20; // 20px padding from edge

    availableReceivers.forEach((name, index) => {
        const nameElement = document.createElement('div');
        nameElement.className = 'wheel-name';
        nameElement.textContent = name;
        nameElement.dataset.name = name;
        
        const angle = index * angleStep;
        nameElement.style.transform = `rotate(${angle}deg) translateY(-${radius}px)`;
        
        dartWheel.appendChild(nameElement);
    });
}

/**
 * Handle spin button click
 */
function handleSpin() {
    if (isSpinning || !currentSpinner || availableReceivers.length === 0) {
        return;
    }

    isSpinning = true;
    const spinButton = document.getElementById('spinButton');
    spinButton.disabled = true;

    // Hide previous result
    document.getElementById('spinResult').style.display = 'none';

    // Hide center display
    const centerDisplay = document.getElementById('centerDisplay');
    if (centerDisplay) {
        centerDisplay.style.display = 'none';
    }

    // Show arrow during spin
    const arrowIndicator = document.getElementById('arrowIndicator');
    if (arrowIndicator) {
        arrowIndicator.style.display = 'block';
    }

    // Remove previous selection highlight
    document.querySelectorAll('.wheel-name').forEach(el => {
        el.classList.remove('selected');
    });

    // Random rotation (multiple full rotations + random angle)
    const baseRotations = 5 + Math.random() * 5; // 5-10 full rotations
    const randomAngle = Math.random() * 360;
    const totalRotation = baseRotations * 360 + randomAngle;

    const dartWheel = document.getElementById('dartWheel');
    dartWheel.style.transform = `rotate(${totalRotation}deg)`;

    // After 5 seconds, determine winner
    setTimeout(() => {
        determineWinner(totalRotation);
        isSpinning = false;
        updateButtons();
    }, 5000);
}

/**
 * Determine winner based on final rotation
 */
function determineWinner(finalRotation) {
    // Hide arrow after spin completes
    const arrowIndicator = document.getElementById('arrowIndicator');
    if (arrowIndicator) {
        arrowIndicator.style.display = 'none';
    }

    // Normalize rotation to 0-360 range
    const normalizedRotation = ((finalRotation % 360) + 360) % 360;
    
    // Arrow points outward, so we need to find which name is at arrow position
    // Since names are positioned starting from top, we calculate which one is closest
    const angleStep = 360 / availableReceivers.length;
    
    // When wheel rotates clockwise by X degrees, a name originally at angle A
    // is now at angle (A - X) relative to fixed arrow
    // We need to find which name is at 0 degrees (top) after rotation
    // So: index * angleStep should be closest to normalizedRotation
    
    let targetIndex = Math.round(normalizedRotation / angleStep) % availableReceivers.length;
    if (targetIndex < 0) targetIndex = (targetIndex + availableReceivers.length) % availableReceivers.length;

    const winner = availableReceivers[targetIndex];

    // Highlight winner
    const winnerElement = document.querySelector(`.wheel-name[data-name="${winner}"]`);
    if (winnerElement) {
        winnerElement.classList.add('selected');
    }

    // Show selected receiver in center display
    showCenterDisplay(winner);

    // Store pending pair (not saved yet)
    pendingPair = {
        giver: currentSpinner,
        receiver: winner
    };

    // Show result with action buttons
    showSpinResult(currentSpinner, winner);
}

/**
 * Show selected receiver in center of wheel
 */
function showCenterDisplay(receiverName) {
    const centerDisplay = document.getElementById('centerDisplay');
    const centerDisplayName = document.getElementById('centerDisplayName');
    
    if (centerDisplay && centerDisplayName) {
        centerDisplayName.textContent = receiverName;
        centerDisplay.style.display = 'flex';
    }
}

/**
 * Show spin result with Save/Spin Again options
 */
function showSpinResult(giver, receiver) {
    const spinResult = document.getElementById('spinResult');
    const spinResultMessage = document.getElementById('spinResultMessage');
    const spinResultActions = document.getElementById('spinResultActions');

    spinResultMessage.innerHTML = 
        `<strong>${giver}</strong> will give a gift to <strong>${receiver}</strong>!<br>
        <small class="text-muted">Choose to save this pair or spin again</small>`;

    spinResult.style.display = 'block';
    spinResultActions.style.display = 'block';
}

/**
 * Save the pending pair
 */
function savePair() {
    if (!pendingPair) return;

    // Save pair to storage
    secretSantaPairs.push(pendingPair);
    savePairs();

    // Show confirmation
    const spinResultMessage = document.getElementById('spinResultMessage');
    spinResultMessage.innerHTML = 
        `<strong>✓ Pair saved!</strong><br>
        <strong>${pendingPair.giver}</strong> → <strong>${pendingPair.receiver}</strong>`;

    // Hide action buttons
    document.getElementById('spinResultActions').style.display = 'none';

    // Hide center display
    const centerDisplay = document.getElementById('centerDisplay');
    if (centerDisplay) {
        centerDisplay.style.display = 'none';
    }

    // Reset current spinner
    currentSpinner = null;
    pendingPair = null;
    document.getElementById('adminSearch').value = '';
    document.getElementById('selectedAdmin').style.display = 'none';

    // Update UI
    setTimeout(() => {
        updateUI();
        document.getElementById('spinResult').style.display = 'none';
    }, 2000);
}

/**
 * Spin again without saving current result
 */
function spinAgain() {
    // Clear pending pair
    pendingPair = null;

    // Hide result
    document.getElementById('spinResult').style.display = 'none';
    document.getElementById('spinResultActions').style.display = 'none';

    // Remove selection highlight
    document.querySelectorAll('.wheel-name').forEach(el => {
        el.classList.remove('selected');
    });

    // Reset wheel rotation
    const dartWheel = document.getElementById('dartWheel');
    if (dartWheel) {
        dartWheel.style.transform = 'rotate(0deg)';
    }

    // Show arrow again for next spin
    const arrowIndicator = document.getElementById('arrowIndicator');
    if (arrowIndicator) {
        arrowIndicator.style.display = 'block';
    }

    // Hide center display
    const centerDisplay = document.getElementById('centerDisplay');
    if (centerDisplay) {
        centerDisplay.style.display = 'none';
    }

    // Update available receivers (in case we need to refresh)
    updateAvailableReceivers();
    createDartWheel();

    // Update buttons
    updateButtons();

    // Automatically trigger a new spin after a short delay to ensure UI is ready
    setTimeout(() => {
        if (currentSpinner && availableReceivers.length > 0 && !isSpinning) {
            handleSpin();
        }
    }, 100);
}

// ============================================
// PAIRS TABLE
// ============================================

/**
 * Update pairs table in modal
 */
function updatePairsTable() {
    const tbody = document.getElementById('pairsTableModal').querySelector('tbody');
    tbody.innerHTML = '';

    if (secretSantaPairs.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="2" class="text-center text-muted">No pairs selected yet</td>';
        tbody.appendChild(row);
        return;
    }

    secretSantaPairs.forEach(pair => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${pair.giver}</td>
            <td>${pair.receiver}</td>
        `;
        tbody.appendChild(row);
    });
}

// ============================================
// CSV DOWNLOAD
// ============================================

/**
 * Download sample Excel file
 */
function downloadSampleCSV() {
    // Check if SheetJS is loaded
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }

    // Create sample data
    const sampleNames = [
        'Alice',
        'Bob',
        'Charlie',
        'Diana',
        'Eve',
        'Frank'
    ];
    
    // Create worksheet data (single column)
    const worksheetData = sampleNames.map(name => [name]);

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column width
    ws['!cols'] = [{ wch: 20 }];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Participants');

    // Generate Excel file and download
    XLSX.writeFile(wb, 'sample_participants.xlsx');
}

/**
 * Download pairs as Excel file
 */
function downloadPairsExcel() {
    if (secretSantaPairs.length === 0) {
        alert('No pairs to download.');
        return;
    }

    // Check if SheetJS is loaded
    if (typeof XLSX === 'undefined') {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }

    // Create worksheet data
    const worksheetData = [
        ['Giver', 'Receiver'] // Header row
    ];

    // Add pairs data
    secretSantaPairs.forEach(pair => {
        worksheetData.push([pair.giver, pair.receiver]);
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    ws['!cols'] = [
        { wch: 20 }, // Giver column width
        { wch: 20 }  // Receiver column width
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Secret Santa Pairs');

    // Generate Excel file and download
    XLSX.writeFile(wb, 'secret_santa_pairs.xlsx');
}

// ============================================
// UI UPDATES
// ============================================

/**
 * Update all UI elements
 */
function updateUI() {
    updateAvailableReceivers();
    updateAdminDropdown();
    createDartWheel();
    updatePairsTable();
    updateButtons();
}

/**
 * Update admin dropdown
 */
function updateAdminDropdown() {
    // Respect current search term if any
    const searchTerm = document.getElementById('adminSearch').value.toLowerCase();
    const availableSpinners = getAvailableSpinners();
    
    if (searchTerm) {
        const filtered = availableSpinners.filter(name => 
            name.toLowerCase().includes(searchTerm)
        );
        populateAdminDropdown(filtered);
    } else {
        populateAdminDropdown(availableSpinners);
    }
}

/**
 * Update button states
 */
function updateButtons() {
    const spinButton = document.getElementById('spinButton');
    const viewPairsButton = document.getElementById('viewPairsButton');
    const downloadButton = document.getElementById('downloadButton');

    // Spin button enabled only if admin selected, receivers available, not spinning, and no pending pair
    spinButton.disabled = !currentSpinner || availableReceivers.length === 0 || isSpinning || pendingPair !== null;

    // View pairs button enabled only if there are pairs
    viewPairsButton.disabled = secretSantaPairs.length === 0;

    // Download button enabled only if there are pairs
    downloadButton.disabled = secretSantaPairs.length === 0;
}

/**
 * Show alert message
 */
function showAlert(elementId, type, message) {
    const alertElement = document.getElementById(elementId);
    alertElement.className = `alert alert-${type}`;
    alertElement.innerHTML = message;
    alertElement.style.display = 'block';
}

// ============================================
// RESET FUNCTIONALITY
// ============================================

/**
 * Reset all data and start fresh
 */
function resetAllData() {
    // Clear LocalStorage
    localStorage.removeItem(STORAGE_KEYS.PARTICIPANTS);
    localStorage.removeItem(STORAGE_KEYS.PAIRS);

    // Reset global state
    allParticipants = [];
    secretSantaPairs = [];
    currentSpinner = null;
    availableReceivers = [];
    isSpinning = false;
    pendingPair = null;

    // Clear file input
    const csvFileInput = document.getElementById('csvFile');
    if (csvFileInput) {
        csvFileInput.value = '';
    }

    // Clear admin search
    const adminSearch = document.getElementById('adminSearch');
    if (adminSearch) {
        adminSearch.value = '';
    }

    // Hide all alerts and results
    document.getElementById('uploadStatus').style.display = 'none';
    document.getElementById('uploadedNames').innerHTML = '';
    document.getElementById('selectedAdmin').style.display = 'none';
    document.getElementById('spinResult').style.display = 'none';
    document.getElementById('spinResultActions').style.display = 'none';

    // Reset wheel rotation
    const dartWheel = document.getElementById('dartWheel');
    if (dartWheel) {
        dartWheel.innerHTML = '';
        dartWheel.style.transform = 'rotate(0deg)';
    }

    // Show arrow
    const arrowIndicator = document.getElementById('arrowIndicator');
    if (arrowIndicator) {
        arrowIndicator.style.display = 'block';
    }

    // Remove selection highlights
    document.querySelectorAll('.wheel-name').forEach(el => {
        el.classList.remove('selected');
    });

    // Close reset modal
    const resetModal = bootstrap.Modal.getInstance(document.getElementById('resetModal'));
    if (resetModal) {
        resetModal.hide();
    }

    // Update UI
    updateUI();

    // Show success message
    showAlert('uploadStatus', 'success', '✓ All data has been reset. You can now upload a new CSV file to start fresh!');
    
    // Auto-hide success message after 5 seconds
    setTimeout(() => {
        document.getElementById('uploadStatus').style.display = 'none';
    }, 5000);
}

