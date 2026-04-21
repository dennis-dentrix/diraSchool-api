# Pesapal Subscription Setup

## 1) API environment variables

Add these values in `apps/api/.env` (or PM2 ecosystem env in production):

```env
PESAPAL_ENABLED=true
PESAPAL_ENV=sandbox
PESAPAL_BASE_URL=
PESAPAL_CONSUMER_KEY=
PESAPAL_CONSUMER_SECRET=
PESAPAL_NOTIFICATION_ID=
PESAPAL_CURRENCY=KES
```

Notes:
- `PESAPAL_BASE_URL` is optional. Leave blank to use defaults.
- Sandbox default: `https://cybqa.pesapal.com/pesapalv3`
- Live default: `https://pay.pesapal.com/v3`

## 2) Configure IPN in Pesapal

Register this callback URL in Pesapal and use the returned `notification_id`:

`https://<your-api-domain>/api/v1/subscriptions/pesapal/ipn`

Then set that value as `PESAPAL_NOTIFICATION_ID`.

## 3) Production callback target

The browser callback redirects users to:

`<CLIENT_URL>/billing?provider=pesapal`

So ensure `CLIENT_URL` matches your live web domain.

## 4) Endpoints used by the web app

- `POST /api/v1/subscriptions/pesapal/checkout`
- `GET /api/v1/subscriptions/pesapal/status/:merchantReference`
- `GET|POST /api/v1/subscriptions/pesapal/ipn` (Pesapal webhook)

