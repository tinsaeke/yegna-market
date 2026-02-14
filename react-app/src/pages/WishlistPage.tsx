import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';

export const WishlistPage: React.FC = () => {
  const { addToCart } = useCart();
  const { wishlist, removeFromWishlist } = useWishlist();
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 12;

  const paginate = (items: any[], page: number) => {
    const start = (page - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  };

  const totalPages = Math.ceil(wishlist.length / itemsPerPage);

  const handleAddToCart = (product: any) => {
    addToCart(product);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">My Wishlist</h1>

        {wishlist.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <i className="fas fa-heart text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-600 mb-4">Your wishlist is empty</p>
            <Link
              to="/products"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {paginate(wishlist, currentPage).map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow hover:shadow-lg transition">
                <div className="relative">
                  <Link to={`/product/${product.id}`}>
                    <div className="text-6xl flex items-center justify-center h-48 bg-gray-50">
                      {product.image}
                    </div>
                  </Link>
                  <button
                    onClick={() => removeFromWishlist(product.id)}
                    className="absolute top-2 right-2 bg-white rounded-full p-2 shadow hover:bg-red-50"
                  >
                    <i className="fas fa-times text-red-500"></i>
                  </button>
                </div>
                <div className="p-4">
                  <Link to={`/product/${product.id}`}>
                    <h3 className="font-semibold text-gray-800 mb-1 hover:text-blue-600">
                      {product.name}
                    </h3>
                  </Link>
                  <p className="text-sm text-gray-600 mb-2">{product.seller_name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-blue-600">{product.price} Birr</span>
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <i className="fas fa-shopping-cart mr-1"></i>
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, wishlist.length)} of {wishlist.length}
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
    </div>
  );
};
