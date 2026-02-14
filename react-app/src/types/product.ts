export interface Product {
  id: number;
  seller_id: number;
  seller_name?: string;
  name: string;
  description: string;
  price: number;
  category_id: number;
  category_name: string;
  stock_quantity: number;
  product_type: 'physical' | 'digital';
  image: string;
  image_url?: string;
  status: 'active' | 'inactive';
  created_at: string;
  rating?: number;
  review_count?: number;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  created_at: string;
}

export interface Seller {
  id: number;
  user_id: string;
  shop_name: string;
  shop_description?: string;
  shop_logo: string;
  rating: number;
  total_sales: number;
  status: 'pending' | 'active' | 'suspended';
  created_at: string;
  bank_name?: string;
  account_number?: string;
  account_holder_name?: string;
}

export interface ProductFilters {
  category?: string;
  seller_id?: number;
  priceRange?: [number, number | typeof Infinity];
  productType?: 'physical' | 'digital';
  inStock?: boolean;
  lowStock?: boolean;
}

export interface CreateProductData {
  seller_id: number;
  name: string;
  description: string;
  price: number;
  category_id: number;
  stock_quantity: number;
  product_type: 'physical' | 'digital';
  image: string;
}