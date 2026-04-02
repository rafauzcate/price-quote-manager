import { useState, useEffect } from 'react';
import { User, Calendar, CreditCard as Edit2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  name: string;
  company: string;
  last_login: string;
  created_at: string;
  updated_at: string;
}

interface UserProfileHeaderProps {
  profile: UserProfile | null;
  userEmail: string;
  onProfileUpdate: () => void;
}

export function UserProfileHeader({ profile, userEmail, onProfileUpdate }: UserProfileHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile?.name || '');
  const [editCompany, setEditCompany] = useState(profile?.company || '');

  useEffect(() => {
    setEditName(profile?.name || '');
    setEditCompany(profile?.company || '');
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          name: editName,
          company: editCompany,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) {
        console.error('Failed to update profile:', error);
        alert('Failed to save profile. Please try again.');
        return;
      }

      setIsEditing(false);
      onProfileUpdate();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  const handleCancel = () => {
    setEditName(profile?.name || '');
    setEditCompany(profile?.company || '');
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="flex flex-col gap-1">
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Enter your name"
                      className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={editCompany}
                      onChange={(e) => setEditCompany(e.target.value)}
                      placeholder="Company name"
                      className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSave}
                      className="p-1 text-green-600 hover:text-green-700"
                      title="Save"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleCancel}
                      className="p-1 text-red-600 hover:text-red-700"
                      title="Cancel"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {profile?.name || 'No name set'}
                    </h3>
                    {profile?.company && (
                      <span className="text-gray-400">•</span>
                    )}
                    {profile?.company && (
                      <span className="text-gray-600">{profile.company}</span>
                    )}
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Edit profile"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">{userEmail}</p>
                </>
              )}
            </div>
          </div>
        </div>
        {profile?.last_login && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>Last login: {formatDate(profile.last_login)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
