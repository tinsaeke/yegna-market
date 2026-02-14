import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { api, SellerService } from '../services/api';
import { supabase } from '../services/supabase';
import { Product, Seller, Category } from '../types/product';
import { SellerOrder } from '../types/order';
import { useToast } from '../components/ToastProvider';

export const SellerDashboard: React.FC = () => {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'profile' | 'earnings'>('products');
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [currentPage, setCurrentPage] = useState({ orders: 1, payouts: 1 });
  const itemsPerPage = 20;
  const [profileData, setProfileData] = useState({ 
    shop_name: '', 
    shop_description: '',
    bank_name: '',
    account_number: '',
    account_holder_name: ''
  });
  const [earnings, setEarnings] = useState({
    pending: 0,
    available: 0,
    paid: 0,
    commission: 0
  });
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.isAuthenticated) {
      navigate('/login');
      return;
    }
    
    loadSellerData();
  }, [auth, navigate]);

  const loadSellerData = async () => {
    try {
      const sellerData = await api.getSeller(auth.user!.id);
      if (!sellerData) {
        navigate('/become-seller');
        return;
      }
      
      const [productsData, ordersData, categoriesData] = await Promise.all([
        api.getSellerProducts(sellerData.id),
        api.getSellerOrders(sellerData.id),
        api.getCategories()
      ]);
      
      // Calculate rating and total sales from orders
      const deliveredOrders = ordersData.filter(o => o.status === 'delivered');
      const totalSales = deliveredOrders.reduce((sum, o) => sum + o.subtotal, 0);
      
      // Get actual rating from database or show default message
      const actualRating = sellerData.rating || 0;
      
      // Update seller data with calculated values
      sellerData.total_sales = totalSales;
      sellerData.rating = actualRating;
      setSeller(sellerData);
      setProfileData({ 
        shop_name: sellerData.shop_name, 
        shop_description: sellerData.shop_description || '',
        bank_name: sellerData.bank_name || '',
        account_number: sellerData.account_number || '',
        account_holder_name: sellerData.account_holder_name || ''
      });
      
      // Fetch receipt images for orders
      const orderIds = ordersData.map(o => o.order_id);
      if (orderIds.length > 0) {
        const { data: ordersWithReceipts } = await supabase
          .from('orders')
          .select('id, receipt_image')
          .in('id', orderIds);
        
        const receiptsMap = new Map(ordersWithReceipts?.map(o => [o.id, o.receipt_image]) || []);
        ordersData.forEach(order => {
          order.receipt_image = receiptsMap.get(order.order_id);
        });
      }
      
      setProducts(productsData);
      setOrders(ordersData);
      setCategories(categoriesData);
      
      // Calculate earnings
      const pendingEarnings = ordersData
        .filter(o => o.status !== 'delivered')
        .reduce((sum, o) => sum + o.subtotal, 0);
      
      const completedOrders = ordersData.filter(o => o.status === 'delivered');
      const deliveredEarnings = completedOrders.reduce((sum, o) => sum + o.subtotal, 0);
      
      // Get paid out amounts
      const { data: payouts } = await supabase
        .from('seller_payouts')
        .select('*')
        .eq('seller_id', sellerData.id);
      
      const paidAmount = payouts?.reduce((sum, p) => sum + p.net_amount, 0) || 0;
      const totalCommission = payouts?.reduce((sum, p) => sum + p.commission_amount, 0) || 0;
      const availableForPayout = deliveredEarnings - (payouts?.reduce((sum, p) => sum + p.amount, 0) || 0);
      
      setEarnings({
        pending: pendingEarnings,
        available: availableForPayout,
        paid: paidAmount,
        commission: totalCommission
      });
      
      setPayoutHistory(payouts || []);
    } catch (error) {
      console.error('Error loading seller data:', error);
    } finally {
      setLoading(false);
    }
  };

  const paginate = (items: any[], page: number) => {
    const start = (page - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  };

  const totalPages = (items: any[]) => Math.ceil(items.length / itemsPerPage);

  const handleAddProduct = async (productData: any) => {
    try {
      await api.createProduct({
        seller_id: seller!.id,
        name: productData.name,
        description: productData.description,
        price: parseFloat(productData.price),
        category_id: parseInt(productData.category_id),
        stock_quantity: parseInt(productData.stock_quantity),
        product_type: productData.product_type,
        image: productData.image
      });
      setShowAddProduct(false);
      loadSellerData();
      showSuccess('Product added successfully!');
    } catch (error) {
      console.error('Error adding product:', error);
      showError('Failed to add product');
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      await SellerService.updateOrderStatus(orderId, status);
      loadSellerData();
      showSuccess('Order status updated!');
    } catch (error) {
      console.error('Error updating order:', error);
      showError('Failed to update order');
    }
  };

  const handleUpdateStock = async (productId: number, newStock: number) => {
    try {
      await supabase
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', productId);
      loadSellerData();
      showSuccess('Stock updated!');
    } catch (error) {
      console.error('Error updating stock:', error);
      showError('Failed to update stock');
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await supabase
        .from('sellers')
        .update({
          shop_name: profileData.shop_name,
          shop_description: profileData.shop_description,
          bank_name: profileData.bank_name,
          account_number: profileData.account_number,
          account_holder_name: profileData.account_holder_name
        })
        .eq('id', seller!.id);
      setEditingProfile(false);
      loadSellerData();
      showSuccess('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      showError('Failed to update profile');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{seller?.shop_name}</h1>
              <p className="text-sm text-gray-600">Seller Dashboard</p>
            </div>
            <button onClick={() => { logout(); navigate('/'); }} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600">
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Stats */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-blue-600">{products.length}</div>
            <div className="text-gray-600">Total Products</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-green-600">{orders.length}</div>
            <div className="text-gray-600">Total Orders</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-yellow-600">
              {seller?.rating && seller.rating > 0 ? seller.rating.toFixed(1) : 'N/A'}
            </div>
            <div className="text-gray-600">Shop Rating</div>
            {(!seller?.rating || seller.rating === 0) && (
              <div className="text-xs text-gray-500 mt-1">No ratings yet</div>
            )}
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-purple-600">{seller?.total_sales?.toFixed(2) || '0.00'} Birr</div>
            <div className="text-gray-600">Total Sales</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('products')}
                className={`px-6 py-3 font-medium ${activeTab === 'products' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
              >
                Products
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-6 py-3 font-medium ${activeTab === 'orders' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
              >
                Orders
              </button>
              <button
                onClick={() => setActiveTab('earnings')}
                className={`px-6 py-3 font-medium ${activeTab === 'earnings' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
              >
                Earnings
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-6 py-3 font-medium ${activeTab === 'profile' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
              >
                Profile
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Products Tab */}
            {activeTab === 'products' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">My Products</h2>
                  <button
                    onClick={() => setShowAddProduct(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    + Add Product
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {products.map(product => (
                    <div key={product.id} className="border rounded-lg p-4">
                      <div className="text-4xl mb-2">{product.image}</div>
                      <h3 className="font-bold">{product.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{product.description?.substring(0, 50)}...</p>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-lg font-bold text-blue-600">{product.price} Birr</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Stock:</span>
                        <input
                          type="number"
                          value={product.stock_quantity}
                          onChange={(e) => handleUpdateStock(product.id, parseInt(e.target.value) || 0)}
                          className="border rounded px-2 py-1 w-20 text-sm"
                          min="0"
                        />
                        {product.stock_quantity < 10 && (
                          <span className="text-xs text-red-600 font-medium">Low Stock!</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div>
                <h2 className="text-xl font-bold mb-4">My Orders</h2>
                {orders.length === 0 ? (
                  <p className="text-gray-600">No orders yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100 border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Product</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Price</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Quantity</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Buyer</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Receipt</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Order Total</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginate(orders, currentPage.orders).map(order => (
                          <React.Fragment key={order.id}>
                            {order.items?.map((item, idx) => (
                              <tr key={item.id} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <span className="text-2xl">{item.product_image}</span>
                                    <div>
                                      <div className="font-medium">{item.product_name}</div>
                                      <div className="text-xs text-gray-500">Order #{order.id}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">{item.price} Birr</td>
                                <td className="py-3 px-4">{item.quantity}</td>
                                {idx === 0 ? (
                                  <>
                                    <td className="py-3 px-4" rowSpan={order.items?.length || 1}>
                                      <div>
                                        <div className="font-medium">{order.orders?.customer_name}</div>
                                        <div className="text-xs text-gray-500">{order.orders?.customer_email}</div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4" rowSpan={order.items?.length || 1}>
                                      {order.receipt_image ? (
                                        <button
                                          onClick={() => setSelectedReceipt(order.receipt_image!)}
                                          className="text-blue-600 hover:text-blue-800 underline text-sm"
                                        >
                                          View Receipt
                                        </button>
                                      ) : (
                                        <span className="text-gray-400 text-sm">No receipt</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 font-bold text-blue-600" rowSpan={order.items?.length || 1}>
                                      {order.subtotal} Birr
                                    </td>
                                    <td className="py-3 px-4" rowSpan={order.items?.length || 1}>
                                      <select
                                        value={order.status}
                                        onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                        className="border rounded px-2 py-1 text-sm w-full"
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="processing">Processing</option>
                                        <option value="packed">Packed</option>
                                        <option value="shipped">Shipped</option>
                                        <option value="delivered">Delivered</option>
                                      </select>
                                    </td>
                                  </>
                                ) : null}
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {totalPages(orders) > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {((currentPage.orders - 1) * itemsPerPage) + 1} to {Math.min(currentPage.orders * itemsPerPage, orders.length)} of {orders.length}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => ({ ...prev, orders: prev.orders - 1 }))}
                        disabled={currentPage.orders === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1">Page {currentPage.orders} of {totalPages(orders)}</span>
                      <button
                        onClick={() => setCurrentPage(prev => ({ ...prev, orders: prev.orders + 1 }))}
                        disabled={currentPage.orders === totalPages(orders)}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Earnings Tab */}
            {activeTab === 'earnings' && (
              <div>
                <h2 className="text-xl font-bold mb-4">Earnings Overview</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Pending Earnings</p>
                    <p className="text-2xl font-bold text-yellow-600">{earnings.pending.toFixed(2)} Birr</p>
                    <p className="text-xs text-gray-500">Orders not delivered yet</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Available for Payout</p>
                    <p className="text-2xl font-bold text-green-600">{earnings.available.toFixed(2)} Birr</p>
                    <p className="text-xs text-gray-500">Delivered, awaiting payout</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Paid Out</p>
                    <p className="text-2xl font-bold text-blue-600">{earnings.paid.toFixed(2)} Birr</p>
                    <p className="text-xs text-gray-500">Already received</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Platform Commission</p>
                    <p className="text-2xl font-bold text-red-600">{earnings.commission.toFixed(2)} Birr</p>
                    <p className="text-xs text-gray-500">10% of sales</p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-3">Payout History</h3>
                {payoutHistory.length === 0 ? (
                  <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
                    <i className="fas fa-history text-4xl mb-2"></i>
                    <p>No payouts yet</p>
                  </div>
                ) : (
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Received</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {paginate(payoutHistory, currentPage.payouts).map((payout) => (
                          <tr key={payout.id}>
                            <td className="px-4 py-3 text-sm">{new Date(payout.paid_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3 font-semibold">{payout.amount.toFixed(2)} Birr</td>
                            <td className="px-4 py-3 text-red-600">-{payout.commission_amount.toFixed(2)} Birr</td>
                            <td className="px-4 py-3 font-bold text-green-600">{payout.net_amount.toFixed(2)} Birr</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{payout.transaction_reference}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {totalPages(payoutHistory) > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {((currentPage.payouts - 1) * itemsPerPage) + 1} to {Math.min(currentPage.payouts * itemsPerPage, payoutHistory.length)} of {payoutHistory.length}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => ({ ...prev, payouts: prev.payouts - 1 }))}
                        disabled={currentPage.payouts === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1">Page {currentPage.payouts} of {totalPages(payoutHistory)}</span>
                      <button
                        onClick={() => setCurrentPage(prev => ({ ...prev, payouts: prev.payouts + 1 }))}
                        disabled={currentPage.payouts === totalPages(payoutHistory)}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Shop Profile</h2>
                  {!editingProfile ? (
                    <button
                      onClick={() => setEditingProfile(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Edit Profile
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateProfile}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingProfile(false);
                          setProfileData({ 
                            shop_name: seller!.shop_name, 
                            shop_description: seller!.shop_description || '',
                            bank_name: seller!.bank_name || '',
                            account_number: seller!.account_number || '',
                            account_holder_name: seller!.account_holder_name || ''
                          });
                        }}
                        className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Shop Name</label>
                    <input
                      type="text"
                      value={editingProfile ? profileData.shop_name : seller?.shop_name}
                      onChange={(e) => setProfileData({ ...profileData, shop_name: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      readOnly={!editingProfile}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      value={editingProfile ? profileData.shop_description : seller?.shop_description || ''}
                      onChange={(e) => setProfileData({ ...profileData, shop_description: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      rows={4}
                      readOnly={!editingProfile}
                    />
                  </div>
                  
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold mb-3">Bank Account for Payouts</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={editingProfile ? profileData.bank_name : seller?.bank_name || 'Not provided'}
                          onChange={(e) => setProfileData({ ...profileData, bank_name: e.target.value })}
                          placeholder="e.g., Commercial Bank of Ethiopia"
                          className="w-full border rounded px-3 py-2"
                          readOnly={!editingProfile}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Account Number</label>
                        <input
                          type="text"
                          value={editingProfile ? profileData.account_number : seller?.account_number || 'Not provided'}
                          onChange={(e) => setProfileData({ ...profileData, account_number: e.target.value })}
                          placeholder="e.g., 1000123456789"
                          className="w-full border rounded px-3 py-2"
                          readOnly={!editingProfile}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Account Holder Name</label>
                        <input
                          type="text"
                          value={editingProfile ? profileData.account_holder_name : seller?.account_holder_name || 'Not provided'}
                          onChange={(e) => setProfileData({ ...profileData, account_holder_name: e.target.value })}
                          placeholder="e.g., John Doe"
                          className="w-full border rounded px-3 py-2"
                          readOnly={!editingProfile}
                        />
                      </div>
                      {!editingProfile && (!seller?.bank_name || !seller?.account_number) && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                          <i className="fas fa-exclamation-triangle mr-2"></i>
                          Please add your bank account details to receive payouts from your sales.
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Rating</label>
                    <div className="text-2xl font-bold text-yellow-600">
                      {seller?.rating && seller.rating > 0 ? `${seller.rating.toFixed(1)} ⭐` : 'No ratings yet'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <ProductModal
          categories={categories}
          onSave={handleAddProduct}
          onClose={() => setShowAddProduct(false)}
        />
      )}

      {/* Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setSelectedReceipt(null)}>
          <div className="bg-white rounded-xl p-4 max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Payment Receipt</h3>
              <button onClick={() => setSelectedReceipt(null)} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times text-2xl"></i>
              </button>
            </div>
            <img src={selectedReceipt} alt="Receipt" className="w-full h-auto rounded" />
          </div>
        </div>
      )}
    </div>
  );
};

// Product Modal Component
const ProductModal: React.FC<{
  categories: Category[];
  onSave: (data: any) => void;
  onClose: () => void;
}> = ({ categories, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    stock_quantity: '',
    product_type: 'physical',
    image: '📦'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold mb-6">Add New Product</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Product Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded px-3 py-2"
              rows={3}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock</label>
              <input
                type="number"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Icon</label>
            <select
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="📦">📦 Package</option>
              <option value="💻">💻 Laptop</option>
              <option value="📱">📱 Phone</option>
              <option value="🎧">🎧 Headphones</option>
              <option value="⌚">⌚ Watch</option>
              <option value="👕">👕 Clothing</option>
              <option value="👟">👟 Shoes</option>
              <option value="📚">📚 Book</option>
            </select>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">
              Add Product
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
