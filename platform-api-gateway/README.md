# Online2Day Platform API Gateway

This deployable gateway keeps provider credentials in Azure while preserving the
existing Company Platform API. It validates Supabase access tokens for protected
integration routes, proxies all other API traffic to the existing .NET API, and
owns HubSpot and Supabase service-role writes used by public website workflows.

Required environment variables:

- `CORE_API_URL`
- `SUPABASE_ISSUER`
- `SUPABASE_AUDIENCE`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HUBSPOT_ACCESS_TOKEN`
- `GATEWAY_SERVER_KEY`
- `ADMIN_EMAILS` (comma-separated fallback administrators)
- `ALLOWED_ORIGINS` (comma separated)

Optional HubSpot settings:

- `HUBSPOT_OWNER_EMAIL`
- `HUBSPOT_DEAL_PIPELINE`
- `HUBSPOT_NEW_ENQUIRY_STAGE`
