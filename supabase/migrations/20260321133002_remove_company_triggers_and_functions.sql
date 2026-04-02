/*
  # Remove company-related triggers and functions

  1. Changes
    - Drop trigger `auto_assign_company_trigger` on user_profiles table
    - Drop trigger `auto_assign_quote_company_trigger` on quotes table
    - Drop function `auto_assign_company()`
    - Drop function `auto_assign_quote_company()`
    - Drop function `use_invitation_code()`
    - Drop function `get_email_domain()` if it exists
    
  2. Reason
    - These triggers and functions reference `company_id` column which no longer exists
    - System has been reverted to single-user mode without company support
    
  3. Security
    - No security impact as these functions are no longer needed
*/

-- Drop triggers
DROP TRIGGER IF EXISTS auto_assign_company_trigger ON user_profiles;
DROP TRIGGER IF EXISTS auto_assign_quote_company_trigger ON quotes;

-- Drop functions
DROP FUNCTION IF EXISTS auto_assign_company();
DROP FUNCTION IF EXISTS auto_assign_quote_company();
DROP FUNCTION IF EXISTS use_invitation_code(text);
DROP FUNCTION IF EXISTS get_email_domain(text);