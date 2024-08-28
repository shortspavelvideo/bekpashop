//public/js/shopifyHelpers.js//
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const shopifyAccessToken = process.env.SHOPIFY_ACCESS_TOKEN;
const shopifyShopName = process.env.SHOPIFY_SHOP_NAME;
const apiVersion = process.env.API_VERSION || '2024-01';

export async function fetchFromShopify(endpoint, options = {}, retries = 3) {
  const url = `https://${shopifyShopName}/admin/api/${apiVersion}/${endpoint}`;
  const defaultOptions = {
    headers: {
      'X-Shopify-Access-Token': shopifyAccessToken,
      'Content-Type': 'application/json'
    }
  };
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}