import express from 'express';
import Stripe from 'stripe';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SK, {
  apiVersion: '2023-10-16',
});

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL; // e.g. https://script.google.com/macros/s/ID/exec

app.post('/checkout', express.json(), async (req, res) => {
  const { members, criteria, total, company, email } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'sepa_debit'],
      mode: 'payment',
      success_url: `${process.env.DOMAIN}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.DOMAIN}/#pricing`,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(Number(total) * 100),
            product_data: {
              name: 'TeamPulse Analysis',
              description: `${members} Mitglieder, ${criteria} Kriterien`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: { company, members, criteria },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          metadata: { company },
          custom_fields: [{ name: 'Firma', value: company }],
        },
      },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Stripe webhook endpoint
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Forward event to Apps Script for processing
  if (APPS_SCRIPT_URL) {
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stripeWebhook', ...event }),
      });
    } catch (err) {
      console.error('Failed to forward webhook:', err);
    }
  }

  res.json({ received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
