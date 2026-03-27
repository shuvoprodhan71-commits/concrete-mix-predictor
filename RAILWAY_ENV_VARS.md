# Railway Environment Variables

Set these in your Railway project under **Variables** tab:

## Required

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Must be `production` | `production` |
| `DATABASE_URL` | MySQL connection string from Railway MySQL plugin | `mysql://root:pass@mysql.railway.internal:3306/railway` |
| `JWT_SECRET` | Long random string for session signing (64+ chars) | `openssl rand -hex 64` |

## Optional (leave blank — not needed on Railway)

| Variable | Description |
|---|---|
| `VITE_APP_ID` | Manus OAuth — not used on Railway |
| `OAUTH_SERVER_URL` | Manus OAuth — not used on Railway |
| `VITE_OAUTH_PORTAL_URL` | Manus OAuth — not used on Railway |
| `OWNER_OPEN_ID` | Manus platform — not used on Railway |
| `BUILT_IN_FORGE_API_URL` | Manus platform — not used on Railway |
| `BUILT_IN_FORGE_API_KEY` | Manus platform — not used on Railway |

> **Note:** Railway sets `PORT` automatically. Do not set it manually.
