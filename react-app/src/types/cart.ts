export interface CartItem {
  id: number;
  seller_id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
  product_type: 'physical' | 'digital';
  stock_quantity: number;
}

export interface CartSummary {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  itemCount: number;
}