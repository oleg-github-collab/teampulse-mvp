// responses.gs

function onSurveySubmit(data) {
  const spreadsheet = getProjectSpreadsheet(data.projectId);
  const responsesSheet = spreadsheet.getSheetByName('Responses');
  const timestamp = new Date().toISOString();
  const token = Utilities.getUuid();
  
  // Prepare row data
  const row = [
    timestamp,
    data.surveyId,
    data.email,
    data.name,
    data.position,
    ...data.ratings, // Q1-Q5
    data.comments,
    token
  ];
  
  // Add sociometric data (stored as JSON in additional columns)
  data.criteria.forEach(criterion => {
    row.push(JSON.stringify(criterion));
  });
  
  // Add mental health data
  data.mentalHealth.forEach(score => {
    row.push(score);
  });
  
  // Append to sheet
  responsesSheet.appendRow(row);
  
  // Update response count
  updateResponseCount(spreadsheet);
  
  // Check if reminders needed
  checkReminderTrigger(spreadsheet, data.surveyId);
  
  return {
    success: true,
    message: 'Response recorded successfully'
  };
}

function updateResponseCount(spreadsheet) {
  const settingsSheet = spreadsheet.getSheetByName('Settings');
  const responsesSheet = spreadsheet.getSheetByName('Responses');
  const count = Math.max(0, responsesSheet.getLastRow() - 1);
  settingsSheet.getRange('B8').setValue(count);
}

function checkReminderTrigger(spreadsheet, surveyId) {
  const emailsSheet = spreadsheet.getSheetByName('Emails');
  const responsesSheet = spreadsheet.getSheetByName('Responses');
  
  const totalEmails = Math.max(0, emailsSheet.getLastRow() - 1);
  const responses = responsesSheet.getDataRange().getValues().slice(1);
  const surveyResponses = responses.filter(r => r[1] === surveyId).length;
  
  const responseRate = totalEmails > 0 ? (surveyResponses / totalEmails) : 0;
  
  // If less than 80% after 48h, schedule reminder
  const survey = getSurveyData(spreadsheet, surveyId);
  if (survey) {
    const surveyAge = (new Date() - new Date(survey.created)) / (1000 * 60 * 60); // hours
    if (surveyAge >= 48 && responseRate < 0.8) {
      // In production, this would create a time-based trigger
      console.log('Reminder needed for survey:', surveyId);
    }
  }
}

function processResponses(spreadsheet) {
  const responsesSheet = spreadsheet.getSheetByName('Responses');
  const data = responsesSheet.getDataRange().getValues();
  
  if (data.length <= 1) return null;
  
  const headers = data[0];
  const responses = data.slice(1);
  
  // Group by survey
  const bySurvey = {};
  responses.forEach(row => {
    const surveyId = row[1];
    if (!bySurvey[surveyId]) {
      bySurvey[surveyId] = [];
    }
    bySurvey[surveyId].push(row);
  });
  
  // Calculate aggregates
  const results = {};
  
  Object.keys(bySurvey).forEach(surveyId => {
    const surveyResponses = bySurvey[surveyId];
    
    // Average ratings (Q1-Q5)
    const ratings = [0, 0, 0, 0, 0];
    surveyResponses.forEach(row => {
      for (let i = 5; i < 10; i++) {
        ratings[i - 5] += parseInt(row[i] || 0);
      }
    });
    
    const avgRatings = ratings.map(sum => 
      surveyResponses.length > 0 ? (sum / surveyResponses.length).toFixed(2) : 0
    );
    
    // Sociometric matrix
    const sociometricData = extractSociometricData(surveyResponses);
    
    // Mental health average
    const mentalHealthScores = [];
    surveyResponses.forEach(row => {
      // Assuming mental health data starts at column 15
      for (let i = 15; i < row.length; i++) {
        if (row[i] && !isNaN(row[i])) {
          mentalHealthScores.push(parseInt(row[i]));
        }
      }
    });
    
    const avgMentalHealth = mentalHealthScores.length > 0 
      ? (mentalHealthScores.reduce((a, b) => a + b, 0) / mentalHealthScores.length).toFixed(2)
      : 0;
    
    results[surveyId] = {
      responseCount: surveyResponses.length,
      avgRatings: avgRatings,
      sociometricData: sociometricData,
      avgMentalHealth: avgMentalHealth
    };
  });
  
  return results;
}

function extractSociometricData(responses) {
  const nominations = {};
  const people = new Set();
  
  responses.forEach(row => {
    const nominator = row[3]; // Name column
    people.add(nominator);
    
    // Process criteria columns (assuming they start at column 11)
    for (let i = 11; i < 14; i++) {
      if (row[i]) {
        try {
          const nominees = JSON.parse(row[i]);
          nominees.forEach(nominee => {
            people.add(nominee);
            const key = `${nominator}->${nominee}`;
            nominations[key] = (nominations[key] || 0) + 1;
          });
        } catch(e) {}
      }
    }
  });
  
  return {
    people: Array.from(people),
    nominations: nominations
  };
}

function exportResponses(projectId, format = 'csv') {
  const spreadsheet = getProjectSpreadsheet(projectId);
  const responsesSheet = spreadsheet.getSheetByName('Responses');
  const data = responsesSheet.getDataRange().getValues();
  
  if (format === 'csv') {
    const csv = data.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = Utilities.newBlob(csv, 'text/csv', 'responses.csv');
    return blob;
  }
  
  // Add other formats as needed
  return null;
}
