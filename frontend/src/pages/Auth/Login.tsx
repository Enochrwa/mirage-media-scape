import React, { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-100">
      <form onSubmit={handleSubmit} className="p-8 bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md border border-zinc-800">
        <h1 className="text-3xl font-bold mb-6 text-center">Login to Zovyra</h1>
        {error && <div className="p-3 mb-4 bg-red-900/50 border border-red-500 text-red-200 rounded text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
          <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded font-bold transition-colors">
            Sign In
          </button>
        </div>
        <p className="mt-6 text-center text-zinc-400 text-sm">
          Don't have an account? <Link to="/register" className="text-indigo-400 hover:underline">Register</Link>
        </p>
      </form>
    </div>
  );
}
