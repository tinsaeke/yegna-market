import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { CartItem } from '../types/cart';
import { useToast } from '../components/ToastProvider';

export const CartPage: React.FC = () => {
  const { cart, cartSummary, updateQuantity, removeFromCart } = useCart();
  const [shippingMethod, setShippingMethod] = useState('9.99');
  const navigate = useNavigate();
  const { showWarning } = useToast();

  const updateShipping = (cost: string) => {
    setShippingMethod(cost);
  };

  const checkout = () => {
    if (cart.length === 0) {
      showWarning('Your cart is empty!');
      return;
    }
    navigate('/checkout');
  };

  return (
    <div className="bg-gray-50 font-inter">
      <div className="container mx-auto p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">Shopping Cart</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-lg">Your cart is empty</p>
                  <Link to="/products" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
                    Continue Shopping
                  </Link>
                </div>
              ) : (
                <div>
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-4 border-b">
                      <div className="flex items-center space-x-4">
                        <div className="text-4xl">{item.image || '📦'}</div>
                        <div>
                          <h4 className="font-semibold">{item.name}</h4>
                          <p className="text-gray-500 text-sm">{item.product_type}</p>
                          <p className="text-blue-600 font-bold">{item.price} Birr</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300"
                          >
                            -
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300"
                          >
                            +
                          </button>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow-md p-6 h-fit">
            <h3 className="text-xl font-semibold mb-4">Order Summary</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{cartSummary.subtotal.toFixed(2)} Birr</span>
              </div>
              <div className="pt-2">
                <span className="font-semibold">Shipping Method:</span>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center p-3 border rounded-lg border-blue-600 bg-blue-50">
                    <input 
                      type="radio" 
                      name="shippingMethod" 
                      value="9.99" 
                      className="mr-2" 
                      checked
                      readOnly
                    />
                    <span>Standard Shipping (9.99 Birr)</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-between">
                <span>Shipping:</span>
                <span>{cartSummary.shipping.toFixed(2)} Birr</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>{cartSummary.tax.toFixed(2)} Birr</span>
              </div>
              <hr />
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{cartSummary.total.toFixed(2)} Birr</span>
              </div>
            </div>
            <button 
              onClick={checkout}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-semibold"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};