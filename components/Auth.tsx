
import React, { useState } from 'react';
import * as apiService from '../services/apiService';
import { User } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface AuthProps {
  onLogin: (user: User) => void;
  onSignup: (user: User) => void;
  setError: (message: string | null) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onSignup, setError }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password cannot be empty.");
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const user = await apiService.login(email, password);
        onLogin(user);
      } else {
        const user = await apiService.signup(email, password);
        onSignup(user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(prev => (prev === 'login' ? 'signup' : 'login'));
    setError(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-white shadow-2xl rounded-xl p-8">
        <h2 className="text-3xl font-bold text-center text-primary-700 mb-2">
          {mode === 'login' ? 'Welcome Back!' : 'Create Your Account'}
        </h2>
        <p className="text-center text-gray-500 mb-6">
          {mode === 'login' ? 'Log in to access your workout plans.' : 'Get started with your personalized AI coach.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="mt-1">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isLoading ? <LoadingSpinner /> : (mode === 'login' ? 'Log In' : 'Sign Up')}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                {mode === 'login' ? 'Don\'t have an account?' : 'Already have an account?'}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={toggleMode}
              className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {mode === 'login' ? 'Sign up now' : 'Log in instead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
