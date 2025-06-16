// surveys.gs

function createSurvey(data) {
  const spreadsheet = getProjectSpreadsheet(data.pid);
  const surveyId = Utilities.getUuid();
  
  // Generate questions using AI
  const aiResponse = generateSurveyQuestions(data.title, data.description, spreadsheet);
  
  // Save survey metadata
  const settingsSheet = spreadsheet.getSheetByName('Settings');
  let surveys = [];
  try {
    surveys = JSON.parse(settingsSheet.getRange('B11').getValue() || '[]');
  } catch(e) {}
  
  surveys.push({
    id: surveyId,
    title: data.title,
    description: data.description,
    created: new Date().toISOString(),
    questions: aiResponse.questions,
    criteria: aiResponse.criteria,
    mentalHealthQuestions: aiResponse.mentalHealthQuestions
  });
  
  settingsSheet.getRange('B11').setValue(JSON.stringify(surveys));
  settingsSheet.getRange('B7').setValue(surveyId); // LastSurveyID
  
  // Add emails if provided
  if (data.emails && data.emails.length > 0) {
    const emailsSheet = spreadsheet.getSheetByName('Emails');
    const timestamp = new Date().toISOString();
    const emailData = data.emails.map(email => [email, '', '', '', timestamp]);
    emailsSheet.getRange(emailsSheet.getLastRow() + 1, 1, emailData.length, 5).setValues(emailData);
  }
  
  // Send emails
  const surveyUrl = generateSurveyUrl(data.pid, surveyId);
  if (data.emails && data.emails.length > 0) {
    bulkSendEmails(data.emails, data.title, surveyUrl);
  }
  
  // Update project index
  updateProjectSurveyCount(data.pid);
  
  return {
    success: true,
    surveyId: surveyId,
    surveyUrl: surveyUrl,
    questionsGenerated: aiResponse.questions.length
  };
}

function generateSurveyQuestions(title, description, spreadsheet) {
  const prompt = `Create a sociometric survey for a team with the following context:
Title: ${title}
Description: ${description}

Generate:
1. 5 rating questions (1-5 scale) for team dynamics
2. 3 sociometric criteria (for peer nominations)
3. 2 mental health indicator questions

Return as JSON: {questions: [], criteria: [], mentalHealthQuestions: []}`;
  
  const response = askGPT(prompt);
  
  try {
    return JSON.parse(response);
  } catch(e) {
    // Fallback if AI fails
    return {
      questions: [
        "Wie gut funktioniert die Kommunikation in unserem Team?",
        "Wie klar sind die Rollen und Verantwortlichkeiten definiert?",
        "Wie unterstützend ist die Teamkultur?",
        "Wie effektiv arbeiten wir zusammen?",
        "Wie zufrieden sind Sie mit der Teamleistung?"
      ],
      criteria: [
        "Mit wem arbeiten Sie am liebsten zusammen?",
        "Wer trägt am meisten zum Teamerfolg bei?",
        "An wen wenden Sie sich bei Problemen?"
      ],
      mentalHealthQuestions: [
        "Wie gestresst fühlen Sie sich bei der Arbeit? (1-5)",
        "Wie energiegeladen fühlen Sie sich normalerweise? (1-5)"
      ]
    };
  }
}

function listSurveys(projectId) {
  const spreadsheet = getProjectSpreadsheet(projectId);
  const settingsSheet = spreadsheet.getSheetByName('Settings');
  const responsesSheet = spreadsheet.getSheetByName('Responses');
  const emailsSheet = spreadsheet.getSheetByName('Emails');
  
  let surveys = [];
  try {
    surveys = JSON.parse(settingsSheet.getRange('B11').getValue() || '[]');
  } catch(e) {}
  
  // Count responses per survey
  const responses = responsesSheet.getDataRange().getValues();
  const totalEmails = Math.max(0, emailsSheet.getLastRow() - 1);
  
  return surveys.map(survey => {
    const surveyResponses = responses.filter(r => r[1] === survey.id).length;
    return {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      created: survey.created,
      sent: totalEmails,
      responded: surveyResponses
    };
  });
}

