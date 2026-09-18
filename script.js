// ============================================================
// CONFIGURATION
// ============================================================

const API_URL = 'https://mpesa.lemayian.com';
const DEFAULT_AMOUNT = 500;


// ============================================================
// DOM ELEMENTS
// ============================================================

const form = document.getElementById('paymentForm');
const phoneInput = document.getElementById('phone');
const amountInput = document.getElementById('amount');
const referenceInput = document.getElementById('reference');
const payBtn = document.getElementById('payBtn');
const statusDiv = document.getElementById('status');
const receiptDiv = document.getElementById('receipt');
const quickBtns = document.querySelectorAll('.quick-btn');


// ============================================================
// STATE
// ============================================================

let currentCheckoutId = null;
let pollInterval = null;


// ============================================================
// STATUS DISPLAY
// ============================================================

function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

function hideStatus() {
  statusDiv.className = 'status';
  statusDiv.textContent = '';
}


// ============================================================
// RECEIPT DISPLAY
// ============================================================

function showReceipt(data) {
  receiptDiv.innerHTML = `
    <h3>Payment Receipt</h3>
    <div class="receipt-row">
      <span class="receipt-label">Receipt No:</span>
      <span class="receipt-value receipt-code">${data.mpesa_receipt || '—'}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">Phone:</span>
      <span class="receipt-value">${data.phone_number}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">Amount:</span>
      <span class="receipt-value">KES ${data.amount}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">Status:</span>
      <span class="receipt-value" style="color: #0a7a0a;">SUCCESS</span>
    </div>
  `;
  receiptDiv.classList.add('active');
}

function hideReceipt() {
  receiptDiv.classList.remove('active');
  receiptDiv.innerHTML = '';
}


// ============================================================
// PHONE FORMATTING
// ============================================================

function formatPhone(phone) {
  phone = phone.replace(/\s+/g, '').replace(/[^0-9]/g, '');

  if (phone.startsWith('0')) {
    phone = '254' + phone.slice(1);
  }

  if (phone.startsWith('+254')) {
    phone = phone.slice(1);
  }

  if (phone.startsWith('7') || phone.startsWith('1')) {
    phone = '254' + phone;
  }

  return phone;
}


// ============================================================
// QUICK SELECT AMOUNTS
// ============================================================

quickBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const amount = btn.dataset.amount;
    amountInput.value = amount;
    updatePayButton();

    // Visual feedback
    quickBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});


// ============================================================
// UPDATE PAY BUTTON TEXT
// ============================================================

function updatePayButton() {
  const amount = parseFloat(amountInput.value) || 0;
  payBtn.textContent = `Pay KES ${amount.toLocaleString()}`;
}

amountInput.addEventListener('input', updatePayButton);


// ============================================================
// INITIATE PAYMENT
// ============================================================

async function initiatePayment(phone, amount, reference) {
  const response = await fetch(`${API_URL}/api/payments/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone_number: phone,
      amount: amount,
      account_reference: reference || 'INV-001',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Payment failed');
  }

  return response.json();
}


// ============================================================
// CHECK TRANSACTION STATUS
// ============================================================

async function checkTransaction(checkoutId) {
  const response = await fetch(`${API_URL}/api/transactions/${checkoutId}`, {
    headers: {
      'x-api-key': 'k9x2mPqR7vN4wL8tY3bH6jF1sD5gA0cE'
    }
  });

  if (!response.ok) return null;
  return response.json();
}


// ============================================================
// POLLING
// ============================================================

function startPolling(checkoutId) {
  let attempts = 0;
  const maxAttempts = 30; // 30 * 3 = 90 seconds

  pollInterval = setInterval(async () => {
    attempts++;

    const transaction = await checkTransaction(checkoutId);

    if (transaction && transaction.status !== 'pending') {
      clearInterval(pollInterval);
      pollInterval = null;

      if (transaction.status === 'success') {
        showStatus('✅ Payment successful!', 'success');
        showReceipt(transaction);
      } else {
        showStatus('❌ Payment failed. Please try again.', 'error');
      }

      resetButton();
    } else if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      pollInterval = null;
      showStatus('⏱️ Payment timed out. Please check your M-Pesa messages.', 'error');
      resetButton();
    }
  }, 3000);
}


// ============================================================
// BUTTON STATE
// ============================================================

function disableButton() {
  payBtn.disabled = true;
  payBtn.textContent = 'Processing...';
}

function resetButton() {
  payBtn.disabled = false;
  updatePayButton();
}


// ============================================================
// FORM SUBMISSION
// ============================================================

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const phone = formatPhone(phoneInput.value.trim());
  const amount = parseFloat(amountInput.value);
  const reference = referenceInput.value.trim() || 'INV-001';

  // Validation
  if (!phone || phone.length !== 12) {
    showStatus('Please enter a valid phone number (2547XXXXXXXX)', 'error');
    return;
  }

  if (!amount || amount <= 0) {
    showStatus('Please enter a valid amount', 'error');
    return;
  }

  // Reset UI
  hideStatus();
  hideReceipt();
  disableButton();

  try {
    showStatus('📲 Sending payment request...', 'info');

    const result = await initiatePayment(phone, amount, reference);
    currentCheckoutId = result.checkout_request_id;

    showStatus('📱 Check your phone and enter your M-Pesa PIN.', 'info');

    startPolling(currentCheckoutId);

  } catch (error) {
    showStatus(`❌ Error: ${error.message}`, 'error');
    resetButton();
  }
});


// ============================================================
// INITIALIZE
// ============================================================

amountInput.value = DEFAULT_AMOUNT;
updatePayButton();

// Auto-format phone on input
phoneInput.addEventListener('input', (e) => {
  let value = e.target.value.replace(/[^0-9]/g, '');

  if (value.startsWith('0') && value.length > 1) {
    value = '254' + value.slice(1);
  }

  if (value.length > 12) {
    value = value.slice(0, 12);
  }

  e.target.value = value;
});