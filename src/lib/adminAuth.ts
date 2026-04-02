import { supabase } from './supabase';

export interface AdminStatus {
  isAdmin: boolean;
  hasPassword: boolean;
}

export async function checkAdminStatus(userId: string): Promise<AdminStatus> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('is_admin, admin_password_hash')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to check admin status:', error);
      return { isAdmin: false, hasPassword: false };
    }

    if (!data) {
      return { isAdmin: false, hasPassword: false };
    }

    return {
      isAdmin: data.is_admin || false,
      hasPassword: !!data.admin_password_hash,
    };
  } catch (error) {
    console.error('Error checking admin status:', error);
    return { isAdmin: false, hasPassword: false };
  }
}

export async function setAdminPassword(userId: string, passwordHash: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ admin_password_hash: passwordHash })
      .eq('id', userId);

    if (error) {
      console.error('Failed to set admin password:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error setting admin password:', error);
    return false;
  }
}

export async function verifyAdminPassword(userId: string, passwordHash: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('admin_password_hash')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    return data.admin_password_hash === passwordHash;
  } catch (error) {
    console.error('Error verifying admin password:', error);
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