function bulkSendEmails(emails, surveyTitle, surveyUrl) {
  const subject = `TeamPulse Umfrage: ${surveyTitle}`;
  const gdprText = getConfig('GDPR_TXT');
  
  emails.forEach(email => {
    const personalUrl = surveyUrl + '&email=' + encodeURIComponent(email);
    const body = `Guten Tag,

Sie wurden eingeladen, an der TeamPulse-Umfrage "${surveyTitle}" teilzunehmen.

Bitte nehmen Sie sich 10-15 Minuten Zeit, um die Fragen zu beantworten:
${personalUrl}

Die Umfrage ist anonym und Ihre Antworten werden vertraulich behandelt.
${gdprText}

Vielen Dank für Ihre Teilnahme!

Mit freundlichen Grüßen
Ihr TeamPulse Team`;
    
    try {
      MailApp.sendEmail(email, subject, body);
    } catch(e) {
      console.error('Failed to send email to:', email, e);
    }
  });
}

function sendReminders(projectId, surveyId) {
  const spreadsheet = getProjectSpreadsheet(projectId);
  const emailsSheet = spreadsheet.getSheetByName('Emails');
  const responsesSheet = spreadsheet.getSheetByName('Responses');
  
  // Get all emails
  const emails = emailsSheet.getDataRange().getValues().slice(1).map(row => row[0]);
  
  // Get responded emails
  const responses = responsesSheet.getDataRange().getValues().slice(1);
  const respondedEmails = responses
    .filter(r => r[1] === surveyId)
    .map(r => r[2]);
  
  // Find non-responders
  const nonResponders = emails.filter(email => !respondedEmails.includes(email));
  
  if (nonResponders.length > 0) {
    const surveyUrl = generateSurveyUrl(projectId, surveyId);
    const surveyTitle = getSurveyTitle(spreadsheet, surveyId);
    
    nonResponders.forEach(email => {
      const subject = `Erinnerung: TeamPulse Umfrage ${surveyTitle}`;
      const body = `Guten Tag,

dies ist eine freundliche Erinnerung an die TeamPulse-Umfrage "${surveyTitle}".

Ihre Teilnahme ist wichtig für aussagekräftige Ergebnisse.

Link zur Umfrage:
${surveyUrl}&email=${encodeURIComponent(email)}

Die Umfrage dauert nur 10-15 Minuten.

Vielen Dank!

Mit freundlichen Grüßen
Ihr TeamPulse Team`;
      
      try {
        MailApp.sendEmail(email, subject, body);
      } catch(e) {
        console.error('Failed to send reminder to:', email, e);
      }
    });
  }
  
  return {
    success: true,
    sent: nonResponders.length
  };
}

function generateSurveyUrl(projectId, surveyId) {
  const domain = getConfig('DOMAIN');
  const token = signURL(projectId + surveyId);
  return `${domain}/api?action=survey&pid=${projectId}&sid=${surveyId}&token=${token}`;
}

function getSurveyTitle(spreadsheet, surveyId) {
  const settingsSheet = spreadsheet.getSheetByName('Settings');
  try {
    const surveys = JSON.parse(settingsSheet.getRange('B11').getValue() || '[]');
    const survey = surveys.find(s => s.id === surveyId);
    return survey ? survey.title : 'Unknown Survey';
  } catch(e) {
    return 'Unknown Survey';
  }
}

function updateProjectSurveyCount(projectId) {
  const index = getOrCreateProjectsIndex();
  const sheet = index.getSheetByName('Projects');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === projectId) {
      const currentCount = data[i][5] || 0;
      sheet.getRange(i + 1, 6).setValue(currentCount + 1);
      break;
    }
  }
}
