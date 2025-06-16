// config.gs

function getConfig(key) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(key);
}

function setConfig(key, value) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(key, value);
}

function getAllConfig() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperties();
}

function updateConfig(configs) {
  const props = PropertiesService.getScriptProperties();
  Object.keys(configs).forEach(key => {
    props.setProperty(key, configs[key]);
  });
}

function deleteConfig(key) {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(key);
}

function resetConfig() {
  const props = PropertiesService.getScriptProperties();
  props.deleteAllProperties();
  initProperties();
}

function showSettings() {
  const ui = SpreadsheetApp.getUi();
  const html = HtmlService.createHtmlOutput(getSettingsHTML())
    .setWidth(600)
    .setHeight(500);
  ui.showModalDialog(html, 'TeamPulse Settings');
}

function getSettingsHTML() {
  const config = getAllConfig();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .form-group { margin-bottom: 15px; }
    label { display: block; font-weight: bold; margin-bottom: 5px; }
    input, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
    button { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #45a049; }
    .warning { background: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
    .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 10px; border-radius: 4px; display: none; }
  </style>
</head>
<body>
  <h2>TeamPulse Configuration</h2>
  
  <div class="warning">
    ⚠️ Änderungen an diesen Einstellungen können die Funktionalität beeinträchtigen.
  </div>
  
  <div class="success" id="successMsg">
    ✓ Einstellungen erfolgreich gespeichert!
  </div>
  
  <form id="settingsForm">
    <div class="form-group">
      <label for="DOMAIN">Domain URL</label>
      <input type="url" id="DOMAIN" value="${config.DOMAIN || ''}" required>
    </div>
    
    <div class="form-group">
      <label for="OPENAI_KEY">OpenAI API Key</label>
      <input type="password" id="OPENAI_KEY" value="${config.OPENAI_KEY || ''}" 
             placeholder="sk-...">
    </div>
    
    <div class="form-group">
      <label for="STRIPE_SK">Stripe Secret Key</label>
      <input type="password" id="STRIPE_SK" value="${config.STRIPE_SK || ''}" 
             placeholder="sk_live_...">
    </div>
    
    <div class="form-group">
      <label for="STRIPE_WEBHOOK_SECRET">Stripe Webhook Secret</label>
      <input type="password" id="STRIPE_WEBHOOK_SECRET" 
             value="${config.STRIPE_WEBHOOK_SECRET || ''}" 
             placeholder="whsec_...">
    </div>
    
    <div class="form-group">
      <label for="GDPR_TXT">DSGVO Hinweistext</label>
      <textarea id="GDPR_TXT" rows="3">${config.GDPR_TXT || ''}</textarea>
    </div>
    
    <div class="form-group">
      <label for="HMAC_SECRET">HMAC Secret (auto-generated)</label>
      <input type="text" id="HMAC_SECRET" value="${config.HMAC_SECRET || ''}" readonly>
    </div>
    
    <button type="submit">Einstellungen speichern</button>
    <button type="button" onclick="testConnections()">Verbindungen testen</button>
  </form>
  
  <script>
    document.getElementById('settingsForm').addEventListener('submit', function(e) {
      e.preventDefault();
      
      const configs = {
        DOMAIN: document.getElementById('DOMAIN').value,
        OPENAI_KEY: document.getElementById('OPENAI_KEY').value,
        STRIPE_SK: document.getElementById('STRIPE_SK').value,
        STRIPE_WEBHOOK_SECRET: document.getElementById('STRIPE_WEBHOOK_SECRET').value,
        GDPR_TXT: document.getElementById('GDPR_TXT').value
      };
      
      google.script.run
        .withSuccessHandler(() => {
          document.getElementById('successMsg').style.display = 'block';
          setTimeout(() => {
            document.getElementById('successMsg').style.display = 'none';
          }, 3000);
        })
        .updateConfig(configs);
    });
    
    function testConnections() {
      google.script.run
        .withSuccessHandler(results => {
          alert('Test Results:\\n' + JSON.stringify(results, null, 2));
        })
        .testConnections();
    }
  </script>
</body>
</html>
  `;
}

function testConnections() {
  const results = {
    openai: false,
    stripe: false,
    email: false
  };
  
  // Test OpenAI
  try {
    const response = askGPT('Test connection');
    results.openai = response && response.length > 0;
  } catch(e) {
    results.openai_error = e.toString();
  }
  
  // Test Stripe
  try {
    const customers = getStripeCustomers();
    results.stripe = Array.isArray(customers);
  } catch(e) {
    results.stripe_error = e.toString();
  }
  
  // Test Email
  try {
    const quota = MailApp.getRemainingDailyQuota();
    results.email = quota > 0;
    results.email_quota = quota;
  } catch(e) {
    results.email_error = e.toString();
  }
  
  return results;
}

function getEnvironment() {
  return {
    scriptId: ScriptApp.getScriptId(),
    deploymentId: ScriptApp.getService().getUrl(),
    userEmail: Session.getActiveUser().getEmail(),
    timezone: Session.getScriptTimeZone(),
    locale: Session.getActiveUserLocale()
  };
}

function setupTriggers() {
  // Remove existing triggers
  ScriptApp.getProjectTriggers().forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  
  // Daily cleanup at 2 AM
  ScriptApp.newTrigger('cleanupOldData')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .create();
  
  // Check reminders every 6 hours
  ScriptApp.newTrigger('checkAllReminders')
    .timeBased()
    .everyHours(6)
    .create();
}

function checkAllReminders() {
  const index = getOrCreateProjectsIndex();
  const sheet = index.getSheetByName('Projects');
  const projects = sheet.getDataRange().getValues();
  
  for (let i = 1; i < projects.length; i++) {
    if (projects[i][4] === 'active') {
      try {
        const projectId = projects[i][0];
        const spreadsheet = getProjectSpreadsheet(projectId);
        const surveys = listSurveys(projectId);
        
        surveys.forEach(survey => {
          const responseRate = survey.sent > 0 ? survey.responded / survey.sent : 0;
          const surveyAge = (new Date() - new Date(survey.created)) / (1000 * 60 * 60);
          
          if (surveyAge >= 48 && surveyAge < 72 && responseRate < 0.8) {
            sendReminders(projectId, survey.id);
          }
        });
      } catch(e) {
        console.error('Reminder check failed for project:', projects[i][0], e);
      }
    }
  }
}

function exportConfig() {
  const config = getAllConfig();
  const blob = Utilities.newBlob(
    JSON.stringify(config, null, 2),
    'application/json',
    'teampulse_config.json'
  );
  return blob;
}

function importConfig(jsonString) {
  try {
    const config = JSON.parse(jsonString);
    updateConfig(config);
    return {success: true};
  } catch(e) {
    return {success: false, error: e.toString()};
  }
}
