import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { OrderService, api } from '../services/api';
import { supabase } from '../services/supabase';
import { CreateOrderData, ShippingAddress } from '../types/order';
import { logger } from '../utils/logger';
import { ValidationError, PaymentError, handleError } from '../utils/errors';
import { useToast } from '../components/ToastProvider';

export const CheckoutPage: React.FC = () => {
  const { cart, cartSummary, clearCart } = useCart();
  const { showError } = useToast();
  const { auth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'receipt'>('receipt');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>('');
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipcode: '',
    country: 'Ethiopia',
    shipping_method: 'standard'
  });

  const [formErrors, setFormErrors] = useState({
    phone: '',
    email: '',
    zipcode: ''
  });



  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // Clear error when user types
    if (formErrors[name as keyof typeof formErrors]) {
      setFormErrors({
        ...formErrors,
        [name]: ''
      });
    }
  };



  const validateForm = () => {
    const errors = {
      phone: '',
      email: '',
      zipcode: ''
    };

    // Validate phone number format
    const phoneRegex = /^(\+251|0)[79]\d{8}$/;
    if (!formData.phone) {
      errors.phone = 'Phone number is required';
    } else if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
      errors.phone = 'Invalid phone number (e.g., +251912345678 or 0912345678)';
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Invalid email address';
    }

    // Validate zipcode
    if (!formData.zipcode) {
      errors.zipcode = 'ZIP code is required';
    } else if (formData.zipcode.length < 4) {
      errors.zipcode = 'Invalid ZIP code';
    }

    setFormErrors(errors);

    const hasErrors = Object.values(errors).some(error => error !== '');
    if (hasErrors) {
      return false;
    }

    const required = ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'zipcode'];
    const allFieldsFilled = required.every(field => formData[field as keyof typeof formData].trim() !== '');
    return allFieldsFilled && receiptFile !== null;
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      logger.info('Starting checkout process', 'CheckoutPage', { 
        cart_items: cart.length 
      });
      
      // Check if logged in user is a seller
      if (auth.isAuthenticated && auth.isSeller) {
        const errorMsg = 'Sellers cannot place orders. Please logout and use a customer account.';
        logger.warn('Logged in seller attempted to place order', 'CheckoutPage', { email: auth.user?.email });
        showError(errorMsg);
        setError(errorMsg);
        throw new ValidationError(errorMsg);
      }
      
      if (!validateForm()) {
        if (!receiptFile) {
          throw new ValidationError('Please upload payment receipt');
        } else {
          throw new ValidationError('Please fill in all required fields');
        }
      }

      if (cart.length === 0) {
        throw new ValidationError('Your cart is empty');
      }

      // Check if email belongs to a seller (for non-logged in users)
      if (!auth.isAuthenticated) {
        const isSellerEmail = await api.isSellerEmail(formData.email);
        if (isSellerEmail) {
          const errorMsg = 'This email is registered as a seller. Sellers cannot place orders.';
          logger.warn('Seller email used at checkout', 'CheckoutPage', { email: formData.email });
          showError(errorMsg);
          setError(errorMsg);
          throw new ValidationError(errorMsg);
        }
      }

      setLoading(true);
      const shippingAddress: ShippingAddress = {
        street: formData.address,
        city: formData.city,
        state: formData.state,
        zipcode: formData.zipcode,
        country: formData.country
      };

      const orderData: CreateOrderData = {
        customer_name: `${formData.first_name} ${formData.last_name}`,
        customer_email: formData.email,
        total_amount: cartSummary.total,
        payment_method: 'receipt_upload',
        shipping_address: JSON.stringify(shippingAddress),
        items: cart.map(item => ({
          product_id: item.id,
          seller_id: item.seller_id || 1,
          quantity: item.quantity,
          price: item.price,
          product_name: item.name,
          product_image: item.image
        }))
      };

      // Create order first
      logger.debug('Creating order', 'CheckoutPage', { total: cartSummary.total });
      const result = await OrderService.createOrder(orderData);
      logger.info(`Order created successfully (ID: ${result.order_id})`, 'CheckoutPage');
      
      // Save receipt as base64 in order
      if (receiptFile && receiptPreview) {
        logger.debug('Saving receipt to order', 'CheckoutPage', { order_id: result.order_id });
        const { error: receiptError } = await supabase
          .from('orders')
          .update({ receipt_image: receiptPreview })
          .eq('id', result.order_id);
          
        if (receiptError) {
          logger.warn('Failed to save receipt', 'CheckoutPage', { error: receiptError });
        }
      }
      
      clearCart();
      setOrderId(result.order_id);
      setOrderComplete(true);
      logger.info('Receipt payment completed', 'CheckoutPage', { order_id: result.order_id });
      
    } catch (err: any) {
      const appError = handleError(err);
      logger.error('Checkout failed', err, 'CheckoutPage', { 
        error_code: appError.code 
      });
      setError(appError.message);
      setLoading(false);
    }
  };

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-check text-2xl text-green-600"></i>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Order Confirmed!</h3>
          <p className="text-gray-600 mb-4">Thank you for your purchase. Your order has been placed successfully.</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="font-semibold">Order #{orderId}</p>
            <p className="text-sm text-gray-600">Tracking number will be sent to your email</p>
          </div>
          <div className="flex space-x-3">
            <Link to="/my-orders" className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold hover:bg-secondary transition text-center">
              View Order
            </Link>
            <Link to="/products" className="flex-1 border border-primary text-primary py-3 rounded-xl font-semibold hover:bg-primary hover:text-white transition text-center">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Checkout Steps */}
        <div className="max-w-6xl mx-auto mb-8">
          <div className="flex justify-center items-center space-x-8">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-semibold">1</div>
              <span className="font-semibold text-primary">Cart</span>
            </div>
            <div className="w-16 h-1 bg-primary"></div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-semibold">2</div>
              <span className="font-semibold text-primary">Information</span>
            </div>
            <div className="w-16 h-1 bg-primary"></div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-semibold">3</div>
              <span className="font-semibold text-gray-500">Payment</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Shipping Information</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <i className="fas fa-exclamation-circle text-red-600 mt-1 mr-3"></i>
                      <div className="text-sm text-red-800">
                        <p className="font-semibold mb-1">Error</p>
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Personal Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                    <input 
                      type="text" 
                      name="first_name" 
                      value={formData.first_name}
                      onChange={handleInputChange}
                      placeholder="Abebe"
                      required 
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                    <input 
                      type="text" 
                      name="last_name" 
                      value={formData.last_name}
                      onChange={handleInputChange}
                      placeholder="Kebede"
                      required 
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="abebe@example.com"
                    required 
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                      formErrors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.email && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                  <input 
                    type="tel" 
                    name="phone" 
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+251912345678 or 0912345678"
                    required 
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                      formErrors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.phone && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.phone}</p>
                  )}
                </div>

                {/* Shipping Address */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Shipping Address</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Street Address *</label>
                    <input 
                      type="text" 
                      name="address" 
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Bole, Addis Ababa"
                      required 
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                      <input 
                        type="text" 
                        name="city" 
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="Addis Ababa"
                        required 
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
                      <input 
                        type="text" 
                        name="state" 
                        value={formData.state}
                        onChange={handleInputChange}
                        placeholder="Addis Ababa"
                        required 
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code *</label>
                      <input 
                        type="text" 
                        name="zipcode" 
                        value={formData.zipcode}
                        onChange={handleInputChange}
                        placeholder="1000"
                        required 
                        className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                          formErrors.zipcode ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {formErrors.zipcode && (
                        <p className="text-red-500 text-sm mt-1">{formErrors.zipcode}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Country *</label>
                    <input 
                      type="text" 
                      name="country" 
                      value="Ethiopia"
                      readOnly
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Payment Information */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Payment Method</h3>
                  
                  {/* Bank Transfer Info */}
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <div className="flex items-start">
                        <i className="fas fa-info-circle text-blue-600 mt-1 mr-3"></i>
                        <div className="text-sm text-blue-800">
                          <p className="font-semibold mb-1">Bank Transfer Instructions</p>
                          <p className="mb-2">Please transfer the amount to:</p>
                          <div className="bg-white rounded p-2 mb-2">
                            <p><strong>Bank:</strong> Commercial Bank of Ethiopia</p>
                            <p><strong>Account:</strong> 1000528053438</p>
                            <p><strong>Account Name:</strong> Yegna Market</p>
                            <p><strong>Amount:</strong> <span className="font-bold">{cartSummary.total.toFixed(2)} ETB</span></p>
                          </div>
                          <p>After payment, upload your receipt below.</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Upload Payment Receipt *</label>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleReceiptUpload}
                        required 
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>

                    {receiptPreview && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Receipt Preview:</p>
                        <img 
                          src={receiptPreview} 
                          alt="Receipt preview" 
                          className="max-w-full h-auto max-h-64 rounded-lg border border-gray-300"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-black text-white py-4 rounded-xl font-semibold hover:bg-gray-800 transition shadow-lg disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Processing Order...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-lock mr-2"></i>
                      Place Order
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Order Summary</h3>
              <div className="space-y-3 mb-4">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{item.image}</div>
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-gray-600 text-xs">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <span className="font-semibold">{(item.price * item.quantity).toFixed(2)} Birr</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{cartSummary.subtotal.toFixed(2)} Birr</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{cartSummary.shipping.toFixed(2)} Birr</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{cartSummary.tax.toFixed(2)} Birr</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{cartSummary.total.toFixed(2)} Birr</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
              <div className="flex justify-center space-x-6 mb-4">
                <i className="fas fa-lock text-2xl text-green-500"></i>
                <i className="fas fa-shield-alt text-2xl text-blue-500"></i>
                <i className="fas fa-credit-card text-2xl text-purple-500"></i>
              </div>
              <p className="text-sm text-gray-600">Your payment information is secure and encrypted</p>
            </div>

            <Link to="/cart" className="block text-center text-primary hover:text-secondary font-semibold">
              <i className="fas fa-arrow-left mr-2"></i>Return to Cart
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};