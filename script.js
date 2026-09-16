// Backend URL
const API_URL = 'http://localhost:8000';

// Select elements
const form = document.getElementById('paymentForm');
const phoneInput = document.getElementById('phone');
const amountInput = document.getElementById('amount');
const referenceInput = document.getElementById('reference');
const payBtn = document.getElementById('payBtn');
const statusDiv = document.getElementById('status');
const transactionInfo = document.getElementById('transactionInfo');

let currentCheckoutId = null;
let pollInterval = null;

// Show status message
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

// Hide status
function hideStatus() {
  statusDiv.className = 'status';
  statusDiv.textContent = '';
}

// Format phone number
function formatPhone(phone) {
  phone = phone.replace(/\s+/g, '');
  if (phone.startsWith('0')) {
    phone = '254' + phone.slice(1);
  }
  if (phone.startsWith('+')) {
    phone = phone.slice(1);
  }
  return phone;
}

// Initiate payment
async function initiatePayment(phone, amount, reference) {
  const response = await fetch(`${API_URL}/api/payments/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone_number: phone,
      amount: amount,
      account_reference: reference,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Payment failed');
  }

  return response.json();
}

// Check transaction status
async function checkTransaction(checkoutId) {
  const response = await fetch(`${API_URL}/api/transactions/${checkoutId}`);
  if (!response.ok) return null;
  return response.json();
}

// Display transaction details
function displayTransaction(transaction) {
  let html = `
    <h3>Transaction Details</h3>
    <p><span class="label">Status:</span> ${transaction.status}</p>
    <p><span class="label">Phone:</span> ${transaction.phone_number}</p>
    <p><span class="label">Amount:</span> KES ${transaction.amount}</p>
  `;

  if (transaction.mpesa_receipt) {
    html += `<p><span class="label">Receipt:</span> <span class="receipt">${transaction.mpesa_receipt}</span></p>`;
  }

  if (transaction.result_desc) {
    html += `<p><span class="label">Message:</span> ${transaction.result_desc}</p>`;
  }

  transactionInfo.innerHTML = html;
  transactionInfo.classList.add('active');
}

// Poll for status updates
function startPolling(checkoutId) {
  let attempts = 0;
  const maxAttempts = 30; // 30 * 3 seconds = 90 seconds

  pollInterval = setInterval(async () => {
    attempts++;

    const transaction = await checkTransaction(checkoutId);

    if (transaction && transaction.status !== 'pending') {
      clearInterval(pollInterval);
      pollInterval = null;

      if (transaction.status === 'success') {
        showStatus('Payment successful!', 'success');
      } else {
        showStatus('Payment failed. Please try again.', 'error');
      }

      displayTransaction(transaction);
      payBtn.disabled = false;
      payBtn.textContent = 'Pay Now';
    } else if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      pollInterval = null;
      showStatus('Payment timed out. Please check your transactions.', 'error');
      payBtn.disabled = false;
      payBtn.textContent = 'Pay Now';
    }
  }, 3000);
}

// Handle form submit
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const phone = formatPhone(phoneInput.value.trim());
  const amount = parseFloat(amountInput.value);
  const reference = referenceInput.value.trim() || 'INV-001';

  // Validate
  if (!phone || phone.length !== 12) {
    showStatus('Please enter a valid phone number (2547XXXXXXXX)', 'error');
    return;
  }

  if (!amount || amount <= 0) {
    showStatus('Please enter a valid amount', 'error');
    return;
  }

  // Reset
  hideStatus();
  transactionInfo.classList.remove('active');
  payBtn.disabled = true;
  payBtn.textContent = 'Processing...';

  try {
    showStatus('Sending payment request...', 'info');

    const result = await initiatePayment(phone, amount, reference);
    currentCheckoutId = result.checkout_request_id;

    showStatus('Check your phone and enter your M-Pesa PIN.', 'info');

    // Start polling for status
    startPolling(currentCheckoutId);

  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
    payBtn.disabled = false;
    payBtn.textContent = 'Pay Now';
  }
});