import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { CartItem, CartSummary } from '../types/cart';
import { Product } from '../types/product';

const CartContext = createContext<{
  cart: CartItem[];
  cartSummary: CartSummary;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
} | null>(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity,
        image: product.image,
        product_type: product.product_type,
        stock_quantity: product.stock_quantity,
        seller_id: product.seller_id
      }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartSummary: CartSummary = {
    subtotal: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    shipping: cart.length > 0 ? 9.99 : 0,
    tax: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 0.15,
    total: 0,
    itemCount: cart.reduce((sum, item) => sum + item.quantity, 0)
  };
  cartSummary.total = cartSummary.subtotal + cartSummary.shipping + cartSummary.tax;

  return (
    <CartContext.Provider value={{
      cart,
      cartSummary,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart
    }}>
      {children}
    </CartContext.Provider>
  );
};