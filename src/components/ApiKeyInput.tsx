import { Shield } from 'lucide-react';

export function ApiKeyInput() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex items-center gap-3 mb-3">
        <Shield className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-800">API Key Management</h2>
      </div>
      <p className="text-sm text-gray-700">
        API key management has been moved to the secure backend. This application no longer
        stores or reads provider API keys in the browser.
      </p>
      <p className="text-xs text-gray-500 mt-3">
        Configure <code>OPENAI_API_KEY</code> using Supabase Edge Function secrets.
      </p>
    </div>
  );
}
