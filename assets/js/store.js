/* ============================================================
 *  STOREFRONT LOGIC
 * ============================================================ */

let ALL_PRODUCTS = [];
let ACTIVE_CATEGORY = 'all';
let SEARCH_TERM = '';
let CART = loadCart();

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('siteNameEl').textContent = CONFIG.SITE_NAME;
  document.getElementById('footerNameEl').textContent = CONFIG.SITE_NAME;
  document.getElementById('siteTagEl').textContent = CONFIG.TAGLINE;
  document.getElementById('taglineEl').textContent = CONFIG.TAGLINE;
  document.getElementById('yearEl').textContent = new Date().getFullYear();
  if (CONFIG.SUPPORT_PHONE) {
    document.getElementById('supportEl').textContent = 'Support: ' + CONFIG.SUPPORT_PHONE;
  }
  document.title = CONFIG.SITE_NAME + ' — Shop';

  loadProducts();
  renderCart();
  bindEvents();
});

/* ---------- Load & render products ---------- */
async function loadProducts() {
  const grid = document.getElementById('productGrid');
  try {
    const data = await callApi('getProducts');
    ALL_PRODUCTS = data.products || [];
    renderCategories();
    renderProducts();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Couldn't load products.<br><small>${escapeHtml(err.message)}</small></div>`;
  }
}

function renderCategories() {
  const row = document.getElementById('categoryRow');
  const categories = Array.from(new Set(ALL_PRODUCTS.map(p => p.category).filter(Boolean)));
  row.innerHTML = '';

  const allChip = makeChip('All', 'all');
  row.appendChild(allChip);
  categories.forEach(cat => row.appendChild(makeChip(cat, cat)));
}

function makeChip(label, value) {
  const btn = document.createElement('button');
  btn.className = 'chip' + (value === ACTIVE_CATEGORY ? ' active' : '');
  btn.textContent = label;
  btn.dataset.category = value;
  btn.addEventListener('click', () => {
    ACTIVE_CATEGORY = value;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderProducts();
  });
  return btn;
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  let list = ALL_PRODUCTS;

  if (ACTIVE_CATEGORY !== 'all') {
    list = list.filter(p => p.category === ACTIVE_CATEGORY);
  }
  if (SEARCH_TERM) {
    const term = SEARCH_TERM.toLowerCase();
    list = list.filter(p =>
      (p.name || '').toLowerCase().includes(term) ||
      (p.description || '').toLowerCase().includes(term)
    );
  }

  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-state">No products found.</div>';
    return;
  }

  grid.innerHTML = list.map(productCardHtml).join('');

  grid.querySelectorAll('[data-add-id]').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.addId));
  });
}

function productCardHtml(p) {
  const outOfStock = Number(p.stock) <= 0;
  const thumb = p.imageUrl
    ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy">`
    : `<span class="placeholder">${escapeHtml((p.name || '?').charAt(0))}</span>`;

  return `
    <div class="product-card">
      <div class="product-thumb">${thumb}</div>
      <div class="product-body">
        ${p.category ? `<span class="product-category">${escapeHtml(p.category)}</span>` : ''}
        <span class="product-name">${escapeHtml(p.name)}</span>
        ${p.description ? `<span class="product-desc">${escapeHtml(p.description)}</span>` : ''}
        <div class="product-footer">
          <span class="product-price">${formatMoney(p.price)}</span>
          ${outOfStock
            ? '<span class="stock-flag">Out of stock</span>'
            : `<button class="add-btn" data-add-id="${escapeHtml(p.id)}">Add</button>`}
        </div>
      </div>
    </div>`;
}

/* ---------- Cart ---------- */
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem('cod_cart') || '[]');
  } catch (e) {
    return [];
  }
}

function saveCart() {
  localStorage.setItem('cod_cart', JSON.stringify(CART));
}

function addToCart(productId) {
  const product = ALL_PRODUCTS.find(p => String(p.id) === String(productId));
  if (!product) return;

  const existing = CART.find(i => i.id === product.id);
  const maxStock = Number(product.stock) || 0;

  if (existing) {
    if (existing.qty < maxStock) existing.qty += 1;
  } else {
    CART.push({ id: product.id, name: product.name, price: Number(product.price), imageUrl: product.imageUrl, qty: 1 });
  }
  saveCart();
  renderCart();
  showToast(product.name + ' added to cart');
}

function updateQty(productId, delta) {
  const item = CART.find(i => i.id === productId);
  if (!item) return;
  const product = ALL_PRODUCTS.find(p => String(p.id) === String(productId));
  const maxStock = product ? Number(product.stock) : 999;

  item.qty += delta;
  if (item.qty > maxStock) item.qty = maxStock;
  if (item.qty <= 0) {
    CART = CART.filter(i => i.id !== productId);
  }
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  CART = CART.filter(i => i.id !== productId);
  saveCart();
  renderCart();
}

