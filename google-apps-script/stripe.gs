```javascript
// stripe.gs

function createCheckout(data) {
  const stripeKey = getConfig('STRIPE_SK');
  const domain = getConfig('DOMAIN');
  
  if (!stripeKey) {
    return {error: 'Stripe not configured'};
  }
  
  const url = 'https://api.stripe.com/v1/checkout/sessions';
  
  const payload = {
    'payment_method_types[]': 'card',
    'payment_method_types[]': 'sepa_debit',
    'mode': 'payment',
    'success_url': `${domain}/thanks?session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url': `${domain}/#pricing`,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': data.total * 100, // Convert to cents
    'line_items[0][price_data][product_data][name]': 'TeamPulse Analysis',
    'line_items[0][price_data][product_data][description]': `${data.members} Mitglieder, ${data.criteria} Kriterien`,
    'line_items[0][quantity]': 1,
    'customer_email': data.email,
    'metadata[company]': data.company,
    'metadata[members]': data.members,
    'metadata[criteria]': data.criteria,
    'invoice_creation[enabled]': 'true',
    'invoice_creation[invoice_data][metadata][company]': data.company,
    'invoice_creation[invoice_data][custom_fields][0][name]': 'Firma',
    'invoice_creation[invoice_data][custom_fields][0][value]': data.company
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    payload: Object.keys(payload).map(key => 
      `${key}=${encodeURIComponent(payload[key])}`
    ).join('&')
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const session = JSON.parse(response.getContentText());
    
    // Store checkout session
    storeCheckoutSession(session.id, data);
    
    return {
      success: true,
      url: session.url
    };
  } catch(e) {
    console.error('Stripe error:', e);
    return {error: e.toString()};
  }
}

function handleWebhook(data) {
  const webhookSecret = getConfig('STRIPE_WEBHOOK_SECRET');
  
  // In production, verify webhook signature
  // For MVP, process directly
  
  if (data.type === 'checkout.session.completed') {
    const session = data.data.object;
    
    // Create project for customer
    const projectData = {
      name: `${session.metadata.company} Team Analysis`,
      description: `Created from Stripe checkout ${session.id}`,
      estMembers: parseInt(session.metadata.members),
      numCriteria: parseInt(session.metadata.criteria)
    };
    
    const project = createProject(projectData);
    
    // Send confirmation email
    sendProjectCreatedEmail(session.customer_email, project.projectId, session.metadata.company);
    
    // Download and store invoice
    if (session.invoice) {
      storeInvoice(session.invoice, project.projectId);
    }
    
    return {success: true};
  }
  
  return {success: true, message: 'Webhook processed'};
}

function sendProjectCreatedEmail(email, projectId, company) {
  const domain = getConfig('DOMAIN');
  const subject = `TeamPulse - Ihr Projekt wurde erstellt`;
  
  const body = `Guten Tag,

vielen Dank für Ihre Bestellung! Ihr TeamPulse-Projekt für ${company} wurde erfolgreich erstellt.

Sie können jetzt mit der Analyse beginnen:
${domain}/admin.html#project=${projectId}

Nächste Schritte:
1. Melden Sie sich im Admin-Dashboard an
2. Laden Sie Teammitglieder ein
3. Erstellen Sie Ihre erste Umfrage

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr TeamPulse Team`;
  
  try {
    MailApp.sendEmail(email, subject, body);
  } catch(e) {
    console.error('Failed to send project created email:', e);
  }
}

function storeInvoice(invoiceId, projectId) {
  const stripeKey = getConfig('STRIPE_SK');
  const url = `https://api.stripe.com/v1/invoices/${invoiceId}`;
  
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${stripeKey}`
    }
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const invoice = JSON.parse(response.getContentText());
    
    if (invoice.invoice_pdf) {
      // Download PDF
      const pdfResponse = UrlFetchApp.fetch(invoice.invoice_pdf);
      const blob = pdfResponse.getBlob();
      blob.setName(`Invoice_${invoiceId}.pdf`);
      
      // Store in project folder
      const folder = DriveApp.getFoldersByName('Sociometry-Projects').next()
        .getFoldersByName(projectId).next();
      folder.createFile(blob);
      
      // Share with customer
      const file = folder.getFilesByName(blob.getName()).next();
      file.addViewer(invoice.customer_email);
    }
  } catch(e) {
    console.error('Failed to store invoice:', e);
  }
}

function storeCheckoutSession(sessionId, data) {
  // Store in properties for webhook processing
  const cache = CacheService.getScriptCache();
  cache.put(`checkout_${sessionId}`, JSON.stringify(data), 3600); // 1 hour
}

function sendInvoice(projectId) {
  // Implementation for manual invoice sending
  const spreadsheet = getProjectSpreadsheet(projectId);
  const settingsSheet = spreadsheet.getSheetByName('Settings');
  
  // Get project details
  const projectName = settingsSheet.getRange('B2').getValue();
  const created = settingsSheet.getRange('B4').getValue();
  
  // Generate simple invoice
  const invoiceHtml = `
    <h1>Rechnung</h1>
    <p>Projekt: ${projectName}</p>
    <p>Datum: ${new Date(created).toLocaleDateString('de-DE')}</p>
    <p>Leistung: TeamPulse Soziometrie-Analyse</p>
    <hr>
    <p>Gesamtbetrag: Nach Vereinbarung</p>
  `;
  
  const blob = Utilities.newBlob(invoiceHtml, 'text/html', 'invoice.html');
  
  // Store in project folder
  const folder = DriveApp.getFoldersByName('Sociometry-Projects').next()
    .getFoldersByName(projectId).next();
  folder.createFile(blob);
  
  return {success: true, message: 'Invoice generated'};
}

function getStripeCustomers() {
  const stripeKey = getConfig('STRIPE_SK');
  const url = 'https://api.stripe.com/v1/customers?limit=100';
  
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${stripeKey}`
    }
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    return data.data;
  } catch(e) {
    console.error('Failed to get customers:', e);
    return [];
  }
}

function createStripeProduct() {
  const stripeKey = getConfig('STRIPE_SK');
  const url = 'https://api.stripe.com/v1/products';
  
  const payload = {
    name: 'TeamPulse Soziometrie-Analyse',
    description: 'Wissenschaftliche Team-Analyse mit KI-gestützten Insights',
    metadata: {
      category: 'software'
    }
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    payload: Object.keys(payload).map(key => 
      `${key}=${encodeURIComponent(payload[key])}`
    ).join('&')
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText());
  } catch(e) {
    console.error('Failed to create product:', e);
    return null;
  }
}
```