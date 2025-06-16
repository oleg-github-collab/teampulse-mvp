// security.gs

function signURL(data) {
  const secret = getConfig('HMAC_SECRET');
  const signature = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_256,
    data,
    secret
  );
  return Utilities.base64Encode(signature);
}

function verifyURL(data, token) {
  const expectedToken = signURL(data);
  return token === expectedToken;
}

function generateSecureToken() {
  const bytes = Utilities.newBlob(Utilities.getUuid()).getBytes();
  return Utilities.base64Encode(bytes);
}

function hashEmail(email) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    email.toLowerCase()
  );
  return Utilities.base64Encode(bytes);
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/&/g, '&amp;');
}

function checkRateLimit(identifier, maxRequests = 100, windowMinutes = 60) {
  const cache = CacheService.getScriptCache();
  const key = `ratelimit_${identifier}`;
  const current = parseInt(cache.get(key) || '0');
  
  if (current >= maxRequests) {
    return false;
  }
  
  cache.put(key, String(current + 1), windowMinutes * 60);
  return true;
}

function isAuthorizedUser(email) {
  // Check if user is authorized to access admin functions
  const authorizedDomains = ['@yourcompany.com'];
  
  return authorizedDomains.some(domain => email.endsWith(domain));
}

function encryptData(data) {
  // Simple obfuscation for MVP - in production use proper encryption
  const key = getConfig('HMAC_SECRET');
  const json = JSON.stringify(data);
  const encrypted = Utilities.base64Encode(
    Utilities.newBlob(json).getBytes()
  );
  return encrypted;
}

function decryptData(encrypted) {
  try {
    const decrypted = Utilities.newBlob(
      Utilities.base64Decode(encrypted)
    ).getDataAsString();
    return JSON.parse(decrypted);
  } catch(e) {
    return null;
  }
}

function validateProjectAccess(projectId, userEmail) {
  const index = getOrCreateProjectsIndex();
  const sheet = index.getSheetByName('Projects');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === projectId) {
      return data[i][2] === userEmail; // Check owner
    }
  }
  
  return false;
}

function anonymizeResponses(responses) {
  // Replace names with anonymous IDs
  const nameMap = {};
  let counter = 1;
  
  return responses.map(response => {
    const name = response[3]; // Name column
    if (!nameMap[name]) {
      nameMap[name] = `Participant_${counter++}`;
    }
    
    const anonymized = [...response];
    anonymized[3] = nameMap[name];
    anonymized[2] = 'anonymous@example.com'; // Email
    
    return anonymized;
  });
}

function logSecurityEvent(event, details) {
  const log = {
    timestamp: new Date().toISOString(),
    event: event,
    details: details,
    user: Session.getActiveUser().getEmail()
  };
  
  console.log('Security Event:', JSON.stringify(log));
  
  // In production, store in a security log sheet
}

function validateCSRFToken(token) {
  const cache = CacheService.getUserCache();
  const stored = cache.get('csrf_token');
  
  if (!stored || stored !== token) {
    return false;
  }
  
  // Token is single-use
  cache.remove('csrf_token');
  return true;
}

function generateCSRFToken() {
  const token = Utilities.getUuid();
  const cache = CacheService.getUserCache();
  cache.put('csrf_token', token, 3600); // 1 hour
  return token;
}

function cleanupOldData() {
  // Run daily to remove data older than 90 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  
  const folders = DriveApp.getFoldersByName('Sociometry-Projects');
  if (!folders.hasNext()) return;
  
  const rootFolder = folders.next();
  const projectFolders = rootFolder.getFolders();
  
  while (projectFolders.hasNext()) {
    const folder = projectFolders.next();
    const created = folder.getDateCreated();
    
    if (created < cutoffDate) {
      // Archive or delete based on policy
      logSecurityEvent('DATA_CLEANUP', {
        folderId: folder.getId(),
        folderName: folder.getName(),
        created: created.toISOString()
      });
      
      // Move to archive or delete
      // folder.setTrashed(true);
    }
  }
}

function setupSecurityHeaders(output) {
  return output
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}
