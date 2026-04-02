import { useState } from 'react';
import { Lock, X, Eye, EyeOff } from 'lucide-react';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (password: string) => Promise<boolean>;
  mode: 'setup' | 'verify';
}

export function AdminPasswordModal({ isOpen, onClose, onVerify, mode }: AdminPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'setup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setIsVerifying(true);
    try {
      const verified = await onVerify(password);
      if (verified) {
        setPassword('');
        setConfirmPassword('');
        onClose();
      } else {
        setError(mode === 'verify' ? 'Incorrect password' : 'Failed to set password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setError('');
    setShowPassword(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">
              {mode === 'setup' ? 'Set Admin Password' : 'Admin Verification Required'}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {mode === 'setup'
            ? 'Create a password to protect access to sensitive settings like API keys.'
            : 'Enter the admin password to access sensitive settings.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                placeholder={mode === 'setup' ? 'Create password' : 'Enter admin password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {mode === 'setup' && (
              <div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isVerifying}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isVerifying ? 'Verifying...' : mode === 'setup' ? 'Set Password' : 'Verify'}
              </button>
            </div>
          </div>
        </form>

        {mode === 'setup' && (
          <p className="text-xs text-gray-500 mt-4">
            Password must be at least 8 characters long. Store this password securely.
          </p>
        )}
      </div>
    </div>
  );
}
