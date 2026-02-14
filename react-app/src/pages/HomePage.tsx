import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Product, Category } from '../types/product';
import { ProductCard } from '../components/common/ProductCard';
import { AIAssistant } from '../components/common/AIAssistant';
import { ProductService } from '../services/api';

export const HomePage: React.FC = () => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ products: 0, customers: 0, orders: 0 });

  useEffect(() => {
    loadPageData();
    startCountUpAnimation();
  }, []);

  const loadPageData = async () => {
    try {
      const [products, cats] = await Promise.all([
        ProductService.getFeaturedProducts(4),
        ProductService.getCategories()
      ]);
      setFeaturedProducts(products);
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load homepage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCountUpAnimation = () => {
    const duration = 2000;
    const steps = 60;
    const stepDuration = duration / steps;
    const targets = { products: 587, customers: 12456, orders: 51234 };

    Object.entries(targets).forEach(([key, target]) => {
      let current = 0;
      const increment = target / steps;
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        setStats(prev => ({ ...prev, [key]: Math.floor(current) }));
      }, stepDuration);
    });
  };

  return (
    <div className="bg-light font-inter">
      {/* Enhanced Hero Section */}
      <section className="hero-gradient text-white relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-accent/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 py-32 relative z-10">
          <div className="max-w-4xl mx-auto text-center fade-in">
            <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
              Elevate Your
              <span className="bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent"> Shopping</span>
              Experience
            </h1>
            
            <p className="text-xl md:text-2xl mb-8 opacity-90 leading-relaxed">
              Discover curated products with intelligent recommendations. 
              Fast, secure, and personalized just for you.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
              <Link to="/products" className="group bg-white text-primary px-8 py-4 rounded-2xl font-semibold hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                <i className="fas fa-rocket mr-3 group-hover:animate-bounce"></i>
                Start Shopping Now
              </Link>
              <a href="#features" className="group border-2 border-white text-white px-8 py-4 rounded-2xl font-semibold hover:bg-white hover:text-primary transition-all duration-300">
                <i className="fas fa-play-circle mr-3 group-hover:animate-pulse"></i>
                Watch Demo
              </a>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-8 mt-12 opacity-80">
              <div className="flex items-center space-x-2">
                <i className="fas fa-shield-alt text-green-300"></i>
                <span className="text-sm">Secure Payments</span>
              </div>
              <div className="flex items-center space-x-2">
                <i className="fas fa-shipping-fast text-blue-300"></i>
                <span className="text-sm">Free Shipping</span>
              </div>
              <div className="flex items-center space-x-2">
                <i className="fas fa-star text-yellow-300"></i>
                <span className="text-sm">5-Star Reviews</span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <i className="fas fa-chevron-down text-white text-2xl"></i>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-white py-8 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="fade-in">
              <div className="text-3xl font-bold text-primary mb-2">{stats.products}+</div>
              <div className="text-gray-600 text-sm font-medium">Premium Products</div>
            </div>
            <div className="fade-in">
              <div className="text-3xl font-bold text-accent mb-2">{stats.customers.toLocaleString()}+</div>
              <div className="text-gray-600 text-sm font-medium">Happy Customers</div>
            </div>
            <div className="fade-in">
              <div className="text-3xl font-bold text-green-500 mb-2">{stats.orders.toLocaleString()}+</div>
              <div className="text-gray-600 text-sm font-medium">Orders Delivered</div>
            </div>
            <div className="fade-in">
              <div className="text-3xl font-bold text-orange-500 mb-2">24/7</div>
              <div className="text-gray-600 text-sm font-medium">Customer Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Features Section */}
      <section id="features" className="py-20 bg-light">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-5xl font-bold text-dark mb-4">Why Choose Yegna Market?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We're redefining e-commerce with cutting-edge technology and unparalleled customer experience.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 stagger-animation">
            <div className="card-hover bg-white rounded-3xl p-8 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <i className="fas fa-brain text-2xl text-white"></i>
                </div>
                <h3 className="text-xl font-semibold text-dark mb-3">AI Personalization</h3>
                <p className="text-gray-600 leading-relaxed">
                  Smart recommendations tailored to your preferences and browsing behavior.
                </p>
              </div>
            </div>

            <div className="card-hover bg-white rounded-3xl p-8 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <i className="fas fa-bolt text-2xl text-white"></i>
                </div>
                <h3 className="text-xl font-semibold text-dark mb-3">Lightning Fast</h3>
                <p className="text-gray-600 leading-relaxed">
                  Instant loading and seamless navigation for the best shopping experience.
                </p>
              </div>
            </div>

            <div className="card-hover bg-white rounded-3xl p-8 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-violet-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-accent to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <i className="fas fa-lock text-2xl text-white"></i>
                </div>
                <h3 className="text-xl font-semibold text-dark mb-3">Bank-Level Security</h3>
                <p className="text-gray-600 leading-relaxed">
                  Your data and payments are protected with military-grade encryption.
                </p>
              </div>
            </div>

            <div className="card-hover bg-white rounded-3xl p-8 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-amber-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <i className="fas fa-headset text-2xl text-white"></i>
                </div>
                <h3 className="text-xl font-semibold text-dark mb-3">24/7 Support</h3>
                <p className="text-gray-600 leading-relaxed">
                  Round-the-clock customer support with instant chat and callback options.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Featured Products */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <div className="fade-in">
              <h2 className="text-4xl font-bold text-dark mb-3">Featured Products</h2>
              <p className="text-gray-600 text-lg">Handpicked selections just for you</p>
            </div>
            <Link to="/products" className="group flex items-center space-x-2 text-primary hover:text-secondary font-semibold fade-in">
              <span>View All Products</span>
              <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 stagger-animation">
            {loading ? (
              <div className="col-span-4 text-center py-12">
                <i className="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
                <p className="text-gray-600">Loading products...</p>
              </div>
            ) : (
              featuredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Enhanced Categories Section */}
      <section id="categories" className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 fade-in">
            <h2 className="text-4xl font-bold text-dark mb-3">Shop by Category</h2>
            <p className="text-gray-600 text-lg">Explore our carefully curated collections</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 stagger-animation">
            {categories.map(category => (
              <Link
                key={category.id}
                to={`/products?category=${encodeURIComponent(category.name)}`}
                className="card-hover bg-white rounded-3xl p-6 text-center group"
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                  {category.icon}
                </div>
                <h3 className="font-semibold text-gray-800">{category.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 fade-in">
            <h2 className="text-4xl font-bold text-dark mb-3">What Our Customers Say</h2>
            <p className="text-gray-600 text-lg">Join thousands of satisfied shoppers</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 stagger-animation">
            <div className="card-hover bg-light rounded-3xl p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">SG</div>
                <div className="ml-4">
                  <h4 className="font-semibold text-dark">Surafel Girma</h4>
                  <div className="flex text-yellow-400">
                    <i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i>
                  </div>
                </div>
              </div>
              <p className="text-gray-600 italic">"The AI recommendations are spot-on! Found products I didn't even know I needed."</p>
            </div>
            <div className="card-hover bg-light rounded-3xl p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-accent to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">TA</div>
                <div className="ml-4">
                  <h4 className="font-semibold text-dark">Tesfaye Ayenew</h4>
                  <div className="flex text-yellow-400">
                    <i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star-half-alt"></i>
                  </div>
                </div>
              </div>
              <p className="text-gray-600 italic">"Lightning fast delivery and excellent customer support. Will shop again!"</p>
            </div>
            <div className="card-hover bg-light rounded-3xl p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg">YA</div>
                <div className="ml-4">
                  <h4 className="font-semibold text-dark">Yoseph Aderaw</h4>
                  <div className="flex text-yellow-400">
                    <i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i>
                  </div>
                </div>
              </div>
              <p className="text-gray-600 italic">"The user interface is incredibly intuitive. Best shopping experience online!"</p>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Special Offers */}
      <section id="deals" className="py-20 bg-gradient-to-r from-primary to-accent text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full translate-y-32 -translate-x-32"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12 fade-in">
            <h2 className="text-4xl font-bold mb-3">Limited Time Offers</h2>
            <p className="text-xl opacity-90">Don't miss these exclusive deals</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto stagger-animation">
            <div className="glass-effect rounded-3xl p-8 text-center card-hover">
              <i className="fas fa-bolt text-5xl mb-6 text-yellow-300"></i>
              <h3 className="text-2xl font-bold mb-3">Flash Sale</h3>
              <p className="mb-6 opacity-90">Up to 60% off on premium electronics. Limited stock available!</p>
              <div className="text-4xl font-bold text-yellow-300 mb-4">60% OFF</div>
              <div className="flex justify-center items-center space-x-2 text-sm opacity-80">
                <i className="fas fa-clock"></i>
                <span>Ends in 24:00:00</span>
              </div>
            </div>
            <div className="glass-effect rounded-3xl p-8 text-center card-hover">
              <i className="fas fa-shipping-fast text-5xl mb-6 text-green-300"></i>
              <h3 className="text-2xl font-bold mb-3">Free Shipping</h3>
              <p className="mb-6 opacity-90">Free express shipping on all orders over 2000 Birr. No code needed!</p>
              <div className="text-4xl font-bold text-green-300 mb-4">FREE</div>
              <div className="text-sm opacity-80">On orders over 2000 Birr</div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-16 bg-dark text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Stay in the Loop</h2>
          <p className="text-gray-300 mb-8 text-lg">Get exclusive deals and product updates before anyone else</p>
          <div className="max-w-md mx-auto flex flex-col sm:flex-row rounded-2xl overflow-hidden shadow-2xl">
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="flex-1 px-6 py-4 border-0 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800 rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none"
            />
            <button className="bg-primary px-8 py-4 font-semibold hover:bg-secondary transition-all duration-300 rounded-b-2xl sm:rounded-r-2xl sm:rounded-bl-none">
              <i className="fas fa-paper-plane mr-2"></i>Subscribe
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};