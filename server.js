import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { isFeatureEnabled } from './configService.js';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';
import cron from 'node-cron';
import { authenticateToken, login, register } from './auth.js';
import { User } from './models/User.js';
import { Product } from './models/Product.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const serverCache = new NodeCache({ stdTTL: 600 });
const mongoUri = process.env.MONGO_URI;
const shopifyAccessToken = process.env.SHOPIFY_ACCESS_TOKEN;
const shopifyShopName = process.env.SHOPIFY_SHOP_NAME;
const apiVersion = process.env.API_VERSION || '2024-01';
const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

console.log('SHOPIFY_SHOP_NAME:', process.env.SHOPIFY_SHOP_NAME);
console.log('SHOPIFY_ACCESS_TOKEN (první 4 znaky):', process.env.SHOPIFY_ACCESS_TOKEN.substring(0, 4));

// Helper function to safely parse float values
function safeParseFloat(value) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https://*.alicdn.com;");
  res.cookie('exampleCookie', 'cookieValue', { sameSite: 'Lax', secure: true });
  next();
});

const cacheMiddleware = (duration) => (req, res, next) => {
  const key = req.originalUrl;
  const cachedResponse = serverCache.get(key);
  if (cachedResponse) {
    return res.send(cachedResponse);
  }
  res.sendResponse = res.send;
  res.send = (body) => {
    serverCache.set(key, body, duration);
    res.sendResponse(body);
  };
  next();
};

app.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300');
  next();
});

// Shopify API helpers
async function fetchFromShopify(endpoint, options = {}) {
  const url = `https://${shopifyShopName}/admin/api/${apiVersion}/${endpoint}`;
  const defaultOptions = {
    headers: {
      'X-Shopify-Access-Token': shopifyAccessToken,
      'Content-Type': 'application/json'
    }
  };
  const response = await fetch(url, { ...defaultOptions, ...options });
  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function syncProductsFromShopify() {
  console.log('Začínám synchronizaci produktů z Shopify');
  try {
    let url = 'products.json?limit=250';
    let allProducts = [];

    while (url) {
      const response = await fetch(`https://${shopifyShopName}/admin/api/${apiVersion}/${url}`, {
        headers: {
          'X-Shopify-Access-Token': shopifyAccessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Shopify API chyba: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      allProducts = allProducts.concat(data.products);

      const linkHeader = response.headers.get('Link');
      url = linkHeader && linkHeader.includes('rel="next"') 
        ? linkHeader.split('<')[1].split('>')[0] 
        : null;

      console.log(`Načteno ${allProducts.length} produktů`);
    }

    console.log(`Celkem načteno ${allProducts.length} produktů z Shopify`);

    await Product.deleteMany({});
    console.log('Smazány existující produkty z MongoDB');

    const newProducts = allProducts.map(shopifyProduct => {
      const mainVariant = shopifyProduct.variants[0];
      return new Product({
        title: shopifyProduct.title,
        imageUrls: shopifyProduct.images.map(image => image.src),
        description: shopifyProduct.body_html,
        price: safeParseFloat(mainVariant.price),
        category: shopifyProduct.product_type || 'Uncategorized',
        availability: mainVariant.inventory_quantity > 0,
        shopifyProductId: shopifyProduct.id,
        shopifyVariantId: mainVariant.id,
        variants: shopifyProduct.variants.map(variant => ({
          id: variant.id,
          title: variant.title,
          price: safeParseFloat(variant.price),
          sku: variant.sku,
          inventory_quantity: variant.inventory_quantity,
          option1: variant.option1,
          option2: variant.option2,
          option3: variant.option3
        })),
        options: shopifyProduct.options,
        vendor: shopifyProduct.vendor,
        tags: shopifyProduct.tags.split(', '),
        weight: safeParseFloat(mainVariant.weight),
        weight_unit: mainVariant.weight_unit,
        requires_shipping: mainVariant.requires_shipping,
        shipping_weight: safeParseFloat(mainVariant.weight),
        shipping_weight_unit: mainVariant.weight_unit,
        fulfillment_service: mainVariant.fulfillment_service,
        inventory_management: mainVariant.inventory_management,
        inventory_policy: mainVariant.inventory_policy,
        taxable: mainVariant.taxable,
        barcode: mainVariant.barcode,
        compare_at_price: safeParseFloat(mainVariant.compare_at_price),
        metafields: shopifyProduct.metafields ? shopifyProduct.metafields.map(metafield => ({
          key: metafield.key,
          value: metafield.value,
          namespace: metafield.namespace
        })) : [],
        dimensions: {
          height: null,
          width: null,
          depth: null
        },
        materials: [],
        care_instructions: '',
        warranty_info: '',
        estimated_delivery_time: ''
      });
    });

    await Product.insertMany(newProducts);
    console.log(`Uloženo ${newProducts.length} produktů do MongoDB`);

  } catch (error) {
    console.error('Chyba při synchronizaci produktů z Shopify:', error);
  }
}

async function verifyProductsHaveShopifyIds() {
  const products = await Product.find({});
  const productsWithoutId = products.filter(p => !p.shopifyVariantId);
  if (productsWithoutId.length > 0) {
    console.warn(`Varování: ${productsWithoutId.length} produktů nemá shopifyVariantId`);
    for (const product of productsWithoutId) {
      console.warn(`Produkt bez shopifyVariantId: ${product.title} (ID: ${product._id})`);
    }
  } else {
    console.log('Všechny produkty mají shopifyVariantId');
  }
}

async function getShopifyIds(productTitle) {
  try {
    const data = await fetchFromShopify(`products.json?title=${encodeURIComponent(productTitle)}`);
    const shopifyProduct = data.products[0];

    if (!shopifyProduct) {
      throw new Error('Product not found in Shopify');
    }

    return {
      shopifyProductId: shopifyProduct.id,
      shopifyVariantId: shopifyProduct.variants[0].id
    };
  } catch (error) {
    console.error(`Error fetching Shopify IDs for product "${productTitle}":`, error);
    return null;
  }
}

async function updateExistingProducts() {
  const products = await Product.find({ shopifyProductId: { $exists: false } });
  
  for (const product of products) {
    try {
      const shopifyIds = await getShopifyIds(product.title);
      
      if (shopifyIds) {
        product.shopifyProductId = shopifyIds.shopifyProductId;
        product.shopifyVariantId = shopifyIds.shopifyVariantId;
        await product.save();
        console.log(`Updated product "${product.title}" with Shopify IDs`);
      } else {
        console.warn(`Could not find Shopify IDs for product "${product.title}"`);
      }
    } catch (error) {
      console.error(`Error updating product "${product.title}":`, error);
    }
  }

  console.log('Finished updating existing products');
}

// Cron job pro periodickou synchronizaci
cron.schedule('0 * * * *', async () => {
  console.log('Spouštím periodickou synchronizaci produktů');
  await syncProductsFromShopify();
});

// Routes
app.post('/login', login);
app.post('/register', register);

app.get('/products', cacheMiddleware(600), async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    console.error('Chyba při načítání produktů:', error);
    res.status(500).json({ error: 'Nepodařilo se načíst produkty' });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Produkt nenalezen' });
    }
    res.json(product);
  } catch (error) {
    console.error('Chyba při načítání produktu:', error);
    res.status(500).json({ error: 'Nepodařilo se načíst produkt' });
  }
});

app.get('/shopify-products', async (req, res) => {
  try {
    const data = await fetchFromShopify('products.json');
    res.json(data);
  } catch (error) {
    console.error('Chyba při načítání produktů z Shopify:', error);
    res.status(500).json({ error: 'Nepodařilo se načíst produkty z Shopify' });
  }
});

app.get('/check-feature/:featureKey', async (req, res) => {
  try {
    const featureEnabled = await isFeatureEnabled(req.params.featureKey);
    res.json({ featureEnabled });
  } catch (error) {
    console.error('Chyba při kontrole feature flagu:', error);
    res.status(500).json({ error: 'Nepodařilo se zkontrolovat feature flag' });
  }
});

app.post('/create-payment', async (req, res) => {
  const { items, totalPrice } = req.body;
  console.log('Přijata žádost o platbu:', { items, totalPrice });

  try {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Neplatná data položek');
    }

    const draftOrderData = {
      draft_order: {
        line_items: items.map(item => ({
          variant_id: item.shopifyVariantId,
          quantity: item.quantity
        })),
        financial_status: 'pending',
      }
    };

    console.log('Odesílání draft order do Shopify:', JSON.stringify(draftOrderData));

    const responseData = await fetchFromShopify('draft_orders.json', {
      method: 'POST',
      body: JSON.stringify(draftOrderData)
    });

    console.log('Odpověď Shopify API:', JSON.stringify(responseData));

    if (!responseData.draft_order || !responseData.draft_order.invoice_url) {
      throw new Error('Shopify neposkytlo invoice_url');
    }

    const checkoutUrl = responseData.draft_order.invoice_url;
    console.log('Vytvořena checkout URL:', checkoutUrl);

    res.json({ 
      orderId: responseData.draft_order.id,
      checkoutUrl: checkoutUrl
    });
  } catch (error) {
    console.error('Chyba při vytváření platby:', error);
    res.status(500).json({ error: error.message || 'Nepodařilo se vytvořit platbu' });
  }
});

