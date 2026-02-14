import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductFilters, Category } from '../types/product';
import { ProductCard } from '../components/common/ProductCard';
import { ProductService } from '../services/api';
import { useSearchParams } from 'react-router-dom';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  // State is derived from URL search params
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<ProductFilters>({
    category: searchParams.get('category') || undefined,
    priceRange: searchParams.get('price') ? searchParams.get('price')?.split('-').map(Number) as [number, number] : undefined,
    productType: searchParams.get('type') as 'physical' | 'digital' | undefined,
    inStock: searchParams.get('inStock') === 'true' || undefined,
    lowStock: searchParams.get('lowStock') === 'true' || undefined,
  });

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  // Effect to update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (sortBy !== 'name') params.set('sortBy', sortBy);
    if (filters.category) params.set('category', filters.category);
    if (filters.productType) params.set('type', filters.productType);
    if (filters.inStock) params.set('inStock', 'true');
    if (filters.lowStock) params.set('lowStock', 'true');
    if (filters.priceRange) params.set('price', `${filters.priceRange[0]}-${filters.priceRange[1]}`);
    
    setSearchParams(params);
  }, [searchTerm, sortBy, filters, setSearchParams]);


  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await ProductService.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await ProductService.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filters.category) {
      filtered = filtered.filter(p => p.category_name === filters.category);
    }
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      filtered = filtered.filter(p => p.price >= min && (max === Infinity || p.price <= max));
    }
    if (filters.productType) {
      filtered = filtered.filter(p => p.product_type === filters.productType);
    }
    if (filters.inStock && !filters.lowStock) {
        filtered = filtered.filter(p => p.stock_quantity > 10);
    }
    if(filters.lowStock && !filters.inStock) {
        filtered = filtered.filter(p => p.stock_quantity <= 10 && p.stock_quantity > 0);
    }
    if(filters.inStock && filters.lowStock) {
        filtered = filtered.filter(p => p.stock_quantity > 0);
    }


    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [products, filters, searchTerm, sortBy]);

  const handleFilterChange = (filterName: keyof ProductFilters, value: any) => {
    setFilters(prev => ({...prev, [filterName]: value}));
  }
  
  const handlePriceFilter = (range: string) => {
    const priceMap: { [key: string]: [number, number] } = {
        '0-50': [0, 50],
        '50-100': [50, 100],
        '100-500': [100, 500],
        '500+': [500, Infinity],
    };
    setFilters(prev => ({ ...prev, priceRange: priceMap[range] }));
  };


  const clearFilters = () => {
    setSearchTerm('');
    setSortBy('name');
    setFilters({
        category: undefined,
        priceRange: undefined,
        productType: undefined,
        inStock: undefined,
        lowStock: undefined,
    });
  };
  
  const getPriceRangeValue = () => {
    if(!filters.priceRange) return "";
    const key = `${filters.priceRange[0]}-${filters.priceRange[1]}`;
    const keyMap: {[key: string]: string} = {
        '0-50': '0-50',
        '50-100': '50-100',
        '100-500': '100-500',
        '500-Infinity': '500+',
    }
    return keyMap[key];
  }

  return (
    <div className="bg-gray-50 font-inter">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-1/4">
            <div className="bg-white rounded-xl shadow-md p-4 md:p-6 lg:sticky lg:top-24">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Filters</h3>
                <button
                  onClick={clearFilters}
                  className="lg:hidden text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium mb-3">Categories</h4>
                <div className="space-y-2">
                  {categories.map(category => (
                    <label key={category.id} className="flex items-center">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={filters.category === category.name}
                        onChange={(e) => handleFilterChange('category', e.target.checked ? category.name : undefined)}
                      />
                      <span>{category.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium mb-3">Price Range</h4>
                <div className="space-y-2">
                  {['0-50', '50-100', '100-500', '500+'].map(range => (
                      <label className="flex items-center" key={range}>
                          <input
                          type="radio"
                          name="price"
                          value={range}
                          className="mr-2"
                          checked={getPriceRangeValue() === range}
                          onChange={(e) => handlePriceFilter(e.target.value)}
                          />
                          <span>{range === '500+' ? '500+ Birr' : `${range.replace('-', ' - ')} Birr`}</span>
                      </label>
                  ))}
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium mb-3">Product Type</h4>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={filters.productType === 'physical'}
                      onChange={(e) => handleFilterChange('productType', e.target.checked ? 'physical' : undefined)}
                    />
                    <span>Physical Products</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={filters.productType === 'digital'}
                      onChange={(e) => handleFilterChange('productType', e.target.checked ? 'digital' : undefined)}
                    />
                    <span>Digital Products</span>
                  </label>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Stock Status</h4>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={filters.inStock || false}
                      onChange={(e) => handleFilterChange('inStock', e.target.checked)}
                    />
                    <span>In Stock</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={filters.lowStock || false}
                      onChange={(e) => handleFilterChange('lowStock', e.target.checked)}
                    />
                    <span>Low Stock</span>
                  </label>
                </div>
              </div>
              
              <button
                onClick={clearFilters}
                className="hidden lg:block w-full mt-6 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600 transition"
              >
                Clear All Filters
              </button>
            </div>
          </div>

          <div className="lg:w-3/4">
            <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-800">All Products</h2>
                  <p className="text-sm md:text-base text-gray-600 mt-1">
                    Showing {filteredProducts.length} of {products.length} products
                  </p>
                </div>
                
                <div className="w-full">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search products..."
                      className="w-full px-4 py-2 md:py-3 pl-10 md:pl-12 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm md:text-base"
                    />
                    <i className="fas fa-search absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm md:text-base"></i>
                  </div>
                </div>
                
                <div className="flex items-center justify-between space-x-2 md:space-x-4">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 px-2 md:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                  >
                    <option value="name">Name</option>
                    <option value="price-low">Price: Low</option>
                    <option value="price-high">Price: High</option>
                    <option value="newest">Newest</option>
                  </select>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                    >
                      <i className="fas fa-th text-sm"></i>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                    >
                      <i className="fas fa-list text-sm"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <i className="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
                <p className="text-gray-600">Loading products...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <i className="fas fa-search text-4xl text-gray-300 mb-4"></i>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No products found</h3>
                <p className="text-gray-500">Try adjusting your filters or search terms</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-6'}>
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} viewMode={viewMode} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};