import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';

export const Navigation: React.FC = () => {
  const { auth, logout } = useAuth();
  const { cartSummary } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchTerm.trim())}`;
    }
  };

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <i className="fas fa-shopping-bag text-3xl text-primary"></i>
            <div>
              <h1 className="text-2xl font-bold text-dark">Yegna Market</h1>
              <p className="text-xs text-gray-500">Premium E-commerce</p>
            </div>
          </Link>

          {/* Desktop Search */}
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <div className="relative w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleSearch}
                placeholder="Search products..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-gray-700 hover:text-primary transition font-medium">
              <i className="fas fa-home mr-2"></i>Home
            </Link>
            <Link to="/products" className="text-gray-700 hover:text-primary transition font-medium">
              <i className="fas fa-box mr-2"></i>Products
            </Link>
            
            {auth.isAuthenticated ? (
              <>
                {!auth.isSeller && (
                  <>
                    <Link to="/wishlist" className="text-gray-700 hover:text-primary transition font-medium">
                      <i className="fas fa-heart mr-2"></i>Wishlist
                    </Link>
                    <Link to="/my-orders" className="text-gray-700 hover:text-primary transition font-medium">
                      <i className="fas fa-receipt mr-2"></i>My Orders
                    </Link>
                  </>
                )}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Hi, {auth.user?.name}</span>
                  <button
                    onClick={logout}
                    className="text-gray-700 hover:text-primary transition font-medium"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i>Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-700 hover:text-primary transition font-medium">
                  <i className="fas fa-user mr-2"></i>Login
                </Link>
                <Link to="/register" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition">
                  Sign Up
                </Link>
              </>
            )}

            {/* Cart - Hidden for sellers */}
            {!auth.isSeller && (
              <Link to="/cart" className="relative text-gray-700 hover:text-primary transition">
                <i className="fas fa-shopping-cart text-xl"></i>
                {cartSummary.itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cartSummary.itemCount}
                  </span>
                )}
              </Link>
            )}

            {auth.isAdmin && (
              <Link to="/admin" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition">
                <i className="fas fa-cog mr-2"></i>Admin
              </Link>
            )}
            
            {auth.isSeller && (
              <Link to="/seller" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
                <i className="fas fa-store mr-2"></i>My Shop
              </Link>
            )}
            
            {auth.isAuthenticated && !auth.isSeller && !auth.isAdmin && (
              <Link to="/become-seller" className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition">
                <i className="fas fa-store mr-2"></i>Sell
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-gray-700 hover:text-primary"
          >
            <i className="fas fa-bars text-xl"></i>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="space-y-4">
              {/* Mobile Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleSearch}
                  placeholder="Search products..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Mobile Navigation Links */}
              <div className="space-y-2">
                <Link to="/" className="block py-2 text-gray-700 hover:text-primary transition">
                  <i className="fas fa-home mr-3"></i>Home
                </Link>
                <Link to="/products" className="block py-2 text-gray-700 hover:text-primary transition">
                  <i className="fas fa-box mr-3"></i>Products
                </Link>
                {!auth.isSeller && (
                  <Link to="/cart" className="block py-2 text-gray-700 hover:text-primary transition">
                    <i className="fas fa-shopping-cart mr-3"></i>Cart ({cartSummary.itemCount})
                  </Link>
                )}
                
                {auth.isAuthenticated ? (
                  <>
                    {!auth.isSeller && (
                      <>
                        <Link to="/wishlist" className="block py-2 text-gray-700 hover:text-primary transition">
                          <i className="fas fa-heart mr-3"></i>Wishlist
                        </Link>
                        <Link to="/my-orders" className="block py-2 text-gray-700 hover:text-primary transition">
                          <i className="fas fa-receipt mr-3"></i>My Orders
                        </Link>
                      </>
                    )}
                    <button
                      onClick={logout}
                      className="block w-full text-left py-2 text-gray-700 hover:text-primary transition"
                    >
                      <i className="fas fa-sign-out-alt mr-3"></i>Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="block w-full text-left py-2 text-gray-700 hover:text-primary transition">
                      <i className="fas fa-user mr-3"></i>Login
                    </Link>
                    <Link to="/register" className="block w-full text-left py-2 text-primary font-semibold">
                      <i className="fas fa-user-plus mr-3"></i>Sign Up
                    </Link>
                  </>
                )}

                {auth.isAdmin && (
                  <Link to="/admin" className="block py-2 text-primary font-semibold">
                    <i className="fas fa-cog mr-3"></i>Admin Panel
                  </Link>
                )}
                
                {auth.isSeller && (
                  <Link to="/seller" className="block py-2 text-green-600 font-semibold">
                    <i className="fas fa-store mr-3"></i>My Shop
                  </Link>
                )}
                
                {auth.isAuthenticated && !auth.isSeller && !auth.isAdmin && (
                  <Link to="/become-seller" className="block py-2 text-purple-600 font-semibold">
                    <i className="fas fa-store mr-3"></i>Become a Seller
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};