import { useState, useEffect } from 'react';
import { Settings, X, Shield, Lock } from 'lucide-react';
import { ApiKeyInput } from './ApiKeyInput';
import { supabase } from '../lib/supabase';

interface SettingsMenuProps {
  userId: string | undefined;
  onApiKeySaved?: () => void;
}

export function SettingsMenu({ userId, onApiKeySaved }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isCheckingOwner, setIsCheckingOwner] = useState(false);

  useEffect(() => {
    if (userId && isOpen) {
      checkOwnerStatus();
    }
  }, [userId, isOpen]);

  const checkOwnerStatus = async () => {
    if (!userId) return;

    setIsCheckingOwner(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_owner')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to check owner status:', error);
        setIsOwner(false);
        setIsCheckingOwner(false);
        return;
      }

      const ownerStatus = data?.is_owner || false;
      setIsOwner(ownerStatus);
    } catch (error) {
      console.error('Error checking owner status:', error);
      setIsOwner(false);
    } finally {
      setIsCheckingOwner(false);
    }
  };

  const handleSettingsClick = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button
        onClick={handleSettingsClick}
        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
        title="Settings (Admin Only)"
      >
        <Settings className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-[450px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[80vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-800">Settings</h3>
                  <Shield className="w-4 h-4 text-blue-600" />
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isCheckingOwner ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3 animate-pulse" />
                  <p className="text-gray-600">Checking access permissions...</p>
                </div>
              ) : !isOwner ? (
                <div className="text-center py-8">
                  <Lock className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <p className="text-gray-800 font-semibold mb-2">Owner Access Only</p>
                  <p className="text-sm text-gray-600">
                    Only the application owner can access settings and manage API keys.
                  </p>
                  <p className="text-xs text-gray-500 mt-3">
                    If you need access, please contact the application owner.
                  </p>
                </div>
              ) : (
                <div className="border-t pt-4">
                  <ApiKeyInput userId={userId} onApiKeySaved={onApiKeySaved} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
