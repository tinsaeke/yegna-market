export interface Order {
  id: number;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  total?: number;
  status?: 'pending' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'failed';
  payment_method: string;
  shipping_address: string;
  receipt_url?: string;
  created_at: string;
  seller_orders?: SellerOrder[];
}

export interface SellerOrder {
  id: number;
  order_id: number;
  seller_id: number;
  seller_name?: string;
  subtotal: number;
  status: 'pending' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  tracking_number?: string;
  shipped_at?: string;
  delivered_at?: string;
  created_at: string;
  items?: OrderItem[];
  orders?: Order;
  receipt_image?: string;
}

export interface OrderItem {
  id: number;
  seller_order_id: number;
  product_id: number;
  product_name: string;
  product_image: string;
  price: number;
  quantity: number;
  created_at: string;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
}

export interface CreateOrderData {
  customer_name: string;
  customer_email: string;
  total_amount: number;
  payment_method: string;
  shipping_address: string;
  items: {
    product_id: number;
    seller_id: number;
    quantity: number;
    price: number;
    product_name: string;
    product_image: string;
  }[];
}