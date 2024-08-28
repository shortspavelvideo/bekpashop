let allProducts = [];
let currentPage = 1;
const productsPerPage = 12;
let cart = [];
let pageHistory = ['home'];
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
  try {
    const response = await fetch('/check-feature/isMyFirstFeatureEnabled');
    if (!response.ok) {
      throw new Error('Failed to fetch feature flag');
    }
    const data = await response.json();
    if (data.featureEnabled) {
      console.log('My first feature is enabled');
      await fetchProducts();
      setupEventListeners();
      history.replaceState({ page: 'home' }, '', '/');
    } else {
      console.log('My first feature is disabled');
    }
  } catch (error) {
    console.error('Error fetching feature flag:', error);
    zobrazChybovouZpravu('Nepodařilo se načíst konfiguraci aplikace. Prosím, obnovte stránku.');
  }
}

function zobrazChybovouZpravu(zprava) {
  const chybovyDiv = document.createElement('div');
  chybovyDiv.textContent = zprava;
  chybovyDiv.style.cssText = `
    color: red;
    padding: 10px;
    margin: 10px 0;
    border: 1px solid red;
    border-radius: 5px;
  `;
  
  const contentDiv = document.getElementById('content');
  contentDiv.insertBefore(chybovyDiv, contentDiv.firstChild);
}

async function fetchProducts() {
  const cachedProducts = getCachedData('products');
  if (cachedProducts) {
    allProducts = cachedProducts;
    showHomePage();
    displayCategories();
  } else {
    try {
      const response = await fetch('/products');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      allProducts = await response.json();
      cacheData('products', allProducts, 5); // Cache na 5 minut
      showHomePage();
      displayCategories();
    } catch (error) {
      console.error('Error fetching products:', error);
      zobrazChybovouZpravu('Nepodařilo se načíst produkty. Prosím, zkuste to znovu později.');
    }
  }
}

function setupEventListeners() {
  document.getElementById('search-input').addEventListener('input', filterProducts);
  document.getElementById('sort-select').addEventListener('change', sortProducts);
  document.getElementById('cart-icon').addEventListener('click', showCart);
  document.getElementById('checkout-button').addEventListener('click', checkout);
  document.getElementById('main-back-button').addEventListener('click', showHomePage);
  document.getElementById('open-cart-button').addEventListener('click', showCart);

  setupCartEventListeners();

  window.addEventListener('popstate', handlePopState);
}

function setupCartEventListeners() {
  const cartModal = document.getElementById('cart-modal');
  const closeButton = cartModal.querySelector('.close');
  if (closeButton) {
    closeButton.addEventListener('click', closeCart);
  } else {
    console.error('Tlačítko pro zavření košíku nebylo nalezeno');
  }

  cartModal.addEventListener('click', function(event) {
    if (event.target === cartModal) {
      closeCart();
    }
  });

  const cartItemsContainer = document.getElementById('cart-items');
  cartItemsContainer.addEventListener('click', handleCartEvent);
}

function handlePopState(event) {
  if (event.state) {
    if (event.state.page === 'home') {
      showHomePage();
    } else if (event.state.page === 'product') {
      showProductDetail(event.state.productId);
    }
  } else {
    showHomePage();
  }
}

function handleCartEvent(event) {
  if (event.target.classList.contains('quantity-btn') || event.target.classList.contains('remove-btn')) {
    event.preventDefault();
    event.stopPropagation();
    
    const cartItem = event.target.closest('.cart-item');
    const productId = cartItem.dataset.productId;
    const variantId = cartItem.dataset.variantId;
    
    if (event.target.classList.contains('minus-btn')) {
      updateCartItemQuantity(productId, variantId, -1);
    } else if (event.target.classList.contains('plus-btn')) {
      updateCartItemQuantity(productId, variantId, 1);
    } else if (event.target.classList.contains('remove-btn')) {
      removeFromCart(productId, variantId);
    }
  }
}

function cacheData(key, data, expirationInMinutes) {
  const now = new Date();
  const item = {
    value: data,
    expiry: now.getTime() + expirationInMinutes * 60000,
  };
  localStorage.setItem(key, JSON.stringify(item));
}

