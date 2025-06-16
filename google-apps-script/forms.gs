// forms.gs

function serveSurveyPage(projectId, surveyId, token) {
  // Verify token
  if (!verifyURL(projectId + surveyId, token)) {
    return HtmlService.createHtmlOutput('Invalid or expired link');
  }
  
  const spreadsheet = getProjectSpreadsheet(projectId);
  const survey = getSurveyData(spreadsheet, surveyId);
  
  if (!survey) {
    return HtmlService.createHtmlOutput('Survey not found');
  }
  
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${survey.title} - TeamPulse Survey</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .glass-panel {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
    </style>
</head>
<body class="bg-gray-900 text-white min-h-screen">
    <div class="container mx-auto px-4 py-8 max-w-2xl">
        <div class="glass-panel p-8">
            <h1 class="text-3xl font-bold mb-2">${survey.title}</h1>
            <p class="text-gray-300 mb-8">${survey.description}</p>
            
            <form id="surveyForm" onsubmit="submitSurvey(event)">
                <input type="hidden" id="projectId" value="${projectId}">
                <input type="hidden" id="surveyId" value="${surveyId}">
                
                <!-- Personal Info -->
                <div class="mb-8">
                    <h2 class="text-xl font-bold mb-4">Persönliche Angaben</h2>
                    <div class="space-y-4">
                        <input type="text" id="name" placeholder="Name" required 
                               class="w-full p-3 rounded bg-gray-800 border border-gray-700">
                        <input type="email" id="email" placeholder="E-Mail" required 
                               class="w-full p-3 rounded bg-gray-800 border border-gray-700">
                        <input type="text" id="position" placeholder="Position" 
                               class="w-full p-3 rounded bg-gray-800 border border-gray-700">
                    </div>
                </div>
                
                <!-- Rating Questions -->
                <div class="mb-8">
                    <h2 class="text-xl font-bold mb-4">Bewertungsfragen</h2>
                    <div class="space-y-6">
                        ${survey.questions.map((q, i) => `
                            <div>
                                <label class="block mb-2">${i + 1}. ${q}</label>
                                <div class="flex justify-between">
                                    ${[1,2,3,4,5].map(val => `
                                        <label class="cursor-pointer">
                                            <input type="radio" name="q${i}" value="${val}" required 
                                                   class="sr-only peer">
                                            <div class="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center peer-checked:bg-blue-600 hover:bg-gray-600">
                                                ${val}
                                            </div>
                                        </label>
                                    `).join('')}
                                </div>
                                <div class="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>Trifft nicht zu</span>
                                    <span>Trifft voll zu</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Sociometric Questions -->
                <div class="mb-8">
                    <h2 class="text-xl font-bold mb-4">Team-Beziehungen</h2>
                    <p class="text-sm text-gray-400 mb-4">Bitte wählen Sie bis zu 3 Kollegen für jede Frage.</p>
                    <div class="space-y-6">
                        ${survey.criteria.map((c, i) => `
                            <div>
                                <label class="block mb-2">${c}</label>
                                <select id="criteria${i}" multiple size="5" 
                                        class="w-full p-2 rounded bg-gray-800 border border-gray-700">
                                    ${getTeamMemberOptions()}
                                </select>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Mental Health Questions -->
                <div class="mb-8">
                    <h2 class="text-xl font-bold mb-4">Wohlbefinden</h2>
                    <div class="space-y-6">
                        ${survey.mentalHealthQuestions.map((q, i) => `
                            <div>
                                <label class="block mb-2">${q}</label>
                                <input type="range" id="mental${i}" min="1" max="5" value="3" 
                                       class="w-full">
                                <div class="flex justify-between text-xs text-gray-400">
                                    <span>Niedrig</span>
                                    <span>Mittel</span>
                                    <span>Hoch</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Comments -->
                <div class="mb-8">
                    <label class="block mb-2">Weitere Anmerkungen (optional)</label>
                    <textarea id="comments" rows="4" 
                              class="w-full p-3 rounded bg-gray-800 border border-gray-700"></textarea>
                </div>
                
                <!-- Submit -->
                <button type="submit" id="submitBtn" 
                        class="w-full bg-blue-600 py-3 rounded font-bold hover:bg-blue-700">
                    Umfrage abschicken
                </button>
            </form>
            
            <p class="text-xs text-gray-400 mt-6 text-center">
                ${getConfig('GDPR_TXT')}
            </p>
        </div>
    </div>
    
    <script>
        async function submitSurvey(event) {
            event.preventDefault();
            
            const btn = document.getElementById('submitBtn');
            btn.disabled = true;
            btn.textContent = 'Wird gesendet...';
            
            const formData = {
                action: 'submitSurvey',
                projectId: document.getElementById('projectId').value,
                surveyId: document.getElementById('surveyId').value,
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                position: document.getElementById('position').value,
                ratings: ${JSON.stringify(survey.questions.map((_, i) => `q${i}`))}.map(q => 
                    document.querySelector(\`input[name="\${q}"]:checked\`)?.value || ''
                ),
                criteria: ${JSON.stringify(survey.criteria.map((_, i) => `criteria${i}`))}.map(c => 
                    Array.from(document.getElementById(c).selectedOptions).map(o => o.value)
                ),
                mentalHealth: ${JSON.stringify(survey.mentalHealthQuestions.map((_, i) => `mental${i}`))}.map(m => 
                    document.getElementById(m).value
                ),
                comments: document.getElementById('comments').value
            };
            
            try {
                const response = await fetch('${getConfig('DOMAIN')}/api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                if (result.success) {
                    document.getElementById('surveyForm').innerHTML = 
                        '<div class="text-center py-12"><h2 class="text-2xl font-bold mb-4">Vielen Dank!</h2><p>Ihre Antworten wurden erfolgreich gespeichert.</p></div>';
                } else {
                    alert('Fehler: ' + result.error);
                    btn.disabled = false;
                    btn.textContent = 'Umfrage abschicken';
                }
            } catch(error) {
                alert('Fehler beim Senden: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Umfrage abschicken';
            }
        }
    </script>
</body>
</html>`;
  
  return HtmlService.createHtmlOutput(html);
}

function getSurveyData(spreadsheet, surveyId) {
  const settingsSheet = spreadsheet.getSheetByName('Settings');
  try {
    const surveys = JSON.parse(settingsSheet.getRange('B11').getValue() || '[]');
    return surveys.find(s => s.id === surveyId);
  } catch(e) {
    return null;
  }
}

function getTeamMemberOptions() {
  // In production, this would fetch from the Emails sheet
  const members = [
    'Anna Schmidt', 'Ben Müller', 'Clara Wagner', 'David Klein',
    'Emma Hoffmann', 'Felix Weber', 'Greta Schulz', 'Hans Becker',
    'Ida Fischer', 'Jonas Meyer', 'Katrin Wolf', 'Lars Zimmermann'
  ];
  
  return members.map(m => `<option value="${m}">${m}</option>`).join('');
}
