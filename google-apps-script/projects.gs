```javascript
// projects.gs

function createProject(data) {
  const projectId = Utilities.getUuid();
  const folder = createProjectFolder(projectId);
  const spreadsheet = createProjectSpreadsheet(projectId, data.name, folder);
  
  // Initialize sheets
  initializeSheets(spreadsheet);
  
  // Save project metadata
  const settingsSheet = spreadsheet.getSheetByName('Settings');
  settingsSheet.getRange('B1:B6').setValues([
    [projectId],
    [data.name],
    [data.description || ''],
    [new Date().toISOString()],
    [data.estMembers || 10],
    [data.numCriteria || 3]
  ]);
  
  // Save to projects index
  saveProjectToIndex(projectId, data.name, spreadsheet.getUrl());
  
  return {
    success: true,
    projectId: projectId,
    spreadsheetUrl: spreadsheet.getUrl()
  };
}

function createProjectFolder(projectId) {
  const rootFolder = DriveApp.getFoldersByName('Sociometry-Projects').hasNext() 
    ? DriveApp.getFoldersByName('Sociometry-Projects').next()
    : DriveApp.createFolder('Sociometry-Projects');
    
  return rootFolder.createFolder(projectId);
}

function createProjectSpreadsheet(projectId, name, folder) {
  const template = SpreadsheetApp.create(`TeamPulse - ${name}`);
  const file = DriveApp.getFileById(template.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  return template;
}

function initializeSheets(spreadsheet) {
  const sheets = [
    {name: 'Settings', headers: ['Property', 'Value']},
    {name: 'Emails', headers: ['Email', 'Name', 'Position', 'Department', 'Added']},
    {name: 'Responses', headers: ['Timestamp', 'SurveyID', 'Email', 'Name', 'Position', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Comments', 'Token']},
    {name: 'Interviews', headers: ['Date', 'Participant', 'Interviewer', 'Key Points', 'Action Items']},
    {name: 'Metrics', headers: ['Metric', 'Value', 'Trend', 'Benchmark', 'Updated']},
    {name: 'AI_Insights', headers: ['Date', 'Type', 'Insight', 'Priority', 'Status']},
    {name: 'OnePager_View', headers: ['Section', 'Content']}
  ];
  
  // Remove default sheet
  const defaultSheet = spreadsheet.getSheets()[0];
  
  sheets.forEach((sheetConfig, index) => {
    const sheet = spreadsheet.insertSheet(sheetConfig.name, index);
    sheet.getRange(1, 1, 1, sheetConfig.headers.length).setValues([sheetConfig.headers]);
    sheet.getRange(1, 1, 1, sheetConfig.headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });
  
  spreadsheet.deleteSheet(defaultSheet);
  
  // Add settings structure
  const settingsSheet = spreadsheet.getSheetByName('Settings');
  settingsSheet.getRange('A1:A10').setValues([
    ['ProjectID'], ['Name'], ['Description'], ['Created'], ['EstMembers'], 
    ['NumCriteria'], ['LastSurveyID'], ['TotalResponses'], ['LastCalculated'], ['Status']
  ]);
}

function listProjects() {
  const email = Session.getActiveUser().getEmail();
  const projectsIndex = getOrCreateProjectsIndex();
  const sheet = projectsIndex.getSheetByName('Projects');
  const data = sheet.getDataRange().getValues();
  
  const projects = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === email) { // Owner column
      projects.push({
        id: data[i][0],
        name: data[i][1],
        created: data[i][3],
        status: data[i][4] || 'active',
        surveyCount: data[i][5] || 0,
        url: data[i][6]
      });
    }
  }
  
  return projects;
}

function getProjectDetails(projectId) {
  const spreadsheet = getProjectSpreadsheet(projectId);
  const settingsSheet = spreadsheet.getSheetByName('Settings');
  const metricsSheet = spreadsheet.getSheetByName('Metrics');
  const responsesSheet = spreadsheet.getSheetByName('Responses');
  
  // Get settings
  const settings = settingsSheet.getRange('B1:B10').getValues();
  
  // Get response stats
  const responses = responsesSheet.getDataRange().getValues();
  const totalResponses = responses.length - 1; // Minus header
  
  // Get metrics if calculated
  const metrics = {};
  if (metricsSheet.getLastRow() > 1) {
    const metricsData = metricsSheet.getDataRange().getValues();
    for (let i = 1; i < metricsData.length; i++) {
      metrics[metricsData[i][0]] = metricsData[i][1];
    }
  }
  
  return {
    id: projectId,
    name: settings[1][0],
    description: settings[2][0],
    created: settings[3][0],
    totalResponses: totalResponses,
    responseRate: calculateResponseRate(spreadsheet),
    avgMentalHealth: metrics['Mental Health Index'] || null,
    networkDensity: metrics['Network Density'] || null
  };
}

function getProjectSpreadsheet(projectId) {
  const folder = DriveApp.getFoldersByName('Sociometry-Projects').next()
    .getFoldersByName(projectId).next();
  const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  throw new Error('Project spreadsheet not found');
}

function saveProjectToIndex(projectId, name, url) {
  const index = getOrCreateProjectsIndex();
  const sheet = index.getSheetByName('Projects');
  sheet.appendRow([
    projectId,
    name,
    Session.getActiveUser().getEmail(),
    new Date().toISOString(),
    'active',
    0,
    url
  ]);
}

function getOrCreateProjectsIndex() {
  const files = DriveApp.getFilesByName('TeamPulse_Projects_Index');
  
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  
  // Create index
  const index = SpreadsheetApp.create('TeamPulse_Projects_Index');
  const sheet = index.getActiveSheet();
  sheet.setName('Projects');
  sheet.getRange(1, 1, 1, 7).setValues([
    ['ProjectID', 'Name', 'Owner', 'Created', 'Status', 'SurveyCount', 'URL']
  ]);
  sheet.setFrozenRows(1);
  
  return index;
}

function calculateResponseRate(spreadsheet) {
  const emailsSheet = spreadsheet.getSheetByName('Emails');
  const responsesSheet = spreadsheet.getSheetByName('Responses');
  
  const totalEmails = Math.max(0, emailsSheet.getLastRow() - 1);
  const totalResponses = Math.max(0, responsesSheet.getLastRow() - 1);
  
  return totalEmails > 0 ? Math.round((totalResponses / totalEmails) * 100) : 0;
}
```