function getCachedData(key) {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) {
    return null;
  }
  const item = JSON.parse(itemStr);
  const now = new Date();
  if (now.getTime() > item.expiry) {
    localStorage.removeItem(key);
    return null;
  }
  return item.value;
}

function filterProducts() {
  currentPage = 1;
  displayFilteredProducts();
}

function sortProducts() {
  const sortValue = document.getElementById('sort-select').value;
  let sortedProducts = [...getFilteredProducts()];

  switch(sortValue) {
    case 'name-asc':
      sortedProducts.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'name-desc':
      sortedProducts.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case 'price-asc':
      sortedProducts.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      sortedProducts.sort((a, b) => b.price - a.price);
      break;
  }

  currentPage = 1;
  displayProducts(sortedProducts);
  displayPagination(sortedProducts.length);
}

function displayProducts(products) {
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const displayedProducts = products.slice(startIndex, endIndex);

  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = displayedProducts.map(product => `
    <div class="product">
      <a href="#" onclick="showProductDetail('${product._id}'); return false;">
        <img class="main-image" src="${product.imageUrls[0]}" alt="${product.title}">
        <div class="product-info">
          <h2>${product.title}</h2>
          <p class="price">${product.price.toFixed(2)} Kč</p>
          <p class="vendor">${product.vendor}</p>
          <p class="availability ${product.availability ? 'in-stock' : 'out-of-stock'}">
            ${product.availability ? 'Skladem' : 'Vyprodáno'}
          </p>
        </div>
      </a>
      <div class="product-actions">
        ${product.variants && product.variants.length > 1 ? `
          <select class="variant-select" onchange="updateProductVariant('${product._id}', this.value)">
            ${product.variants.map(variant => `
              <option value="${variant.id}">${variant.title} - ${variant.price.toFixed(2)} Kč</option>
            `).join('')}
          </select>
        ` : ''}
        <button onclick="addToCart('${product._id}')" ${!product.availability ? 'disabled' : ''}>
          ${product.availability ? 'Přidat do košíku' : 'Vyprodáno'}
        </button>
      </div>
    </div>
  `).join('');
}

function displayPagination(totalProducts) {
  const totalPages = Math.ceil(totalProducts / productsPerPage);
  const paginationDiv = document.getElementById('pagination');
  let paginationHTML = '';

  paginationHTML += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Předchozí</button>`;

  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    paginationHTML += `<button onclick="changePage(1)">1</button>`;
    if (startPage > 2) {
      paginationHTML += `<span>...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `<button onclick="changePage(${i})" ${i === currentPage ? 'class="active"' : ''}>${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `<span>...</span>`;
    }
    paginationHTML += `<button onclick="changePage(${totalPages})">${totalPages}</button>`;
  }

  paginationHTML += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Další</button>`;

  paginationDiv.innerHTML = paginationHTML;
}

function changePage(page) {
  const filteredProducts = getFilteredProducts();
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  if (page < 1) {
    page = 1;
  } else if (page > totalPages) {
    page = totalPages;
  }

  currentPage = page;
  displayFilteredProducts();
  window.scrollTo(0, 0);
}

function displayCategories() {
  const categories = ['all', ...new Set(allProducts.map(product => product.category))];
  const categoriesMenu = document.getElementById('categories-menu');
  categoriesMenu.innerHTML = categories.map(category => 
    `<button onclick="filterByCategory('${category}')" 
     ${category === currentCategory ? 'class="active"' : ''}>
     ${category === 'all' ? 'Všechny' : category}
    </button>`
  ).join('');
}

function filterByCategory(category) {
  currentCategory = category;
  currentPage = 1;
  displayFilteredProducts();
  updateBackButtonVisibility(category === 'all');
}

function getFilteredProducts() {
  const searchTerm = document.getElementById('search-input').value.toLowerCase();
  return allProducts.filter(product => 
    (currentCategory === 'all' || product.category === currentCategory) &&
    (product.title.toLowerCase().includes(searchTerm) ||
     product.description.toLowerCase().includes(searchTerm))
  );
}