app.post('/sync-products', async (req, res) => {
  try {
    await syncProductsFromShopify();
    res.json({ message: 'Synchronizace produktů byla úspěšně dokončena.' });
  } catch (error) {
    console.error('Chyba při synchronizaci produktů:', error);
    res.status(500).json({ error: 'Nepodařilo se synchronizovat produkty.' });
  }
});

app.get('/related-products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Produkt nenalezen' });
    }
    
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id }
    }).limit(5);
    
    res.json(relatedProducts);
  } catch (error) {
    console.error('Chyba při načítání souvisejících produktů:', error);
    res.status(500).json({ error: 'Nepodařilo se načíst související produkty' });
  }
});

// Server startup //
mongoose.set('strictQuery', false);
mongoose.connect(mongoUri)
  .then(async () => {
    console.log('MongoDB connected');
    await verifyProductsHaveShopifyIds();
    const featureEnabled = await isFeatureEnabled('isMyFirstFeatureEnabled');
    if (featureEnabled) {
      console.log('My first feature is enabled');
      await syncProductsFromShopify();
      await updateExistingProducts();
    } else {
      console.log('My first feature is disabled');
    }
    startServer();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

function startServer() {
  const server = app.listen(port, (err) => {
    if (err) {
      console.error(`Failed to start server on port ${port}:`, err);
    } else {
      console.log(`Server running on port ${port}`);
    }
  });

  server.on('listening', () => {
    console.log(`Assigned port: ${server.address().port}`);
  });

  // Přidání procesu pro graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  });
}

export { app };