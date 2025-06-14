```javascript
// analytics.gs

function calcMetrics(projectId) {
  const spreadsheet = getProjectSpreadsheet(projectId);
  const processedData = processResponses(spreadsheet);
  
  if (!processedData) {
    return {success: false, error: 'No responses to analyze'};
  }
  
  const metricsSheet = spreadsheet.getSheetByName('Metrics');
  const aiSheet = spreadsheet.getSheetByName('AI_Insights');
  
  // Clear old data
  if (metricsSheet.getLastRow() > 1) {
    metricsSheet.getRange(2, 1, metricsSheet.getLastRow() - 1, 5).clear();
  }
  
  // Calculate metrics for each survey
  const allMetrics = [];
  
  Object.keys(processedData).forEach(surveyId => {
    const data = processedData[surveyId];
    const metrics = calculateSociometricMetrics(data.sociometricData);
    
    // Add to metrics array
    allMetrics.push(['Response Count', data.responseCount, '→', 'N/A', new Date()]);
    allMetrics.push(['Avg Team Satisfaction', data.avgRatings[0], '↑', '3.5', new Date()]);
    allMetrics.push(['Network Density', metrics.density.toFixed(2), '→', '0.25', new Date()]);
    allMetrics.push(['Reciprocity', metrics.reciprocity.toFixed(2), '↑', '0.40', new Date()]);
    allMetrics.push(['Centralization', metrics.centralization.toFixed(2), '↓', '0.35', new Date()]);
    allMetrics.push(['Mental Health Index', data.avgMentalHealth, '→', '3.5', new Date()]);
    allMetrics.push(['Cliques Detected', metrics.cliques, '→', '2', new Date()]);
  });
  
  // Write metrics
  if (allMetrics.length > 0) {
    metricsSheet.getRange(2, 1, allMetrics.length, 5).setValues(allMetrics);
  }
  
  // Generate AI insights
  const insights = generateAIInsights(spreadsheet, processedData, allMetrics);
  
  // Write AI insights
  const insightRows = insights.map(insight => [
    new Date(),
    insight.type,
    insight.text,
    insight.priority,
    'New'
  ]);
  
  if (insightRows.length > 0) {
    const startRow = aiSheet.getLastRow() + 1;
    aiSheet.getRange(startRow, 1, insightRows.length, 5).setValues(insightRows);
  }
  
  // Update last calculated
  const settingsSheet = spreadsheet.getSheetByName('Settings');
  settingsSheet.getRange('B9').setValue(new Date().toISOString());
  
  // Update one-pager view
  updateOnePagerData(spreadsheet, processedData, allMetrics, insights);
  
  return {
    success: true,
    metricsCalculated: allMetrics.length,
    insightsGenerated: insights.length
  };
}

function calculateSociometricMetrics(sociometricData) {
  const { people, nominations } = sociometricData;
  const n = people.length;
  
  if (n === 0) {
    return {
      density: 0,
      reciprocity: 0,
      centralization: 0,
      cliques: 0
    };
  }
  
  // Create adjacency matrix
  const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
  const peopleIndex = {};
  people.forEach((person, i) => peopleIndex[person] = i);
  
  Object.keys(nominations).forEach(key => {
    const [from, to] = key.split('->');
    if (peopleIndex[from] !== undefined && peopleIndex[to] !== undefined) {
      matrix[peopleIndex[from]][peopleIndex[to]] = 1;
    }
  });
  
  // Calculate density
  const possibleConnections = n * (n - 1);
  const actualConnections = Object.keys(nominations).length;
  const density = possibleConnections > 0 ? actualConnections / possibleConnections : 0;
  
  // Calculate reciprocity
  let reciprocal = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (matrix[i][j] === 1 && matrix[j][i] === 1) {
        reciprocal += 2;
      }
    }
  }
  const reciprocity = actualConnections > 0 ? reciprocal / actualConnections : 0;
  
  // Calculate centralization (degree centrality)
  const degrees = people.map((person, i) => {
    let inDegree = 0;
    let outDegree = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        inDegree += matrix[j][i];
        outDegree += matrix[i][j];
      }
    }
    return inDegree + outDegree;
  });
  
  const maxDegree = Math.max(...degrees);
  const sumDiff = degrees.reduce((sum, d) => sum + (maxDegree - d), 0);
  const maxPossible = (n - 1) * (n - 1) * 2;
  const centralization = maxPossible > 0 ? sumDiff / maxPossible : 0;
  
  // Detect cliques (simplified - count triangles)
  let triangles = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        if (matrix[i][j] && matrix[j][k] && matrix[k][i]) {
          triangles++;
        }
      }
    }
  }
  
  return {
    density: density,
    reciprocity: reciprocity,
    centralization: centralization,
    cliques: triangles
  };
}

function generateAIInsights(spreadsheet, processedData, metrics) {
  const metricsText = metrics.map(m => `${m[0]}: ${m[1]}`).join('\n');
  
  const prompt = `Analyze these team metrics and provide insights:

${metricsText}

Provide insights in these categories:
1. Quick Wins (2-3 immediate actions)
2. Risk Areas (2-3 concerns)
3. 90-Day Strategic Plan (3-4 actions)

Return as JSON array with structure: [{type: "Quick Win|Risk|Strategic", text: "...", priority: "High|Medium|Low"}]`;
  
  const response = askGPT(prompt);
  
  try {
    return JSON.parse(response);
  } catch(e) {
    // Fallback insights
    return [
      {
        type: "Quick Win",
        text: "Organisieren Sie ein Team-Event zur Stärkung der Beziehungen zwischen isolierten Mitgliedern",
        priority: "High"
      },
      {
        type: "Risk",
        text: "Die Netzwerkdichte liegt unter dem Benchmark - verstärkte Silobildung möglich",
        priority: "High"
      },
      {
        type: "Strategic",
        text: "Implementieren Sie regelmäßige Cross-Team Meetings zur Verbesserung der Kollaboration",
        priority: "Medium"
      }
    ];
  }
}

function askGPT(prompt) {
  const apiKey = getConfig('OPENAI_KEY');
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert in organizational psychology and team dynamics analysis.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 1000
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    return data.choices[0].message.content;
  } catch(e) {
    console.error('GPT API error:', e);
    throw e;
  }
}

function updateOnePagerData(spreadsheet, processedData, metrics, insights) {
  const onePagerSheet = spreadsheet.getSheetByName('OnePager_View');
  
  // Clear old data
  if (onePagerSheet.getLastRow() > 1) {
    onePagerSheet.getRange(2, 1, onePagerSheet.getLastRow() - 1, 2).clear();
  }
  
  // Prepare one-pager data
  const sections = [
    ['NetworkData', JSON.stringify(processedData)],
    ['Metrics', JSON.stringify(metrics)],
    ['Insights', JSON.stringify(insights)],
    ['LastUpdated', new Date().toISOString()]
  ];
  
  onePagerSheet.getRange(2, 1, sections.length, 2).setValues(sections);
}

function serveOnePager(projectId, surveyId) {
  const spreadsheet = getProjectSpreadsheet(projectId);
  const onePagerSheet = spreadsheet.getSheetByName('OnePager_View');
  const projectName = spreadsheet.getSheetByName('Settings').getRange('B2').getValue();
  
  // Get cached data
  const cache = CacheService.getScriptCache();
  const cacheKey = `onepager_${projectId}_${surveyId}`;
  const cached = cache.get(cacheKey);
  
  if (cached) {
    return HtmlService.createHtmlOutput(cached);
  }
  
  // Generate new one-pager
  const html = generateOnePagerHTML(spreadsheet, projectName);
  
  // Cache for 6 hours
  cache.put(cacheKey, html, 21600);
  
  return HtmlService.createHtmlOutput(html);
}

function generateOnePagerHTML(spreadsheet, projectName) {
  // This would generate a complete one-pager with D3 visualizations
  // For brevity, returning a simple template
  return `<!DOCTYPE html>
<html>
<head>
    <title>${projectName} - Team Analysis</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto p-8">
        <h1 class="text-3xl font-bold mb-8">${projectName} - Team Analysis Report</h1>
        <div id="network-viz"></div>
        <div id="metrics-charts"></div>
        <div id="insights"></div>
    </div>
</body>
</html>`;
}
```