function cartTotal() {
  return CART.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function renderCart() {
  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  const count = CART.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartCount').textContent = count;

  if (CART.length === 0) {
    body.innerHTML = '<div class="empty-cart">Your cart is empty.<br>Add something you like!</div>';
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';
  document.getElementById('cartSubtotal').textContent = formatMoney(cartTotal());

  body.innerHTML = CART.map(item => `
    <div class="cart-item">
      ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="">` : '<img src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2756%27 height=%2756%27/%3E" alt="">'}
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">${formatMoney(item.price)} each</div>
        <div class="qty-control">
          <button data-qty-minus="${escapeHtml(item.id)}">&minus;</button>
          <span>${item.qty}</span>
          <button data-qty-plus="${escapeHtml(item.id)}">+</button>
          <button class="remove-link" data-remove="${escapeHtml(item.id)}">Remove</button>
        </div>
      </div>
    </div>
  `).join('');

  body.querySelectorAll('[data-qty-minus]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.qtyMinus, -1)));
  body.querySelectorAll('[data-qty-plus]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.qtyPlus, 1)));
  body.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => removeFromCart(b.dataset.remove)));
}

/* ---------- Drawer / modal controls ---------- */
function bindEvents() {
  const overlay = document.getElementById('overlay');
  const drawer = document.getElementById('cartDrawer');

  document.getElementById('openCartBtn').addEventListener('click', () => {
    overlay.classList.add('open');
    drawer.classList.add('open');
  });
  document.getElementById('closeCartBtn').addEventListener('click', closeDrawer);
  overlay.addEventListener('click', () => {
    closeDrawer();
    closeModal('checkoutModal');
    closeModal('confirmModal');
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    SEARCH_TERM = e.target.value;
    renderProducts();
  });

  document.getElementById('checkoutBtn').addEventListener('click', () => {
    if (CART.length === 0) return;
    closeDrawer();
    openModal('checkoutModal');
  });

  document.getElementById('checkoutForm').addEventListener('submit', handleCheckoutSubmit);

  document.getElementById('custMobile').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });
  document.getElementById('custPincode').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });
}

function closeDrawer() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('cartDrawer').classList.remove('open');
}

function openModal(id) {
  document.getElementById('overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (!document.getElementById('confirmModal').classList.contains('open') &&
      !document.getElementById('checkoutModal').classList.contains('open')) {
    document.getElementById('overlay').classList.remove('open');
  }
}

/* ---------- Checkout ---------- */
function validateCheckoutForm() {
  let valid = true;
  const checks = [
    { id: 'custName', test: v => v.trim().length > 0 },
    { id: 'custMobile', test: v => /^[6-9]\d{9}$/.test(v.trim()) },
    { id: 'custAddress', test: v => v.trim().length > 4 },
    { id: 'custCity', test: v => v.trim().length > 0 },
    { id: 'custPincode', test: v => /^\d{6}$/.test(v.trim()) },
  ];

  checks.forEach(({ id, test }) => {
    const el = document.getElementById(id);
    const field = el.closest('.field');
    if (!test(el.value)) {
      field.classList.add('invalid');
      valid = false;
    } else {
      field.classList.remove('invalid');
    }
  });

  return valid;
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  const errorBox = document.getElementById('checkoutError');
  errorBox.classList.remove('show');

  if (!validateCheckoutForm()) return;

  const btn = document.getElementById('placeOrderBtn');
  btn.disabled = true;
  btn.textContent = 'Placing order…';

  const orderPayload = {
    customerName: document.getElementById('custName').value.trim(),
    mobile: document.getElementById('custMobile').value.trim(),
    address: document.getElementById('custAddress').value.trim(),
    city: document.getElementById('custCity').value.trim(),
    pincode: document.getElementById('custPincode').value.trim(),
    landmark: document.getElementById('custLandmark').value.trim(),
    notes: document.getElementById('custNotes').value.trim(),
    items: CART.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
    totalAmount: cartTotal(),
  };

  try {
    const result = await callApi('placeOrder', orderPayload);
    showReceipt(result.orderId, orderPayload);
    CART = [];
    saveCart();
    renderCart();
    document.getElementById('checkoutForm').reset();
    closeModal('checkoutModal');
    openModal('confirmModal');
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Place order — Pay on delivery';
  }
}

function showReceipt(orderId, order) {
  const itemRows = order.items.map(i => `
    <div class="receipt-row"><span>${escapeHtml(i.name)} &times;${i.qty}</span><span>${formatMoney(i.price * i.qty)}</span></div>
  `).join('');

  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt-head">
      <div class="stamp">COD confirmed</div>
      <div class="order-id">#${escapeHtml(orderId)}</div>
    </div>
    <div class="receipt-divider"></div>
    ${itemRows}
    <div class="receipt-divider"></div>
    <div class="receipt-row total"><span>Total to pay on delivery</span><span>${formatMoney(order.totalAmount)}</span></div>
    <div class="receipt-note">
      Thanks, ${escapeHtml(order.customerName)}! We'll deliver to ${escapeHtml(order.address)}, ${escapeHtml(order.city)} and collect payment in cash on arrival.
    </div>
    <button class="continue-btn" onclick="closeModal('confirmModal')">Continue shopping</button>
  `;
}

/* ---------- Utilities ---------- */
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
