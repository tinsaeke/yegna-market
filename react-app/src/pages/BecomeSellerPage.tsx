import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { useToast } from '../components/ToastProvider';

export const BecomeSellerPage: React.FC = () => {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const { showSuccess } = useToast();
  const [formData, setFormData] = useState({
    shop_name: '',
    shop_description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.createSeller({
        user_id: auth.user!.id,
        shop_name: formData.shop_name,
        shop_description: formData.shop_description
      });
      
      showSuccess('Seller application submitted! Please wait for admin approval.');
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create seller account');
    } finally {
      setLoading(false);
    }
  };

  if (!auth.isAuthenticated) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Become a Seller</h1>
          <p className="text-gray-600">Start selling your products on our marketplace</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shop Name *
            </label>
            <input
              type="text"
              value={formData.shop_name}
              onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your shop name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shop Description
            </label>
            <textarea
              value={formData.shop_description}
              onChange={(e) => setFormData({ ...formData, shop_description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tell customers about your shop"
              rows={4}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Seller Benefits:</h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>✓ List unlimited products</li>
              <li>✓ Manage your own inventory</li>
              <li>✓ Track orders and shipments</li>
              <li>✓ Build your brand</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Seller Account'}
          </button>
        </form>
      </div>
    </div>
  );
};
