//models/Product.js//
import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
    title: String,
    imageUrls: [String],
    description: String,
    price: { type: Number, default: null },
    category: String,
    availability: Boolean,
    shopifyProductId: String,
    shopifyVariantId: String,
    variants: [{
        id: String,
        title: String,
        price: { type: Number, default: null },
        sku: String,
        inventory_quantity: { type: Number, default: 0 },
        option1: String,
        option2: String,
        option3: String
    }],
    options: [{
        name: String,
        values: [String]
    }],
    vendor: String,
    tags: [String],
    weight: { type: Number, default: null },
    weight_unit: String,
    requires_shipping: Boolean,
    shipping_weight: { type: Number, default: null },
    shipping_weight_unit: String,
    fulfillment_service: String,
    inventory_management: String,
    inventory_policy: String,
    taxable: Boolean,
    barcode: String,
    compare_at_price: { type: Number, default: null },
    metafields: [{
        key: String,
        value: String,
        namespace: String
    }],
    dimensions: {
        height: Number,
        width: Number,
        depth: Number
    },
    materials: [String],
    care_instructions: String,
    warranty_info: String,
    estimated_delivery_time: String
});

export const Product = mongoose.model('Product', ProductSchema);