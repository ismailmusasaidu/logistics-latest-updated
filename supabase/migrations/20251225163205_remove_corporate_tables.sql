/*
  # Remove Corporate/Enterprise Tables

  This migration removes all corporate and enterprise-level tables that are not needed
  for a basic customer/rider/admin delivery system.

  ## Tables Being Removed
  
  1. Corporate Management:
    - `invoice_line_items` - Line items in company invoices
    - `company_invoices` - Invoices for corporate accounts
    - `bulk_delivery_items` - Items in bulk deliveries
    - `bulk_deliveries` - Bulk delivery management
    - `scheduled_deliveries` - Recurring scheduled deliveries
    - `corporate_orders` - Corporate order tracking
    - `company_staff` - Company staff members
    - `departments` - Company departments
    - `companies` - Corporate accounts
  
  ## Tables Being Kept
  
  Core functionality:
  - profiles, riders, orders, order_tracking, ratings, order_complaints
  - delivery_zones, order_type_adjustments, promotions
  - wallet_transactions, pricing_change_logs

  ## Safety Notes
  
  - All tables are empty (0 rows) so no data will be lost
  - Foreign key constraints will be automatically dropped
  - RLS policies will be automatically removed
*/

-- Drop tables in reverse dependency order

-- Drop invoice line items first (depends on company_invoices and orders)
DROP TABLE IF EXISTS invoice_line_items CASCADE;

-- Drop company invoices (depends on companies)
DROP TABLE IF EXISTS company_invoices CASCADE;

-- Drop bulk delivery items (depends on bulk_deliveries and orders)
DROP TABLE IF EXISTS bulk_delivery_items CASCADE;

-- Drop bulk deliveries (depends on companies)
DROP TABLE IF EXISTS bulk_deliveries CASCADE;

-- Drop scheduled deliveries (depends on companies and departments)
DROP TABLE IF EXISTS scheduled_deliveries CASCADE;

-- Drop corporate orders (depends on companies, departments, and orders)
DROP TABLE IF EXISTS corporate_orders CASCADE;

-- Drop company staff (depends on companies)
DROP TABLE IF EXISTS company_staff CASCADE;

-- Drop departments (depends on companies)
DROP TABLE IF EXISTS departments CASCADE;

-- Drop companies (no dependencies)
DROP TABLE IF EXISTS companies CASCADE;
