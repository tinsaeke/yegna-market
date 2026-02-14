import { supabase } from './supabase';
import { Product, Category, CreateProductData, Seller } from '../types/product';
import { Order, CreateOrderData, SellerOrder } from '../types/order';
import { logger } from '../utils/logger';
import { DatabaseError, NotFoundError, ValidationError, handleError } from '../utils/errors';

export class ProductService {
  static async getProducts(filters?: any): Promise<Product[]> {
    try {
      logger.debug('Fetching products', 'ProductService', { filters });
      
      let query = supabase
        .from('products')
        .select(`
          *,
          categories (name, icon),
          sellers (shop_name, rating, total_sales)
        `)
        .eq('status', 'active');

      if (filters?.category) {
        query = query.eq('categories.name', filters.category);
      }

      if (filters?.seller_id) {
        query = query.eq('seller_id', filters.seller_id);
      }

      const { data, error } = await query;
      if (error) {
        logger.error('Failed to fetch products', error, 'ProductService', { filters });
        throw new DatabaseError('Failed to load products', error);
      }

    const products = data.map(product => ({
      ...product,
      category_name: product.categories?.name || 'Uncategorized',
      seller_name: product.sellers?.shop_name || 'Unknown Seller',
      seller_rating: product.sellers?.rating || 0,
      seller_sales: product.sellers?.total_sales || 0
    }));

      // Smart prioritization: Sort by seller rating, stock, and recency
      const sorted = products.sort((a, b) => {
        // 1. Prioritize in-stock products
        if (a.stock_quantity > 0 && b.stock_quantity === 0) return -1;
        if (a.stock_quantity === 0 && b.stock_quantity > 0) return 1;
        
        // 2. Prioritize higher-rated sellers
        if (a.seller_rating !== b.seller_rating) {
          return b.seller_rating - a.seller_rating;
        }
        
        // 3. Prioritize sellers with more sales
        if (a.seller_sales !== b.seller_sales) {
          return b.seller_sales - a.seller_sales;
        }
        
        // 4. Newest products first
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      logger.info(`Fetched ${sorted.length} products`, 'ProductService');
      return sorted;
    } catch (error) {
      throw handleError(error);
    }
  }

  static async getProduct(id: number): Promise<Product> {
    try {
      logger.debug('Fetching product', 'ProductService', { id });
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories (name, icon),
          sellers (shop_name)
        `)
        .eq('id', id)
        .eq('status', 'active')
        .single();

      if (error) {
        logger.error('Failed to fetch product', error, 'ProductService', { id });
        throw new NotFoundError('Product');
      }

      logger.info(`Fetched product: ${data.name}`, 'ProductService');
      return {
        ...data,
        category_name: data.categories?.name || 'Uncategorized',
        seller_name: data.sellers?.shop_name || 'Unknown Seller'
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  static async getFeaturedProducts(limit = 4): Promise<Product[]> {
    try {
      logger.debug('Fetching featured products', 'ProductService', { limit });
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories (name, icon),
          sellers (shop_name)
        `)
        .eq('status', 'active')
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch featured products', error, 'ProductService');
        throw new DatabaseError('Failed to load featured products', error);
      }

      logger.info(`Fetched ${data.length} featured products`, 'ProductService');
      return data.map(product => ({
        ...product,
        category_name: product.categories?.name || 'Uncategorized',
        seller_name: product.sellers?.shop_name || 'Unknown Seller'
      }));
    } catch (error) {
      throw handleError(error);
    }
  }

  static async getCategories(): Promise<Category[]> {
    try {
      logger.debug('Fetching categories', 'ProductService');
      
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) {
        logger.error('Failed to fetch categories', error, 'ProductService');
        throw new DatabaseError('Failed to load categories', error);
      }
      
      logger.info(`Fetched ${data.length} categories`, 'ProductService');
      return data;
    } catch (error) {
      throw handleError(error);
    }
  }

  static async createProduct(productData: CreateProductData): Promise<Product> {
    try {
      logger.info('Creating product', 'ProductService', { name: productData.name });
      
      if (!productData.name || !productData.price || !productData.seller_id) {
        throw new ValidationError('Missing required product fields');
      }
      
      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) {
        logger.error('Failed to create product', error, 'ProductService', productData);
        throw new DatabaseError('Failed to create product', error);
      }
      
      logger.info(`Product created: ${data.name} (ID: ${data.id})`, 'ProductService');
      return data;
    } catch (error) {
      throw handleError(error);
    }
  }
}

