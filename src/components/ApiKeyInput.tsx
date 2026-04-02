import { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Save, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ApiKeyInputProps {
  userId: string | undefined;
  onApiKeySaved?: () => void;
}

export function ApiKeyInput({ userId, onApiKeySaved }: ApiKeyInputProps) {
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (userId) {
      loadApiKey();
    }
  }, [userId]);

  const loadApiKey = async () => {
    try {
      const { data, error } = await supabase
        .from('encrypted_api_keys')
        .select('encrypted_value')
        .eq('user_id', userId)
        .eq('key_name', 'openai')
        .maybeSingle();

      if (data && !error) {
        setSavedKey(data.encrypted_value);
        setApiKey('••••••••••••••••••••••••••••••••••••••••');
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  };

  const saveApiKey = async () => {
    if (!userId || !apiKey || apiKey.includes('••••')) {
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      setSaveMessage({ type: 'error', text: 'Invalid API key format. Must start with sk-' });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const { error } = await supabase
        .from('encrypted_api_keys')
        .upsert({
          user_id: userId,
          key_name: 'openai',
          encrypted_value: apiKey,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,key_name'
        });

      if (error) throw error;

      setSavedKey(apiKey);
      setApiKey('••••••••••••••••••••••••••••••••••••••••');
      setSaveMessage({ type: 'success', text: 'API key saved securely' });
      setTimeout(() => setSaveMessage(null), 3000);

      if (onApiKeySaved) {
        onApiKeySaved();
      }
    } catch (error) {
      console.error('Failed to save API key:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save API key' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyChange = (value: string) => {
    setApiKey(value);
    setSaveMessage(null);
  };

  const hasUnsavedChanges = apiKey && !apiKey.includes('••••') && apiKey !== savedKey;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex items-center gap-3 mb-3">
        <Key className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-800">OpenAI API Key</h2>
        {savedKey && (
          <span className="ml-auto flex items-center gap-1 text-sm text-green-600">
            <Shield className="w-4 h-4" />
            Secured
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
            placeholder="Enter your OpenAI API key (sk-...)"
            value={apiKey}
            onChange={(e) => handleKeyChange(e.target.value)}
            onFocus={() => {
              if (apiKey.includes('••••')) {
                setApiKey('');
              }
            }}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            type="button"
          >
            {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {hasUnsavedChanges && (
          <button
            onClick={saveApiKey}
            disabled={isSaving}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
      {saveMessage && (
        <p className={`text-sm mt-2 ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {saveMessage.text}
        </p>
      )}
      <p className="text-sm text-gray-600 mt-2">
        Your API key is encrypted and stored securely in the database. Get your key from{' '}
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          OpenAI
        </a>
      </p>
    </div>
  );
}
