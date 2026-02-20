# HubSpot UI Extension — Relationship Intelligence CRM Card

This directory contains the HubSpot UI Extension that embeds the Relationship Intelligence chat inside HubSpot CRM records (contacts, companies, deals).

## How it works

1. The extension adds an **App Card** to CRM record pages (as a tab)
2. When a user clicks "Open Chat", it:
   - Calls your backend to generate a short-lived auth token
   - Opens an iframe modal pointing to your app's `/hubspot-embed` page
3. The iframe authenticates with the token and renders the chat interface
4. The chat has full context about which CRM record is being viewed

## Setup

### Prerequisites

- [HubSpot CLI](https://developers.hubspot.com/docs/platform/cli-reference): `npm install -g @hubspot/cli@latest`
- Your web app deployed and accessible (e.g., `https://your-app.example.com`)
- HubSpot developer account with your public app already created

### 1. Configure the app URL

Edit `src/app/extensions/RelationshipIntelligenceCard.jsx` and replace `{{APP_URL}}` with your deployed app URL:

```js
const APP_URL = 'https://your-app.example.com';
```

Also update `src/app/app.json` to add your URL to `allowedUrls`:

```json
{
  "allowedUrls": ["https://your-app.example.com"]
}
```

### 2. Authenticate the CLI

```bash
cd hubspot-extension
hs auth
```

Follow the prompts to connect your HubSpot developer account.

### 3. Upload the project

```bash
hs project upload
```

### 4. Install in a test portal

After uploading, install the app in a HubSpot portal:
- Go to your HubSpot developer account → Apps → your app
- Install it in your target portal
- Navigate to any Contact/Company/Deal record
- You should see the "Relationship Intelligence" tab

## File structure

```
hubspot-extension/
├── hsproject.json                              # HubSpot project config
├── README.md
└── src/app/
    ├── app.json                                # App manifest (scopes, extensions)
    └── extensions/
        ├── relationship-intelligence-card.json # Card definition (location, object types)
        └── RelationshipIntelligenceCard.jsx    # React component for the card
```

## Authentication flow

```
HubSpot CRM Record
  └─ App Card (RelationshipIntelligenceCard.jsx)
       │
       ├─ Gets context: portal ID, user email, record ID, record type
       │
       ├─ POST /api/hubspot/embed-token (via hubspot.fetch)
       │   → Backend verifies portal + user → returns short-lived JWT
       │
       └─ openIframeModal({ uri: "/hubspot-embed?token=..." })
            │
            └─ Embed page exchanges token for session
               → Full chat interface with CRM context
```

## Notes

- The iframe uses `Authorization: Bearer` headers instead of cookies (avoids third-party cookie issues)
- The embed token expires in 5 minutes — it's exchanged for a full 8-hour session on page load
- The `frame-ancestors` CSP header allows only `*.hubspot.com` to embed the page
- The card appears on contacts, companies, and deals — edit `relationship-intelligence-card.json` to change this