export class SellerService {
  static async getSeller(userId: string): Promise<Seller | null> {
    try {
      logger.debug('Fetching seller', 'SellerService', { userId });
      
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        logger.warn('Seller not found', 'SellerService', { userId });
        return null;
      }
      
      logger.info(`Fetched seller: ${data.shop_name}`, 'SellerService');
      return data;
    } catch (error) {
      logger.error('Error fetching seller', error as Error, 'SellerService', { userId });
      return null;
    }
  }

  static async createSeller(sellerData: { user_id: string; shop_name: string; shop_description?: string }): Promise<Seller> {
    try {
      logger.info('Creating seller', 'SellerService', { shop_name: sellerData.shop_name });
      
      if (!sellerData.user_id || !sellerData.shop_name) {
        throw new ValidationError('Missing required seller fields');
      }
      
      const { data, error } = await supabase
        .from('sellers')
        .insert(sellerData)
        .select()
        .single();

      if (error) {
        logger.error('Failed to create seller', error, 'SellerService', sellerData);
        throw new DatabaseError('Failed to create seller', error);
      }
      
      logger.info(`Seller created: ${data.shop_name} (ID: ${data.id})`, 'SellerService');
      return data;
    } catch (error) {
      throw handleError(error);
    }
  }

  static async getSellerProducts(sellerId: number): Promise<Product[]> {
    try {
      logger.debug('Fetching seller products', 'SellerService', { sellerId });
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories (name, icon)
        `)
        .eq('seller_id', sellerId);

      if (error) {
        logger.error('Failed to fetch seller products', error, 'SellerService', { sellerId });
        throw new DatabaseError('Failed to load seller products', error);
      }
      
      logger.info(`Fetched ${data.length} products for seller ${sellerId}`, 'SellerService');
      return data.map(product => ({
        ...product,
        category_name: product.categories?.name || 'Uncategorized'
      }));
    } catch (error) {
      throw handleError(error);
    }
  }

  static async isSellerEmail(email: string): Promise<boolean> {
    try {
      logger.debug('Checking if email is seller', 'SellerService', { email });
      
      const { count, error } = await supabase
        .from('sellers')
        .select('id', { count: 'exact', head: true })
        .eq('email', email.trim())
        .eq('status', 'active');

      if (error) {
        logger.warn('Error checking seller email', 'SellerService', { email, error: error.message });
        return false;
      }
      
      const isSeller = (count || 0) > 0;
      logger.debug(`Email ${email} is ${isSeller ? '' : 'not '}a seller`, 'SellerService');
      return isSeller;
    } catch (error) {
      logger.error('Error checking seller email', error as Error, 'SellerService', { email });
      return false;
    }
  }

  static async updateOrderStatus(orderId: number, status: string): Promise<void> {
    try {
      logger.info('Updating order status', 'SellerService', { orderId, status });
      
      // If status is delivered, reduce product stock
      if (status === 'delivered') {
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, quantity')
          .eq('seller_order_id', orderId);

        if (itemsError) {
          logger.error('Failed to fetch order items for stock reduction', itemsError, 'SellerService', { orderId });
        } else if (orderItems) {
          for (const item of orderItems) {
            const { error: stockError } = await supabase.rpc('reduce_product_stock', {
              p_product_id: item.product_id,
              p_quantity: item.quantity
            });
            
            if (stockError) {
              logger.warn('Failed to reduce stock', 'SellerService', { product_id: item.product_id, error: stockError });
            }
          }
        }
      }

      const { error } = await supabase
        .from('seller_orders')
        .update({ status })
        .eq('id', orderId);

      if (error) {
        logger.error('Failed to update order status', error, 'SellerService', { orderId, status });
        throw new DatabaseError('Failed to update order status', error);
      }
      
      logger.info(`Order ${orderId} status updated to ${status}`, 'SellerService');
    } catch (error) {
      throw handleError(error);
    }
  }
}

export class OrderService {
  static async createOrder(orderData: CreateOrderData): Promise<{ order_id: number }> {
    try {
      logger.info('Creating order', 'OrderService', { 
        customer: orderData.customer_name, 
        total: orderData.total_amount,
        items_count: orderData.items.length 
      });
      
      // Validate order data
      if (!orderData.customer_name || !orderData.customer_email || !orderData.items.length) {
        throw new ValidationError('Missing required order fields');
      }
      
      // Group items by seller
      const itemsBySeller = orderData.items.reduce((acc, item) => {
        if (!acc[item.seller_id]) {
          acc[item.seller_id] = [];
        }
        acc[item.seller_id].push(item);
        return acc;
      }, {} as Record<number, typeof orderData.items>);

      logger.debug('Items grouped by seller', 'OrderService', { seller_count: Object.keys(itemsBySeller).length });

      // Create main order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: orderData.customer_name,
          customer_email: orderData.customer_email,
          total_amount: orderData.total_amount,
          payment_method: orderData.payment_method,
          shipping_address: orderData.shipping_address,
          payment_status: 'paid'
        })
        .select()
        .single();

      if (orderError) {
        logger.error('Failed to create main order', orderError, 'OrderService', orderData);
        throw new DatabaseError('Failed to create order', orderError);
      }
      
      logger.info(`Main order created (ID: ${order.id})`, 'OrderService');

      // Create seller orders
      for (const [sellerId, items] of Object.entries(itemsBySeller)) {
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        logger.debug('Creating seller order', 'OrderService', { sellerId, subtotal, items_count: items.length });

        const { data: sellerOrder, error: sellerOrderError } = await supabase
          .from('seller_orders')
          .insert({
            order_id: order.id,
            seller_id: parseInt(sellerId),
            subtotal: subtotal,
            status: 'pending'
          })
          .select()
          .single();

        if (sellerOrderError) {
          logger.error('Failed to create seller order', sellerOrderError, 'OrderService', { sellerId, order_id: order.id });
          throw new DatabaseError('Failed to create seller order', sellerOrderError);
        }

        // Create order items
        const orderItems = items.map(item => ({
          seller_order_id: sellerOrder.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_image: item.product_image,
          quantity: item.quantity,
          price: item.price
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          logger.error('Failed to create order items', itemsError, 'OrderService', { seller_order_id: sellerOrder.id });
          throw new DatabaseError('Failed to create order items', itemsError);
        }
        
        logger.info(`Seller order created for seller ${sellerId} (ID: ${sellerOrder.id})`, 'OrderService');
      }

      logger.info(`Order ${order.id} created successfully`, 'OrderService');
      return { order_id: order.id };
    } catch (error) {
      throw handleError(error);
    }
  }

  static async getOrder(id: number): Promise<Order> {
    try {
      logger.debug('Fetching order', 'OrderService', { id });
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          seller_orders (
            *,
            sellers (shop_name),
            order_items (*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        logger.error('Failed to fetch order', error, 'OrderService', { id });
        throw new NotFoundError('Order');
      }

      logger.info(`Fetched order ${id}`, 'OrderService');
      return {
        ...data,
        seller_orders: data.seller_orders?.map((so: any) => ({
          ...so,
          seller_name: so.sellers?.shop_name,
          items: so.order_items
        }))
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  static async getOrders(): Promise<Order[]> {
    try {
      logger.debug('Fetching all orders', 'OrderService');
      
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch orders', error, 'OrderService');
        return [];
      }
      
      logger.info(`Fetched ${data?.length || 0} orders`, 'OrderService');
      return data || [];
    } catch (error) {
      logger.error('Error fetching orders', error as Error, 'OrderService');
      return [];
    }
  }

  static async getSellerOrders(sellerId: number): Promise<SellerOrder[]> {
    try {
      logger.debug('Fetching seller orders', 'OrderService', { sellerId });
      
      const { data, error } = await supabase
        .from('seller_orders')
        .select(`
          *,
          orders (customer_name, customer_email, shipping_address),
          order_items (*)
        `)
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch seller orders', error, 'OrderService', { sellerId });
        throw new DatabaseError('Failed to load seller orders', error);
      }
      
      logger.info(`Fetched ${data.length} orders for seller ${sellerId}`, 'OrderService');
      return data.map(so => ({
        ...so,
        items: so.order_items
      }));
    } catch (error) {
      throw handleError(error);
    }
  }
}

export const api = {
  getProducts: ProductService.getProducts,
  getProduct: ProductService.getProduct,
  getFeaturedProducts: ProductService.getFeaturedProducts,
  getCategories: ProductService.getCategories,
  createProduct: ProductService.createProduct,
  getSeller: SellerService.getSeller,
  createSeller: SellerService.createSeller,
  getSellerProducts: SellerService.getSellerProducts,
  isSellerEmail: SellerService.isSellerEmail,
  createOrder: OrderService.createOrder,
  getOrder: OrderService.getOrder,
  getOrders: OrderService.getOrders,
  getSellerOrders: OrderService.getSellerOrders
};