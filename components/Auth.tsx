
import React, { useState } from 'react';
import * as apiService from '../services/apiService';
import { User } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { SparklesIcon } from './icons';

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
    <div className="max-w-md mx-auto fade-in">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-3xl p-8 shadow-2xl">
        {/* Logo/Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-br from-white to-gray-400 p-4 rounded-2xl">
            <SparklesIcon className="h-12 w-12 text-black" />
          </div>
        </div>

        <h2 className="text-3xl font-bold text-center text-white mb-2">
          {mode === 'login' ? 'Welcome Back' : 'Get Started'}
        </h2>
        <p className="text-center text-gray-400 mb-8">
          {mode === 'login' ? 'Log in to access your workout plans' : 'Create your account to begin training'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-white mb-2">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-white mb-2">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-white mb-2">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-4 px-4 rounded-2xl text-base font-bold bg-gradient-to-r from-white to-gray-200 text-black hover:from-gray-100 hover:to-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isLoading ? <LoadingSpinner /> : (mode === 'login' ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-gradient-to-r from-gray-900 to-black text-gray-400">
                {mode === 'login' ? 'Don\'t have an account?' : 'Already have an account?'}
              </span>
            </div>
          </div>

          <button
            onClick={toggleMode}
            className="mt-6 w-full py-3 px-4 border border-gray-800 rounded-2xl text-sm font-semibold text-white hover:bg-gray-900 hover:border-gray-700 transition-all"
          >
            {mode === 'login' ? 'Create Account' : 'Log In Instead'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
