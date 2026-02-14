import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Product, Category } from '../types/product';
import { Order } from '../types/order';
import { api, ProductService } from '../services/api';
import { supabase } from '../services/supabase';
import { useToast } from '../components/ToastProvider';

export const AdminDashboard: React.FC = () => {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [payoutPeriod, setPayoutPeriod] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState({
    products: 1,
    orders: 1,
    customers: 1,
    sellers: 1,
    payouts: 1
  });
  const itemsPerPage = 20;
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    totalSellers: 0
  });

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.isAdmin) {
      navigate('/login');
      return;
    }
    loadDashboardData();
  }, [auth, navigate]);

  const loadDashboardData = async () => {
    try {
      console.log('Loading dashboard data...');
      
      const [productsData, ordersData, categoriesData] = await Promise.all([
        api.getProducts(),
        api.getOrders(),
        api.getCategories()
      ]);
      
      // Load sellers
      const { data: sellersData } = await supabase.from('sellers').select('*');
      setSellers(sellersData || []);
      
      // Load pending payouts
      await loadPendingPayouts();
      
      // Load payout history
      const { data: payoutsData } = await supabase
        .from('seller_payouts')
        .select(`
          *,
          sellers (shop_name, bank_name, account_number)
        `)
        .order('created_at', { ascending: false });
      setPayoutHistory(payoutsData || []);
      
      // Load orders with seller_orders details
      const { data: ordersWithDetails } = await supabase
        .from('orders')
        .select(`
          *,
          seller_orders (
            id,
            seller_id,
            status,
            subtotal,
            tracking_number,
            sellers (shop_name)
          )
        `)
        .order('created_at', { ascending: false });
      
      console.log('Products loaded:', productsData.length);
      console.log('Orders loaded:', ordersData.length);
      console.log('Categories loaded:', categoriesData.length);
      
      setProducts(productsData);
      setOrders(ordersWithDetails || ordersData);
      setCategories(categoriesData);
      
      // Load customers from orders
      const customerMap = new Map();
      ordersData.forEach(order => {
        if (order.customer_email) {
          if (!customerMap.has(order.customer_email)) {
            customerMap.set(order.customer_email, {
              email: order.customer_email,
              name: order.customer_name,
              totalOrders: 0,
              totalSpent: 0,
              lastOrder: order.created_at
            });
          }
          const customer = customerMap.get(order.customer_email);
          customer.totalOrders++;
          customer.totalSpent += order.total_amount || 0;
          if (new Date(order.created_at) > new Date(customer.lastOrder)) {
            customer.lastOrder = order.created_at;
          }
        }
      });
      setCustomers(Array.from(customerMap.values()));
      
      const totalRevenue = ordersData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      setStats({
        totalProducts: productsData.length,
        totalOrders: ordersData.length,
        totalCustomers: customerMap.size,
        totalRevenue,
        totalSellers: sellersData?.length || 0
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingPayouts = async () => {
    try {
      const { data: deliveredOrders } = await supabase
        .from('seller_orders')
        .select(`
          *,
          sellers (id, shop_name, bank_name, account_number, account_holder_name),
          orders (id, customer_name, created_at)
        `)
        .eq('status', 'delivered');

      if (!deliveredOrders) return;

      const { data: existingPayouts } = await supabase
        .from('seller_payouts')
        .select('seller_order_id');

      const paidOrderIds = new Set(existingPayouts?.map(p => p.seller_order_id) || []);
      const unpaidOrders = deliveredOrders.filter(order => !paidOrderIds.has(order.id));

      const payoutsBySeller = unpaidOrders.reduce((acc: any, order: any) => {
        const sellerId = order.seller_id;
        if (!acc[sellerId]) {
          acc[sellerId] = {
            seller_id: sellerId,
            seller_name: order.sellers?.shop_name,
            bank_name: order.sellers?.bank_name,
            account_number: order.sellers?.account_number,
            account_holder_name: order.sellers?.account_holder_name,
            orders: [],
            total_amount: 0,
            commission_rate: 10,
            commission_amount: 0,
            net_amount: 0
          };
        }
        acc[sellerId].orders.push(order);
        acc[sellerId].total_amount += order.subtotal;
        return acc;
      }, {});

      Object.values(payoutsBySeller).forEach((payout: any) => {
        payout.commission_amount = payout.total_amount * (payout.commission_rate / 100);
        payout.net_amount = payout.total_amount - payout.commission_amount;
      });

      setPendingPayouts(Object.values(payoutsBySeller));
    } catch (error) {
      console.error('Error loading pending payouts:', error);
    }
  };

  const handleMarkAsPaid = async (payout: any, transactionRef: string) => {
    try {
      const payoutRecords = payout.orders.map((order: any) => ({
        seller_id: payout.seller_id,
        seller_order_id: order.id,
        amount: order.subtotal,
        commission_rate: payout.commission_rate,
        commission_amount: order.subtotal * (payout.commission_rate / 100),
        net_amount: order.subtotal * (1 - payout.commission_rate / 100),
        status: 'completed',
        payment_method: 'bank_transfer',
        transaction_reference: transactionRef,
        paid_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('seller_payouts')
        .insert(payoutRecords);

      if (error) throw error;

      showSuccess(`Payout marked as paid for ${payout.seller_name}`);
      loadDashboardData();
    } catch (error) {
      console.error('Error marking payout as paid:', error);
      showError('Failed to mark payout as paid');
    }
  };

  const handleAddProduct = async (productData: any) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: productData.name,
          description: productData.description,
          price: parseFloat(productData.price),
          image: productData.image,
          category_id: parseInt(productData.category_id),
          stock_quantity: parseInt(productData.stock_quantity),
          product_type: productData.product_type,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;
      
      setShowAddProductModal(false);
      loadDashboardData();
      showSuccess('Product added successfully!');
    } catch (error: any) {
      console.error('Error adding product:', error);
      showError('Error adding product: ' + (error.message || 'Unknown error'));
    }
  };

  const handleEditProduct = async (productData: any) => {
    if (!editingProduct) return;
    
    try {
      const { data, error } = await supabase
        .from('products')
        .update({
          name: productData.name,
          description: productData.description,
          price: parseFloat(productData.price),
          stock_quantity: parseInt(productData.stock_quantity),
          product_type: productData.product_type,
          image: productData.image,
          category_id: parseInt(productData.category_id)
        })
        .eq('id', editingProduct.id)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      setEditingProduct(null);
      loadDashboardData();
      showSuccess('Product updated successfully!');
    } catch (error: any) {
      console.error('Error updating product:', error);
      showError('Error: Check if you have admin permissions');
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      
      loadDashboardData();
      showSuccess('Product deleted successfully!');
    } catch (error) {
      console.error('Error deleting product:', error);
      showError('Error deleting product');
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
      
      loadDashboardData();
      showSuccess(`Order status updated to ${status}`);
    } catch (error) {
      console.error('Error updating order:', error);
      showError('Error updating order status');
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
      
      loadDashboardData();
      showSuccess('Order deleted successfully!');
    } catch (error) {
      console.error('Error deleting order:', error);
      showError('Error deleting order');
    }
  };

  const handleAddCategory = async (categoryData: any) => {
    try {
      const { error } = await supabase
        .from('categories')
        .insert({
          name: categoryData.name,
          icon: categoryData.icon
        });

      if (error) throw error;
      
      setShowAddCategoryModal(false);
      loadDashboardData();
      showSuccess('Category added successfully!');
    } catch (error) {
      console.error('Error adding category:', error);
      showError('Error adding category');
    }
  };

  const handleEditCategory = async (categoryData: any) => {
    if (!editingCategory) return;
    
    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: categoryData.name,
          icon: categoryData.icon
        })
        .eq('id', parseInt(editingCategory.id.toString()));

      if (error) throw error;
      
      setEditingCategory(null);
      loadDashboardData();
      showSuccess('Category updated successfully!');
    } catch (error) {
      console.error('Error updating category:', error);
      showError('Error updating category');
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', parseInt(categoryId.toString()));

      if (error) throw error;
      
      loadDashboardData();
      showSuccess('Category deleted successfully!');
    } catch (error) {
      console.error('Error deleting category:', error);
      showError('Error deleting category');
    }
  };

  const handleUpdateSellerStatus = async (sellerId: number, status: string) => {
    try {
      const { error } = await supabase
        .from('sellers')
        .update({ status })
        .eq('id', sellerId);

      if (error) throw error;
      
      loadDashboardData();
      showSuccess(`Seller ${status === 'active' ? 'approved' : 'suspended'} successfully!`);
    } catch (error) {
      console.error('Error updating seller:', error);
      showError('Error updating seller status');
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/');
  };

  const showSection = (section: string) => {
    setActiveSection(section);
    setCurrentPage(prev => ({ ...prev, [section]: 1 }));
  };

  const paginate = (items: any[], page: number) => {
    const start = (page - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  };

  const totalPages = (items: any[]) => Math.ceil(items.length / itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 font-inter min-h-screen">
      {/* Navigation */}
      <nav className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <i className="fas fa-shopping-bag text-2xl"></i>
              <h1 className="text-xl md:text-2xl font-bold">Yegna Market Pro</h1>
              <span className="hidden sm:inline bg-white/20 px-2 py-1 rounded text-sm">Admin Panel</span>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="hidden md:block text-right">
                <p className="font-semibold">{auth.user?.name || 'Administrator'}</p>
                <p className="text-white/80 text-sm">Super Admin</p>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <i className="fas fa-user"></i>
              </div>
              <button onClick={handleSignOut} className="bg-white/20 hover:bg-white/30 px-3 md:px-4 py-2 rounded-lg transition text-sm md:text-base">
                <i className="fas fa-sign-out-alt md:mr-2"></i>
                <span className="hidden md:inline">Logout</span>
              </button>
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg"
              >
                <i className="fas fa-bars"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <div className="hidden md:block w-64 bg-white shadow-lg min-h-screen">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-700">Navigation</h2>
          </div>
          <nav className="p-4 space-y-2">
            <button
              onClick={() => showSection('dashboard')}
              className={`nav-item w-full text-left ${activeSection === 'dashboard' ? 'active' : ''}`}
            >
              <i className="fas fa-tachometer-alt mr-3"></i>Dashboard
            </button>
            <button
              onClick={() => showSection('orders')}
              className={`nav-item w-full text-left ${activeSection === 'orders' ? 'active' : ''}`}
            >
              <i className="fas fa-shopping-cart mr-3"></i>Orders
            </button>
            <button
              onClick={() => showSection('sellers')}
              className={`nav-item w-full text-left ${activeSection === 'sellers' ? 'active' : ''}`}
            >
              <i className="fas fa-store mr-3"></i>Sellers
            </button>
            <button
              onClick={() => showSection('payouts')}
              className={`nav-item w-full text-left ${activeSection === 'payouts' ? 'active' : ''}`}
            >
              <i className="fas fa-money-bill-wave mr-3"></i>Payouts
            </button>
            <button
              onClick={() => showSection('categories')}
              className={`nav-item w-full text-left ${activeSection === 'categories' ? 'active' : ''}`}
            >
              <i className="fas fa-tags mr-3"></i>Categories
            </button>
            <button
              onClick={() => showSection('products')}
              className={`nav-item w-full text-left ${activeSection === 'products' ? 'active' : ''}`}
            >
              <i className="fas fa-box mr-3"></i>Products
            </button>
            <button
              onClick={() => showSection('customers')}
              className={`nav-item w-full text-left ${activeSection === 'customers' ? 'active' : ''}`}
            >
              <i className="fas fa-users mr-3"></i>Customers
            </button>
          </nav>
        </div>

        {/* Mobile Sidebar */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setMobileMenuOpen(false)}>
            <div className="w-64 bg-white h-full shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-700">Navigation</h2>
                <button onClick={() => setMobileMenuOpen(false)} className="text-gray-500">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <nav className="p-4 space-y-2">
                <button
                  onClick={() => { showSection('dashboard'); setMobileMenuOpen(false); }}
                  className={`nav-item w-full text-left ${activeSection === 'dashboard' ? 'active' : ''}`}
                >
                  <i className="fas fa-tachometer-alt mr-3"></i>Dashboard
                </button>
                <button
                  onClick={() => { showSection('orders'); setMobileMenuOpen(false); }}
                  className={`nav-item w-full text-left ${activeSection === 'orders' ? 'active' : ''}`}
                >
                  <i className="fas fa-shopping-cart mr-3"></i>Orders
                </button>
                <button
                  onClick={() => { showSection('sellers'); setMobileMenuOpen(false); }}
                  className={`nav-item w-full text-left ${activeSection === 'sellers' ? 'active' : ''}`}
                >
                  <i className="fas fa-store mr-3"></i>Sellers
                </button>
                <button
                  onClick={() => { showSection('payouts'); setMobileMenuOpen(false); }}
                  className={`nav-item w-full text-left ${activeSection === 'payouts' ? 'active' : ''}`}
                >
                  <i className="fas fa-money-bill-wave mr-3"></i>Payouts
                </button>
                <button
                  onClick={() => { showSection('categories'); setMobileMenuOpen(false); }}
                  className={`nav-item w-full text-left ${activeSection === 'categories' ? 'active' : ''}`}
                >
                  <i className="fas fa-tags mr-3"></i>Categories
                </button>
                <button
                  onClick={() => { showSection('products'); setMobileMenuOpen(false); }}
                  className={`nav-item w-full text-left ${activeSection === 'products' ? 'active' : ''}`}
                >
                  <i className="fas fa-box mr-3"></i>Products
                </button>
                <button
                  onClick={() => { showSection('customers'); setMobileMenuOpen(false); }}
                  className={`nav-item w-full text-left ${activeSection === 'customers' ? 'active' : ''}`}
                >
                  <i className="fas fa-users mr-3"></i>Customers
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6">
          {/* Dashboard Section */}
          {activeSection === 'dashboard' && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800">Dashboard Overview</h2>
                <button onClick={loadDashboardData} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition">
                  <i className="fas fa-sync-alt mr-2"></i>Refresh
                </button>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <div className="card-hover bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <i className="fas fa-box text-blue-600 text-2xl"></i>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-gray-500">Total Products</h3>
                      <p className="text-2xl font-bold text-gray-800">{stats.totalProducts}</p>
                    </div>
                  </div>
                </div>
                
                <div className="card-hover bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <i className="fas fa-shopping-cart text-green-600 text-2xl"></i>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-gray-500">Total Orders</h3>
                      <p className="text-2xl font-bold text-gray-800">{stats.totalOrders}</p>
                    </div>
                  </div>
                </div>
                
                <div className="card-hover bg-white p-6 rounded-xl shadow-md border-l-4 border-purple-500">
                  <div className="flex items-center">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <i className="fas fa-users text-purple-600 text-2xl"></i>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-gray-500">Total Customers</h3>
                      <p className="text-2xl font-bold text-gray-800">{stats.totalCustomers}</p>
                    </div>
                  </div>
                </div>
                
                <div className="card-hover bg-white p-6 rounded-xl shadow-md border-l-4 border-yellow-500">
                  <div className="flex items-center">
                    <div className="p-3 bg-yellow-100 rounded-lg">
                      <i className="fas fa-coins text-yellow-600 text-2xl"></i>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
                      <p className="text-2xl font-bold text-gray-800">{stats.totalRevenue.toFixed(2)} Birr</p>
                    </div>
                  </div>
                </div>
                
                <div className="card-hover bg-white p-6 rounded-xl shadow-md border-l-4 border-orange-500">
                  <div className="flex items-center">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <i className="fas fa-store text-orange-600 text-2xl"></i>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-gray-500">Total Sellers</h3>
                      <p className="text-2xl font-bold text-gray-800">{stats.totalSellers}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="card-hover bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-semibold mb-4">Recent Orders</h3>
                <div className="space-y-3">
                  {orders.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-semibold">Order #{order.id}</p>
                        <p className="text-sm text-gray-600">{order.customer_name} • {order.total_amount || 0} Birr</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Products Section */}
          {activeSection === 'products' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Product Management</h2>
                <p className="text-sm text-gray-600">View all products (sellers manage their own)</p>
              </div>
              
              <div className="card-hover bg-white rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginate(products, currentPage.products).map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="flex items-center">
                              <span className="text-xl mr-2">{product.image}</span>
                              <div>
                                <div className="font-medium text-gray-900">{product.name}</div>
                                <div className="text-xs text-gray-500">{product.description?.substring(0, 30)}...</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="font-medium text-gray-900">{product.seller_name}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">{product.category_name}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-semibold">{product.price} Birr</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              product.stock_quantity > 10 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {product.stock_quantity}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <button 
                              onClick={() => handleDeleteProduct(product.id)}
                              className="text-red-600 hover:text-red-900 text-xs"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages(products) > 1 && (
                  <div className="px-4 py-3 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {((currentPage.products - 1) * itemsPerPage) + 1} to {Math.min(currentPage.products * itemsPerPage, products.length)} of {products.length}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => ({ ...prev, products: prev.products - 1 }))}
                        disabled={currentPage.products === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1">Page {currentPage.products} of {totalPages(products)}</span>
                      <button
                        onClick={() => setCurrentPage(prev => ({ ...prev, products: prev.products + 1 }))}
                        disabled={currentPage.products === totalPages(products)}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Orders Section */}
          {activeSection === 'orders' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6">Order Management</h2>
              <div className="card-hover bg-white rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginate(orders, currentPage.orders).map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap font-semibold">#{order.id}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div>
                              <div className="font-medium">{order.customer_name}</div>
                              <div className="text-xs text-gray-500">{order.customer_email}</div>
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-semibold">{order.total_amount} Birr</td>
                          <td className="px-3 py-2">
                            {order.seller_orders?.length > 0 ? (
                              <div className="space-y-1">
                                {order.seller_orders.map((so: any) => (
                                  <div key={so.id} className="text-xs">
                                    <span className="font-medium">{so.sellers?.shop_name}:</span>
                                    <span className={`ml-2 px-2 py-0.5 rounded-full ${
                                      so.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                      so.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                      so.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                                      'bg-green-100 text-green-800'
                                    }`}>
                                      {so.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                                {order.status || 'pending'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                            {new Date(order.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap space-x-1">
                            {order.receipt_url && (
                              <a 
                                href={`https://lkwlescmmvjqlcpheenj.supabase.co/storage/v1/object/public/${order.receipt_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-900"
                              >
                                <i className="fas fa-receipt mr-1"></i>Receipt
                              </a>
                            )}
                            <button className="text-primary hover:text-secondary text-xs">
                              <i className="fas fa-eye"></i>
                            </button>
                            <button 
                              onClick={() => handleDeleteOrder(order.id)}
                              className="text-red-600 hover:text-red-800 text-xs"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages(orders) > 1 && (
                  <div className="px-4 py-3 border-t flex items-center justify-between">
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
            </div>
          )}

          {/* Customers Section */}
          {activeSection === 'customers' && (
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Customer Management</h2>
              <div className="card-hover bg-white rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Spent</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Last Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginate(customers, currentPage.customers).map((customer, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{customer.name}</div>
                            <div className="text-xs text-gray-500">{customer.email}</div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{customer.totalOrders}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-semibold">{customer.totalSpent.toFixed(2)} Birr</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 hidden md:table-cell">
                            {new Date(customer.lastOrder).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages(customers) > 1 && (
                  <div className="px-4 py-3 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {((currentPage.customers - 1) * itemsPerPage) + 1} to {Math.min(currentPage.customers * itemsPerPage, customers.length)} of {customers.length}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => ({ ...prev, customers: prev.customers - 1 }))}
                        disabled={currentPage.customers === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1">Page {currentPage.customers} of {totalPages(customers)}</span>
                      <button
                        onClick={() => setCurrentPage(prev => ({ ...prev, customers: prev.customers + 1 }))}
                        disabled={currentPage.customers === totalPages(customers)}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sellers Section */}
          {activeSection === 'sellers' && (
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Seller Management</h2>
              <div className="card-hover bg-white rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shop</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Joined</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginate(sellers, currentPage.sellers).map((seller) => (
                        <tr key={seller.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{seller.shop_name}</div>
                            <div className="text-xs text-gray-500">{seller.shop_description?.substring(0, 30)}</div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              seller.status === 'active' ? 'bg-green-100 text-green-800' :
                              seller.status === 'suspended' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {seller.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="text-yellow-600 font-semibold">{seller.rating.toFixed(1)} ⭐</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-semibold">{seller.total_sales}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 hidden md:table-cell">
                            {new Date(seller.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {seller.status === 'pending' && (
                              <button
                                onClick={() => handleUpdateSellerStatus(seller.id, 'active')}
                                className="text-green-600 hover:text-green-800 text-xs"
                              >
                                Approve
                              </button>
                            )}
                            {seller.status === 'active' && (
                              <button
                                onClick={() => handleUpdateSellerStatus(seller.id, 'suspended')}
                                className="text-red-600 hover:text-red-800 text-xs"
                              >
                                Suspend
                              </button>
                            )}
                            {seller.status === 'suspended' && (
                              <button
                                onClick={() => handleUpdateSellerStatus(seller.id, 'active')}
                                className="text-green-600 hover:text-green-800 text-xs"
                              >
                                Activate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages(sellers) > 1 && (
                  <div className="px-4 py-3 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {((currentPage.sellers - 1) * itemsPerPage) + 1} to {Math.min(currentPage.sellers * itemsPerPage, sellers.length)} of {sellers.length}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => ({ ...prev, sellers: prev.sellers - 1 }))}
                        disabled={currentPage.sellers === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1">Page {currentPage.sellers} of {totalPages(sellers)}</span>
                      <button
                        onClick={() => setCurrentPage(prev => ({ ...prev, sellers: prev.sellers + 1 }))}
                        disabled={currentPage.sellers === totalPages(sellers)}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Categories Section */}
          {activeSection === 'categories' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Category Management</h2>
                <button 
                  onClick={() => setShowAddCategoryModal(true)}
                  className="bg-primary text-white px-3 md:px-4 py-2 rounded-lg hover:bg-secondary transition text-sm md:text-base"
                >
                  <i className="fas fa-plus mr-2"></i>
                  <span className="hidden sm:inline">Add Category</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </div>
              <div className="card-hover bg-white rounded-xl shadow-md p-4 md:p-6">
                <div className="space-y-2">
                  {categories.map(category => (
                    <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-xl md:text-2xl">{category.icon}</span>
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <div className="space-x-2">
                        <button 
                          onClick={() => setEditingCategory(category)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(category.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Payouts Section */}
          {activeSection === 'payouts' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6">Seller Payouts</h2>
              
              {/* Pending Payouts */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Pending Payouts</h3>
                  <button onClick={loadPendingPayouts} className="text-primary hover:text-secondary">
                    <i className="fas fa-sync-alt mr-2"></i>Refresh
                  </button>
                </div>
                
                {pendingPayouts.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                    <i className="fas fa-check-circle text-4xl mb-2"></i>
                    <p>No pending payouts</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingPayouts.map((payout) => (
                      <PayoutCard key={payout.seller_id} payout={payout} onMarkAsPaid={handleMarkAsPaid} />
                    ))}
                  </div>
                )}
              </div>

              {/* Payout History */}
              <div>
                <h3 className="text-xl font-semibold mb-4">Payout History</h3>
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Net Paid</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paginate(payoutHistory, currentPage.payouts).map((payout) => (
                          <tr key={payout.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap text-xs">
                              {new Date(payout.paid_at).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{payout.sellers?.shop_name}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-semibold">{payout.amount.toFixed(2)} Birr</td>
                            <td className="px-3 py-2 whitespace-nowrap text-red-600">-{payout.commission_amount.toFixed(2)} Birr</td>
                            <td className="px-3 py-2 whitespace-nowrap font-bold text-green-600">{payout.net_amount.toFixed(2)} Birr</td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{payout.transaction_reference}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages(payoutHistory) > 1 && (
                    <div className="px-4 py-3 border-t flex items-center justify-between">
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
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <CategoryModal
          onSave={handleAddCategory}
          onClose={() => setShowAddCategoryModal(false)}
        />
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <CategoryModal
          category={editingCategory}
          onSave={handleEditCategory}
          onClose={() => setEditingCategory(null)}
        />
      )}
    </div>
  );
};

// Payout Card Component
const PayoutCard: React.FC<{ payout: any; onMarkAsPaid: (payout: any, ref: string) => void }> = ({ payout, onMarkAsPaid }) => {
  const [showModal, setShowModal] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const { showError } = useToast();

  const handleSubmit = () => {
    if (!transactionRef.trim()) {
      showError('Please enter transaction reference');
      return;
    }
    onMarkAsPaid(payout, transactionRef);
    setShowModal(false);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h4 className="text-lg font-bold">{payout.seller_name}</h4>
            <p className="text-sm text-gray-600">{payout.orders.length} delivered order(s)</p>
          </div>
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
            Pending
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">Total Amount</p>
            <p className="text-lg font-bold">{payout.total_amount.toFixed(2)} Birr</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Commission (10%)</p>
            <p className="text-lg font-bold text-red-600">-{payout.commission_amount.toFixed(2)} Birr</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Net Payout</p>
            <p className="text-lg font-bold text-green-600">{payout.net_amount.toFixed(2)} Birr</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Bank Account</p>
            <p className="text-sm font-medium">{payout.bank_name || 'Not provided'}</p>
            <p className="text-xs text-gray-500">{payout.account_number || 'N/A'}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
            disabled={!payout.bank_name || !payout.account_number}
          >
            <i className="fas fa-check mr-2"></i>Mark as Paid
          </button>
          {(!payout.bank_name || !payout.account_number) && (
            <span className="text-sm text-red-600 flex items-center">
              <i className="fas fa-exclamation-triangle mr-2"></i>Seller needs to add bank details
            </span>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Confirm Payout</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Seller: <span className="font-semibold">{payout.seller_name}</span></p>
              <p className="text-sm text-gray-600 mb-2">Amount to transfer: <span className="font-bold text-green-600">{payout.net_amount.toFixed(2)} Birr</span></p>
              <p className="text-sm text-gray-600 mb-2">Bank: {payout.bank_name}</p>
              <p className="text-sm text-gray-600 mb-4">Account: {payout.account_number}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Transaction Reference *</label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="e.g., TXN123456"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
              >
                Confirm Payment
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Category Modal Component
interface CategoryModalProps {
  category?: Category;
  onSave: (data: any) => void;
  onClose: () => void;
}

const CategoryModal: React.FC<CategoryModalProps> = ({ category, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    icon: category?.icon || '🏷️'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 md:p-8 max-w-lg w-full">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl md:text-2xl font-bold">{category ? 'Edit Category' : 'Add New Category'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <i className="fas fa-times text-2xl"></i>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category Icon</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="icon"
                value={formData.icon}
                onChange={handleChange}
                placeholder="📦"
                className="w-20 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-center text-2xl"
              />
              <select
                onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select or type emoji</option>
                <option value="🏷️">🏷️ Tag</option>
                <option value="💻">💻 Electronics</option>
                <option value="📚">📚 Books</option>
                <option value="👕">👕 Clothing</option>
                <option value="👟">👟 Shoes</option>
                <option value="🏠">🏠 Home</option>
                <option value="🌿">🌿 Garden</option>
                <option value="💄">💄 Beauty</option>
                <option value="⚽">⚽ Sports</option>
                <option value="🎮">🎮 Gaming</option>
                <option value="📦">📦 Package</option>
                <option value="🎨">🎨 Art</option>
                <option value="🍔">🍔 Food</option>
                <option value="🚗">🚗 Auto</option>
                <option value="🎵">🎵 Music</option>
              </select>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 pt-4">
            <button
              type="submit"
              className="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-secondary transition font-semibold"
            >
              <i className="fas fa-plus mr-2"></i>{category ? 'Update Category' : 'Add Category'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