function displayFilteredProducts() {
  const filteredProducts = getFilteredProducts();
  displayProducts(filteredProducts);
  displayPagination(filteredProducts.length);
}

async function showProductDetail(productId) {
  try {
    const response = await fetch(`/products/${productId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch product details');
    }
    const product = await response.json();
    displayProductDetail(product);
    updatePageHistory(productId);
    updateHistory('product', productId);
    document.getElementById('main-back-button').classList.add('show');
  } catch (error) {
    console.error('Error fetching product details:', error);
    zobrazChybovouZpravu('Nepodařilo se načíst detail produktu. Prosím, zkuste to znovu později.');
  }
}

function displayProductDetail(product) {
  const contentDiv = document.getElementById('content');
  
  let optionsHTML = '';
  if (product.variants && product.variants.length > 1) {
    optionsHTML = `
      <div class="product-option">
        <select id="variant-select" class="variant-select" onchange="updateProductVariant('${product._id}', this.value)">
          ${product.variants.map(variant => `
            <option value="${variant.id}">${variant.title} - ${variant.price.toFixed(2)} Kč</option>
          `).join('')}
        </select>
      </div>
    `;
  }

  const mainVariant = product.variants && product.variants.length > 0 ? product.variants[0] : {
    id: product._id,
    title: 'Default',
    price: product.price,
    inventory_quantity: product.availability ? 1 : 0
  };

  contentDiv.innerHTML = `
    <div class="product-detail">
      <div class="product-detail-left">
        <img class="main-image" src="${product.imageUrls[0]}" alt="${product.title}">
        <div class="product-images">
          ${product.imageUrls.map(url => `<img src="${url}" alt="${product.title}" onclick="changeMainImage(this.src)">`).join('')}
        </div>
      </div>
      <div class="product-detail-right">
      <h2>${product.title}</h2>
        <p class="price">Cena: <span id="product-price">${mainVariant.price.toFixed(2)}</span> Kč</p>
        <p id="product-availability" class="availability ${mainVariant.inventory_quantity > 0 ? 'in-stock' : 'out-of-stock'}">
          ${mainVariant.inventory_quantity > 0 ? 'Skladem' : 'Vyprodáno'}
        </p>
        ${optionsHTML}
        <div class="product-description">${product.description}</div>
        <p class="category">Kategorie: ${product.category}</p>
        <p class="vendor">Výrobce: ${product.vendor}</p>
        ${product.weight ? `<p class="weight">Hmotnost: ${product.weight} ${product.weight_unit}</p>` : ''}
        ${product.dimensions ? `
          <p class="dimensions">Rozměry: 
            ${product.dimensions.height ? product.dimensions.height + ' cm (výška)' : ''}
            ${product.dimensions.width ? product.dimensions.width + ' cm (šířka)' : ''}
            ${product.dimensions.depth ? product.dimensions.depth + ' cm (hloubka)' : ''}
          </p>
          ` : ''}
        ${product.materials && product.materials.length ? `<p class="materials">Materiály: ${product.materials.join(', ')}</p>` : ''}
        ${product.care_instructions ? `<p class="care-instructions">Péče o produkt: ${product.care_instructions}</p>` : ''}
        ${product.warranty_info ? `<p class="warranty-info">Záruka: ${product.warranty_info}</p>` : ''}
        ${product.estimated_delivery_time ? `<p class="delivery-time">Odhadovaný čas dodání: ${product.estimated_delivery_time}</p>` : ''}
        <button id="add-to-cart-button" onclick="addToCart('${product._id}')" ${mainVariant.inventory_quantity <= 0 ? 'disabled' : ''}>
          ${mainVariant.inventory_quantity > 0 ? 'Přidat do košíku' : 'Vyprodáno'}
        </button>
      </div>
    </div>
  `;

  updateProductVariant(product._id, mainVariant.id);
}

function updateProductVariant(productId, variantId) {
  const product = allProducts.find(p => p._id === productId);
  if (!product) {
    console.error('Produkt nebyl nalezen, ID:', productId);
    return;
  }

  let selectedVariant;
  if (product.variants && product.variants.length > 0) {
    selectedVariant = product.variants.find(v => v.id === variantId);
  } else {
    selectedVariant = {
      id: product.shopifyVariantId || product._id,
      title: 'Default',
      price: product.price,
      inventory_quantity: product.availability ? 1 : 0
    };
  }

  if (!selectedVariant) {
    console.error('Varianta nebyla nalezena, ID varianty:', variantId);
    return;
  }

  const priceElement = document.getElementById('product-price');
  const availabilityElement = document.getElementById('product-availability');
  const addToCartButton = document.getElementById('add-to-cart-button');

  if (priceElement) priceElement.textContent = selectedVariant.price.toFixed(2);
  
  if (availabilityElement) {
    if (selectedVariant.inventory_quantity > 0) {
      availabilityElement.textContent = 'Skladem';
      availabilityElement.className = 'availability in-stock';
    } else {
      availabilityElement.textContent = 'Vyprodáno';
      availabilityElement.className = 'availability out-of-stock';
    }
  }

  if (addToCartButton) {
    if (selectedVariant.inventory_quantity > 0) {
      addToCartButton.disabled = false;
      addToCartButton.textContent = 'Přidat do košíku';
    } else {
      addToCartButton.disabled = true;
      addToCartButton.textContent = 'Vyprodáno';
    }
  }
}

function changeMainImage(src) {
  document.querySelector('.product-detail .main-image').src = src;
}

function updatePageHistory(page) {
  pageHistory.push(page);
}

function updateBackButtonVisibility(isHomePage) {
  const backButton = document.getElementById('main-back-button');
  if (isHomePage) {
    backButton.classList.remove('show');
  } else {
    backButton.classList.add('show');
  }
}

function showHomePage() {
  currentCategory = 'all';
  currentPage = 1;
  displayFilteredProducts();
  displayCategories();
  updatePageHistory('home');
  updateHistory('home');
  document.getElementById('main-back-button').classList.remove('show');
}

function updateHistory(page, productId = null) {
  if (page === 'home') {
    history.pushState({ page: 'home' }, '', '/');
  } else {
    history.pushState({ page: 'product', productId: productId }, '', `/product/${productId}`);
  }
}

function showAddToCartMessage(productName) {
    const message = document.createElement('div');
    message.textContent = `${productName} byl přidán do košíku`;
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: green;
      color: white;
      padding: 10px;
      border-radius: 5px;
      z-index: 1000;
    `;
    document.body.appendChild(message);
    setTimeout(() => {
        document.body.removeChild(message);
    }, 3000);
}

function showCart() {
  const modal = document.getElementById('cart-modal');
  const cartItems = document.getElementById('cart-items');
  const cartTotalElement = modal.querySelector('.celkova-cena');
  
  if (cart.length === 0) {
    cartItems.innerHTML = '<p>Váš košík je prázdný.</p>';
    cartTotalElement.textContent = 'Celkem: 0 Kč';
  } else {
    cartItems.innerHTML = cart.map(item => {
      const variantTitle = item.selectedVariant.title !== 'Default' ? ` - ${item.selectedVariant.title}` : '';
      return `
        <div class="cart-item" data-product-id="${item._id}" data-variant-id="${item.selectedVariant.id}">
          <img src="${item.imageUrls[0]}" alt="${item.title}" class="cart-item-image">
          <div class="cart-item-details">
            <div class="cart-item-title">${item.title}${variantTitle}</div>
            <div class="cart-item-price">${(item.selectedVariant.price * item.quantity).toFixed(2)} Kč</div>
          </div>
          <div class="cart-item-quantity">
            <button class="quantity-btn minus-btn" data-product-id="${item._id}" data-variant-id="${item.selectedVariant.id}">-</button>
            <span>${item.quantity}</span>
            <button class="quantity-btn plus-btn" data-product-id="${item._id}" data-variant-id="${item.selectedVariant.id}">+</button>
          </div>
          <button class="remove-btn" data-product-id="${item._id}" data-variant-id="${item.selectedVariant.id}">X</button>
        </div>
      `;
    }).join('');
    
    const total = cart.reduce((sum, item) => sum + item.selectedVariant.price * item.quantity, 0);
    cartTotalElement.textContent = `Celkem: ${total.toFixed(2)} Kč`;
  }
  
  modal.style.display = 'block';
}

function updateCartItemQuantity(productId, variantId, change) {
  const itemIndex = cart.findIndex(item => item._id === productId && item.selectedVariant.id === variantId);
  if (itemIndex !== -1) {
    cart[itemIndex].quantity += change;
    if (cart[itemIndex].quantity < 1) {
      cart[itemIndex].quantity = 1;
    }
    updateCartCount();
    showCart();
  } else {
    console.error('Položka nebyla nalezena v košíku');
  }
}

function removeFromCart(productId, variantId) {
  cart = cart.filter(item => !(item._id === productId && item.selectedVariant.id === variantId));
  updateCartCount();
  showCart();
}

function updateCartCount() {
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + item.selectedVariant.price * item.quantity, 0);
  document.getElementById('cart-count').textContent = cartCount;
  document.getElementById('cart-total').textContent = `${cartTotal.toFixed(2)} Kč`;
}

function addToCart(productId) {
  const product = allProducts.find(p => p._id === productId);
  if (!product) {
    console.error('Produkt nebyl nalezen, ID:', productId);
    alert('Omlouváme se, ale tento produkt se nepodařilo přidat do košíku.');
    return;
  }

  let selectedVariant;

  const variantSelect = document.querySelector('.variant-select');
  if (variantSelect) {
    const selectedVariantId = variantSelect.value;
    selectedVariant = product.variants && product.variants.find(v => v.id === selectedVariantId);
  }

  if (!selectedVariant) {
    selectedVariant = {
      id: product.shopifyVariantId || product._id,
      title: 'Default',
      price: product.price,
      inventory_quantity: product.availability ? 1 : 0,
      sku: product.sku || '',
      option1: product.option1 || null,
      option2: product.option2 || null,
      option3: product.option3 || null
    };
  }

  const existingItemIndex = cart.findIndex(item => 
    item._id === productId && 
    item.selectedVariant.id === selectedVariant.id
  );

  if (existingItemIndex !== -1) {
    cart[existingItemIndex].quantity += 1;
  } else {
    cart.push({
      _id: product._id,
      title: product.title,
      imageUrls: product.imageUrls,
      selectedVariant: selectedVariant,
      quantity: 1,
      shopifyVariantId: selectedVariant.id
    });
  }

  updateCartCount();
  showCart();
  showAddToCartMessage(product.title);
}

function closeCart() {
  const modal = document.getElementById('cart-modal');
  modal.style.display = 'none';
}

async function processPayment() {
  const items = cart.map(item => ({
    shopifyVariantId: item.selectedVariant.id,
    quantity: item.quantity
  }));

  const totalPrice = cart.reduce((sum, item) => sum + item.selectedVariant.price * item.quantity, 0).toFixed(2);

  try {
    const response = await fetch('/create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items, totalPrice })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Nepodařilo se vytvořit platbu');
    }

    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      throw new Error('Nebyla poskytnuta URL pro checkout');
    }
  } catch (error) {
    console.error('Chyba při zpracování platby:', error);
    zobrazChybovouZpravu(`Při zpracování vaší platby došlo k chybě: ${error.message}`);
  }
}

function checkout() {
  if (cart.length === 0) {
    alert('Váš košík je prázdný. Prosím, přidejte položky před dokončením objednávky.');
    return;
  }
  processPayment();
}

// Exportování funkcí do globálního prostoru
window.showProductDetail = showProductDetail;
window.changePage = changePage;
window.filterByCategory = filterByCategory;
window.changeMainImage = changeMainImage;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.showCart = showCart;
window.closeCart = closeCart;
window.checkout = checkout;
window.updateCartItemQuantity = updateCartItemQuantity;
window.updateProductVariant = updateProductVariant;