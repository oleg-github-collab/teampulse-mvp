```javascript
// Code.gs

function doGet(e) {
  const action = e.parameter.action || 'default';
  
  try {
    switch(action) {
      case 'survey':
        return serveSurveyPage(e.parameter.pid, e.parameter.sid, e.parameter.token);
      case 'onepager':
        return serveOnePager(e.parameter.pid, e.parameter.sid);
      case 'getProject':
        return jsonResponse(getProjectDetails(e.parameter.pid));
      case 'listProjects':
        return jsonResponse(listProjects());
      case 'listSurveys':
        return jsonResponse(listSurveys(e.parameter.pid));
      case 'getUser':
        return jsonResponse({email: Session.getActiveUser().getEmail()});
      default:
        return jsonResponse({error: 'Unknown action'});
    }
  } catch(error) {
    return jsonResponse({error: error.toString()});
  }
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  
  try {
    switch(data.action) {
      case 'createProject':
        return jsonResponse(createProject(data));
      case 'createSurvey':
        return jsonResponse(createSurvey(data));
      case 'submitSurvey':
        return jsonResponse(onSurveySubmit(data));
      case 'calcMetrics':
        return jsonResponse(calcMetrics(data.pid));
      case 'sendReminders':
        return jsonResponse(sendReminders(data.pid, data.sid));
      case 'checkout':
        return jsonResponse(createCheckout(data));
      case 'stripeWebhook':
        return jsonResponse(handleWebhook(data));
      default:
        return jsonResponse({error: 'Unknown action'});
    }
  } catch(error) {
    return jsonResponse({error: error.toString()});
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TeamPulse')
    .addItem('Calculate Metrics', 'calcMetricsMenu')
    .addItem('Generate One-Pager', 'generateOnePagerMenu')
    .addItem('Send Reminders', 'sendRemindersMenu')
    .addSeparator()
    .addItem('Settings', 'showSettings')
    .addToUi();
}

function calcMetricsMenu() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectId = ss.getId();
  calcMetrics(projectId);
  SpreadsheetApp.getUi().alert('Metrics calculated successfully!');
}

// Initialize property service with defaults
function initProperties() {
  const props = PropertiesService.getScriptProperties();
  const defaults = {
    OPENAI_KEY: '',
    STRIPE_SK: '',
    STRIPE_WEBHOOK_SECRET: '',
    DOMAIN: 'https://yourdomain.com',
    HMAC_SECRET: Utilities.getUuid(),
    GDPR_TXT: 'Ihre Daten werden gemäß DSGVO verarbeitet und nach 90 Tagen gelöscht.'
  };
  
  Object.keys(defaults).forEach(key => {
    if (!props.getProperty(key)) {
      props.setProperty(key, defaults[key]);
    }
  });
}

// Run once to set up
function setup() {
  initProperties();
  createProjectsFolder();
}
```