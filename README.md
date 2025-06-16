# TeamPulse MVP - Deployment Guide

## Prerequisites
- Ubuntu 22.04 server (DigitalOcean droplet)
- Domain with DNS pointing to server
- Google account for Apps Script
- Stripe account
- OpenAI API key

## 1. Server Setup (5 min)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install nginx
sudo apt install nginx -y

# Install certbot for SSL
sudo apt install certbot python3-certbot-nginx -y

# Create web directory
sudo mkdir -p /var/www/teampulse
sudo chown -R $USER:$USER /var/www/teampulse
```

## 2. Deploy Frontend (3 min)

```bash
# Clone/upload files to server
cd /var/www/teampulse

# Create all frontend files:
# - index.html
# - admin.html  
# - styles.css
# - main.js
# - admin.js
# - assets/ (create folder, add placeholder files)

# Set permissions
sudo chmod -R 755 /var/www/teampulse
```

## 3. Setup Backend (5 min)

```bash
# Install Node.js if missing
sudo apt install -y nodejs npm

# Copy backend files
mkdir -p /var/www/teampulse/backend
cp -r server/* /var/www/teampulse/backend/
cd /var/www/teampulse/backend
npm install

# Create .env with your secrets
cat <<EOF > .env
STRIPE_SK=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
DOMAIN=https://yourdomain.com
EOF

# Start the server (use pm2 or systemd in production)
node server.js &
```

## 4. Configure Nginx (5 min)

```bash
# Create nginx config
sudo nano /etc/nginx/sites-available/teampulse

# Add this configuration:
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    root /var/www/teampulse;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/checkout {
        proxy_pass http://localhost:3000/checkout;
    }

    location /api/webhook {
        proxy_pass http://localhost:3000/webhook;
    }

    location /api {
        proxy_pass https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/teampulse /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 5. Google Apps Script Setup (10 min)

1. Go to [script.google.com](https://script.google.com)
2. Create new project "TeamPulse Backend"
3. Copy all .gs files:
   - Code.gs
   - projects.gs
   - surveys.gs
   - forms.gs
   - responses.gs
   - analytics.gs
   - stripe.gs
   - security.gs
   - config.gs

4. Enable services:
   - Click "Services" → Add "Drive API"
   - Add "Gmail API"

5. Deploy:
   - Click "Deploy" → "New Deployment"
   - Type: "Web app"
   - Execute as: "Me"
   - Access: "Anyone"
   - Copy deployment URL

6. Set script properties:
   - Run `setup()` function once
   - Open Project Settings → Script Properties
   - Add:
     - OPENAI_KEY: your-openai-key
     - STRIPE_SK: sk_live_...
     - DOMAIN: https://yourdomain.com
     - STRIPE_WEBHOOK_SECRET: whsec_...

## 6. Update Frontend URLs (2 min)

```bash
# Update API_BASE in admin.js
sed -i 's|YOUR_SCRIPT_ID|actual-script-id|g' /var/www/teampulse/admin.js

# Update domain in main.js if needed
```

## 7. Stripe Setup (5 min)

1. Login to Stripe Dashboard
2. Create webhook endpoint:
   - URL: `https://yourdomain.com/api`
   - Events: `checkout.session.completed`
   - Copy webhook secret

3. Update payment settings:
   - Enable SEPA Direct Debit
   - Configure invoice settings

## 8. Create Initial Data (3 min)

1. Go to Google Drive
2. Create folder "Sociometry-Projects"
3. Run in Apps Script:

```javascript
function initialSetup() {
  setup();
  setupTriggers();
  createProjectsFolder();
}
```

## 9. Test Deployment

1. Visit https://yourdomain.com
2. Test pricing calculator
3. Go to /admin.html
4. Create test project
5. Run test survey

## Maintenance

### Daily tasks (automated):
- Data cleanup (2 AM UTC)
- Reminder checks (every 6h)

### Manual tasks:
- Check Apps Script logs weekly
- Monitor Stripe webhooks
- Backup project data monthly

### Update deployment:
```bash
# Update files
scp -r *.html *.js *.css user@server:/var/www/teampulse/

# Reload nginx
sudo systemctl reload nginx
```

## Troubleshooting

**CORS errors**: Update Apps Script deployment settings
**Payment fails**: Check Stripe webhook logs
**No emails sent**: Check Gmail quota (500/day limit)
**Script errors**: View Stackdriver logs in Apps Script

## Security Notes

- HMAC secret auto-generated on setup
- All project data isolated by ID
- 90-day auto-deletion configured
- GDPR compliance built-in

## Support

- Apps Script issues: Check execution logs
- Frontend issues: Browser console
- Payment issues: Stripe dashboard
- Server issues: `sudo journalctl -u nginx`

---
MVP ready for deployment! 🚀