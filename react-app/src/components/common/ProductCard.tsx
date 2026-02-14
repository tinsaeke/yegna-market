import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../../types/product';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { useAuth } from '../../hooks/useAuth';

interface ProductCardProps {
  product: Product;
  viewMode?: 'grid' | 'list';
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode = 'grid' }) => {
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { auth } = useAuth();
  const inWishlist = isInWishlist(product.id);

  const toggleWishlist = () => {
    if (inWishlist) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const getStockClass = (stock: number) => {
    if (stock > 20) return 'bg-green-100 text-green-800';
    if (stock > 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStockText = (stock: number) => {
    if (stock > 20) return 'In Stock';
    if (stock > 5) return 'Low Stock';
    if (stock > 0) return 'Very Low Stock';
    return 'Out of Stock';
  };

  const generateStarRating = (rating: number = 0) => {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(rating)) {
        stars += '★';
      } else if (i === Math.ceil(rating) && !Number.isInteger(rating)) {
        stars += '☆';
      } else {
        stars += '☆';
      }
    }
    return stars;
  };

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden card-hover fade-in">
        <div className="p-6 flex items-center space-x-6">
          <div className="text-6xl">{product.image}</div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold mb-2">{product.name}</h3>
            <p className="text-gray-600 mb-3">{product.description}</p>
            <div className="flex items-center space-x-6 text-sm text-gray-500">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{product.category_name}</span>
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">{product.product_type}</span>
              <span className={`${getStockClass(product.stock_quantity)} px-2 py-1 rounded`}>
                {getStockText(product.stock_quantity)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary mb-3">{product.price} Birr</div>
            <div className="flex flex-col space-y-2">
              {!auth.isSeller && (
                <button
                  onClick={() => addToCart(product)}
                  className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-secondary transition font-semibold"
                >
                  <i className="fas fa-cart-plus mr-2"></i>Add to Cart
                </button>
              )}
              <Link
                to={`/product/${product.id}`}
                className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition text-center"
              >
                View Details
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden card-hover fade-in group relative">
      {!auth.isSeller && (
        <button 
          onClick={toggleWishlist}
          className={`absolute top-4 right-4 z-10 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center transition-all transform hover:scale-110 ${
            inWishlist ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
          }`}
        >
          <i className={`fas fa-heart ${inWishlist ? 'fas' : 'far'}`}></i>
        </button>
      )}
      <div className="p-6 text-center">
        <div className="text-6xl mb-4">{product.image}</div>
        <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
        <p className="text-gray-600 text-sm mb-4">{product.description.substring(0, 80)}...</p>
        <div className="flex justify-between items-center mb-4">
          <span className="text-2xl font-bold text-primary">{product.price} Birr</span>
          <span className={`text-xs px-2 py-1 rounded-full ${getStockClass(product.stock_quantity)}`}>
            {getStockText(product.stock_quantity)}
          </span>
        </div>
        <div className="flex items-center justify-center mb-4">
          <div className="flex text-yellow-400 text-sm mr-2">
            {generateStarRating(product.rating)}
          </div>
          <span className="text-gray-600 text-sm">({product.review_count || 0})</span>
        </div>
        <div className="flex space-x-2">
          {!auth.isSeller && (
            <button
              onClick={() => addToCart(product)}
              className="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-secondary transition font-semibold"
            >
              <i className="fas fa-cart-plus mr-2"></i>Add to Cart
            </button>
          )}
          <Link
            to={`/product/${product.id}`}
            className={`${auth.isSeller ? 'flex-1' : 'w-12'} bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition flex items-center justify-center`}
          >
            <i className="fas fa-eye"></i>
          </Link>
        </div>
      </div>
    </div>
  );
};