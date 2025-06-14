```javascript
// admin.js

let currentProject = null;
const API_BASE = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

// Load projects on init
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadProjects();
});

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}?action=getUser`);
        const data = await response.json();
        document.getElementById('userEmail').textContent = data.email || 'Not logged in';
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

// Load projects
async function loadProjects() {
    showLoading();
    try {
        const response = await fetch(`${API_BASE}?action=listProjects`);
        const projects = await response.json();
        renderProjects(projects);
    } catch (error) {
        alert('Fehler beim Laden der Projekte: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Render projects table
function renderProjects(projects) {
    const tbody = document.getElementById('projectsTable');
    tbody.innerHTML = projects.map(p => `
        <tr class="hover:bg-gray-800">
            <td class="px-6 py-4">
                <div class="font-medium">${p.name}</div>
                <div class="text-sm text-gray-400">${p.description || ''}</div>
            </td>
            <td class="px-6 py-4 text-sm">${new Date(p.created).toLocaleDateString('de-DE')}</td>
            <td class="px-6 py-4">${p.surveyCount || 0} Umfragen</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 text-xs rounded ${p.status === 'active' ? 'bg-green-800' : 'bg-gray-700'}">
                    ${p.status || 'active'}
                </span>
            </td>
            <td class="px-6 py-4 text-right">
                <button onclick="viewProject('${p.id}')" class="text-blue-400 hover:underline">
                    Öffnen →
                </button>
            </td>
        </tr>
    `).join('');
}

// View project details
async function viewProject(projectId) {
    showLoading();
    try {
        const response = await fetch(`${API_BASE}?action=getProject&pid=${projectId}`);
        currentProject = await response.json();
        
        document.getElementById('projectName').textContent = currentProject.name;
        document.getElementById('projectDescription').textContent = currentProject.description;
        document.getElementById('totalResponses').textContent = currentProject.totalResponses || 0;
        document.getElementById('responseRate').textContent = (currentProject.responseRate || 0) + '%';
        document.getElementById('avgMentalHealth').textContent = currentProject.avgMentalHealth || '-';
        document.getElementById('networkDensity').textContent = currentProject.networkDensity || '-';
        
        // Load surveys
        loadSurveys(projectId);
        
        // Switch view
        document.getElementById('projectList').classList.add('hidden');
        document.getElementById('projectDetails').classList.remove('hidden');
    } catch (error) {
        alert('Fehler beim Laden des Projekts: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Load surveys
async function loadSurveys(projectId) {
    try {
        const response = await fetch(`${API_BASE}?action=listSurveys&pid=${projectId}`);
        const surveys = await response.json();
        renderSurveys(surveys);
    } catch (error) {
        console.error('Error loading surveys:', error);
    }
}

// Render surveys
function renderSurveys(surveys) {
    const container = document.getElementById('surveysList');
    container.innerHTML = surveys.map(s => `
        <div class="bg-gray-800 p-4 rounded">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="font-bold">${s.title}</h4>
                    <p class="text-sm text-gray-400">${s.description}</p>
                </div>
                <span class="text-sm text-gray-500">${new Date(s.created).toLocaleDateString('de-DE')}</span>
            </div>
            <div class="flex justify-between items-center">
                <div class="text-sm">
                    <span class="text-green-400">${s.responded}</span> / <span>${s.sent}</span> beantwortet
                    (${Math.round((s.responded / s.sent) * 100)}%)
                </div>
                <div class="space-x-2">
                    <button onclick="copySurveyLink('${s.id}')" class="text-blue-400 hover:underline text-sm">
                        Link kopieren
                    </button>
                    <button onclick="sendReminders('${s.id}')" class="text-yellow-400 hover:underline text-sm">
                        Erinnerungen senden
                    </button>
                    <button onclick="viewOnePager('${s.id}')" class="text-purple-400 hover:underline text-sm">
                        One-Pager →
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Create new project
async function createProject(event) {
    event.preventDefault();
    showLoading();
    
    const data = {
        name: document.getElementById('newProjectName').value,
        description: document.getElementById('newProjectDescription').value,
        estMembers: parseInt(document.getElementById('estMembers').value),
        numCriteria: parseInt(document.getElementById('numCriteria').value)
    };
    
    try {
        const response = await fetch(`${API_BASE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createProject', ...data })
        });
        
        const result = await response.json();
        if (result.success) {
            closeDialog('newProjectDialog');
            loadProjects();
            alert('Projekt erfolgreich erstellt!');
        }
    } catch (error) {
        alert('Fehler beim Erstellen des Projekts: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Create new survey
async function createSurvey(event) {
    event.preventDefault();
    
    const btn = document.getElementById('createSurveyBtn');
    btn.disabled = true;
    btn.textContent = 'KI generiert Fragen...';
    
    const data = {
        pid: currentProject.id,
        title: document.getElementById('surveyTitle').value,
        description: document.getElementById('surveyDescription').value,
        emails: document.getElementById('surveyEmails').value.split('\n').filter(e => e.trim())
    };
    
    try {
        const response = await fetch(`${API_BASE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createSurvey', ...data })
        });
        
        const result = await response.json();
        if (result.success) {
            closeDialog('newSurveyDialog');
            loadSurveys(currentProject.id);
            alert(`Umfrage erstellt! Link: ${result.surveyUrl}`);
        }
    } catch (error) {
        alert('Fehler beim Erstellen der Umfrage: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Umfrage generieren';
    }
}

// Calculate metrics
async function calcMetrics() {
    if (!currentProject) return;
    
    showLoading();
    try {
        const response = await fetch(`${API_BASE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'calcMetrics', 
                pid: currentProject.id 
            })
        });
        
        const result = await response.json();
        if (result.success) {
            alert('Report erfolgreich berechnet! KI-Insights wurden generiert.');
            viewProject(currentProject.id); // Reload to show new metrics
        }
    } catch (error) {
        alert('Fehler beim Berechnen der Metriken: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Helper functions
function showNewProjectDialog() {
    document.getElementById('newProjectDialog').classList.remove('hidden');
    updateEstimatedPrice();
}

function showNewSurveyDialog() {
    document.getElementById('newSurveyDialog').classList.remove('hidden');
}

function closeDialog(dialogId) {
    document.getElementById(dialogId).classList.add('hidden');
}

function backToList() {
    document.getElementById('projectDetails').classList.add('hidden');
    document.getElementById('projectList').classList.remove('hidden');
    currentProject = null;
}

function copySurveyLink(surveyId) {
    const link = `${window.location.origin}/survey?pid=${currentProject.id}&sid=${surveyId}&token=XXX`;
    navigator.clipboard.writeText(link);
    alert('Link in Zwischenablage kopiert!');
}

async function sendReminders(surveyId) {
    if (!confirm('Erinnerungen an alle ausstehenden Teilnehmer senden?')) return;
    
    try {
        const response = await fetch(`${API_BASE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'sendReminders', 
                pid: currentProject.id,
                sid: surveyId 
            })
        });
        
        const result = await response.json();
        alert(`${result.sent} Erinnerungen versendet!`);
    } catch (error) {
        alert('Fehler beim Versenden der Erinnerungen: ' + error.message);
    }
}

function viewOnePager(surveyId) {
    window.open(`/onepager?pid=${currentProject.id}&sid=${surveyId}`, '_blank');
}

function downloadPDF() {
    alert('PDF-Export wird generiert...');
    // Implementation would trigger server-side PDF generation
}

function showLoading() {
    document.getElementById('loadingSpinner').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingSpinner').classList.add('hidden');
}

// Update estimated price
function updateEstimatedPrice() {
    const members = parseInt(document.getElementById('estMembers').value) || 10;
    const criteria = parseInt(document.getElementById('numCriteria').value) || 3;
    
    const basePrice = 750;
    const extraPeople = Math.max(0, members - 4) * 75;
    const extraCriteria = Math.max(0, criteria - 2) * 250;
    const total = basePrice + extraPeople + extraCriteria;
    
    document.getElementById('estimatedPrice').textContent = total + ' €';
}

document.getElementById('estMembers').addEventListener('input', updateEstimatedPrice);
document.getElementById('numCriteria').addEventListener('input', updateEstimatedPrice);
```