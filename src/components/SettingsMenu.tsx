import { useState } from 'react';
import { Settings, X, Shield } from 'lucide-react';

export function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
        title="Settings"
      >
        <Settings className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
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
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">AI Parsing Security</h4>
                <p className="text-sm text-gray-700">
                  OpenAI API key management has been moved to a secure server-side Supabase Edge Function.
                  API keys are no longer accepted, stored, or read from the browser.
                </p>
                <p className="text-xs text-gray-500 mt-3">
                  To update the key, configure the <code>OPENAI_API_KEY</code> secret in Supabase Edge Functions.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
