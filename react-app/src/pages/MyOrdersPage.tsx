import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Order } from '../types/order';
import { useToast } from '../components/ToastProvider';

export const MyOrdersPage: React.FC = () => {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingModal, setRatingModal] = useState<{ sellerOrderId: number; sellerId: number; shopName: string } | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!auth.isAuthenticated) {
      navigate('/login');
      return;
    }
    loadOrders();
  }, [auth, navigate]);

  const loadOrders = async () => {
    try {
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
        .eq('customer_email', auth.user!.email)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRateClick = (sellerOrderId: number, sellerId: number, shopName: string) => {
    setRatingModal({ sellerOrderId, sellerId, shopName });
    setRating(5);
    setComment('');
  };

  const submitRating = async () => {
    if (!ratingModal) return;

    try {
      // Insert rating
      const { error: insertError } = await supabase
        .from('seller_ratings')
        .insert({
          seller_id: ratingModal.sellerId,
          customer_email: auth.user!.email,
          seller_order_id: ratingModal.sellerOrderId,
          rating,
          comment
        });

      if (insertError) throw insertError;

      // Update seller average rating
      await supabase.rpc('update_seller_rating', { p_seller_id: ratingModal.sellerId });

      showSuccess('Thank you for your rating!');
      setRatingModal(null);
      loadOrders();
    } catch (error: any) {
      if (error.code === '23505') {
        showError('You have already rated this order');
      } else {
        showError('Failed to submit rating');
      }
    }
  };

  const paginate = (items: any[], page: number) => {
    const start = (page - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  };

  const totalPages = Math.ceil(orders.length / itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">My Orders</h1>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">You haven't placed any orders yet</p>
            <button
              onClick={() => navigate('/products')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <>
          <div className="space-y-6">
            {paginate(orders, currentPage).map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg">Order #{order.id}</h3>
                      <p className="text-sm text-gray-600">
                        Placed on {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{order.total_amount} ETB</p>
                      <p className="text-sm text-gray-600">{order.payment_status}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {order.seller_orders?.map((sellerOrder: any) => (
                    <div key={sellerOrder.id} className="mb-6 last:mb-0">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <p className="font-semibold text-gray-800">
                            🏪 {sellerOrder.sellers?.shop_name}
                          </p>
                          <p className="text-sm text-gray-600">Subtotal: {sellerOrder.subtotal} ETB</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          sellerOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          sellerOrder.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          sellerOrder.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {sellerOrder.status}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {sellerOrder.order_items?.map((item: any) => (
                          <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                            <span className="text-3xl">{item.product_image}</span>
                            <div className="flex-1">
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                            </div>
                            <p className="font-semibold">{item.price} ETB</p>
                          </div>
                        ))}
                      </div>

                      {sellerOrder.tracking_number && (
                        <div className="mt-3 p-3 bg-blue-50 rounded">
                          <p className="text-sm text-blue-800">
                            📦 Tracking: <span className="font-mono">{sellerOrder.tracking_number}</span>
                          </p>
                        </div>
                      )}

                      {sellerOrder.status === 'delivered' && (
                        <div className="mt-3">
                          <button
                            onClick={() => handleRateClick(sellerOrder.id, sellerOrder.seller_id, sellerOrder.sellers?.shop_name)}
                            className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 text-sm"
                          >
                            ⭐ Rate Seller
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 px-6 py-3 border-t">
                  <p className="text-sm text-gray-600">
                    Shipping to: {order.shipping_address}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, orders.length)} of {orders.length}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* Rating Modal */}
      {ratingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Rate {ratingModal.shopName}</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Your Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="text-3xl transition-colors"
                  >
                    {star <= rating ? '⭐' : '☆'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Comment (Optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Share your experience..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={submitRating}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                Submit Rating
              </button>
              <button
                onClick={() => setRatingModal(null)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
