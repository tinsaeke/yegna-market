import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from '../types/product';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { supabase } from '../services/supabase';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { auth } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inWishlist, setInWishlist] = useState(false);

  useEffect(() => {
    if (id) {
      loadProduct(parseInt(id));
    }
  }, [id]);

  const loadProduct = async (productId: number) => {
    try {
      const productData = await api.getProduct(productId);
      setProduct(productData);
      
      if (auth.isAuthenticated) {
        const { data } = await supabase
          .from('wishlist')
          .select('id')
          .eq('user_id', auth.user!.id)
          .eq('product_id', productId)
          .single();
        setInWishlist(!!data);
      }
    } catch (error) {
      setError('Product not found');
    } finally {
      setLoading(false);
    }
  };

  const toggleWishlist = async () => {
    if (!auth.isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      if (inWishlist) {
        await supabase
          .from('wishlist')
          .delete()
          .eq('user_id', auth.user!.id)
          .eq('product_id', product!.id);
        setInWishlist(false);
      } else {
        await supabase
          .from('wishlist')
          .insert({ user_id: auth.user!.id, product_id: product!.id });
        setInWishlist(true);
      }
    } catch (error) {
      console.error('Wishlist error:', error);
    }
  };

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, quantity);
      // Show success message or redirect
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h2>
          <button
            onClick={() => navigate('/products')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 text-blue-600 hover:text-blue-800 flex items-center"
      >
        <i className="fas fa-arrow-left mr-2"></i>
        Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-96 object-cover rounded-lg shadow-lg"
          />
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-2xl font-semibold text-blue-600 mt-2">{product.price} Birr</p>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
            <p className="text-gray-600">{product.description}</p>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Stock:</span>
            <span className={`text-sm font-medium ${
              product.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {product.stock_quantity > 0 ? `${product.stock_quantity} available` : 'Out of stock'}
            </span>
          </div>

          {product.stock_quantity > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Quantity:</label>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: Math.min(10, product.stock_quantity) }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <i className="fas fa-shopping-cart mr-2"></i>
                  Add to Cart
                </button>
                <button
                  onClick={toggleWishlist}
                  className={`px-6 py-3 rounded-lg border-2 transition-colors ${
                    inWishlist
                      ? 'bg-red-50 border-red-500 text-red-600 hover:bg-red-100'
                      : 'border-gray-300 text-gray-600 hover:border-red-500 hover:text-red-600'
                  }`}
                >
                  <i className={`fas fa-heart ${inWishlist ? '' : 'far'}`}></i>
                </button>
              </div>
            </div>
          )}

          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Product Details</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Category:</span>
                <span>{product.category_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Type:</span>
                <span className="capitalize">{product.product_type}</span>
              </div>
              {product.product_type === 'physical' && (
                <div className="flex justify-between">
                  <span>Shipping:</span>
                  <span>Standard shipping available</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};