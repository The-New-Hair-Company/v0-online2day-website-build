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

Optional WhatsApp Cloud API settings (all are required before WhatsApp sending is enabled):

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_API_VERSION` (defaults to `v23.0`)

Configure Meta's callback URL as `https://www.online2day.com/api/webhooks/whatsapp`.
The Vercel application validates Meta's signature before forwarding the event to
this gateway, so `WHATSAPP_APP_SECRET` and `WHATSAPP_VERIFY_TOKEN` belong in
Vercel rather than this service.
