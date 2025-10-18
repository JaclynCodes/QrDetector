// Main Application Logic

// Application State
const appState = {
  isDetecting: false,
  config: {
    videoSourceUrl: '',
    apiUrl: '',
    apiKey: '',
    webhookUrl: '',
    scanInterval: 500,
    preventDuplicates: true
  },
  stats: {
    qrDetected: 0,
    apiCalls: 0,
    webhooksCalled: 0
  },
  detections: []
};

// Initialize QR Scanner
let qrScanner = null;

// DOM Elements
const elements = {
  video: document.getElementById('videoElement'),
  toggleBtn: document.getElementById('toggleDetection'),
  toggleBtnText: document.getElementById('toggleBtnText'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettings: document.getElementById('closeSettings'),
  cancelSettings: document.getElementById('cancelSettings'),
  saveSettings: document.getElementById('saveSettings'),
  videoPlaceholder: document.getElementById('videoPlaceholder'),
  scanOverlay: document.getElementById('scanOverlay'),
  systemStatus: document.getElementById('systemStatus'),
  detectionStatus: document.getElementById('detectionStatus'),
  qrCount: document.getElementById('qrCount'),
  apiCount: document.getElementById('apiCount'),
  webhookCount: document.getElementById('webhookCount'),
  detectionsList: document.getElementById('detectionsList'),
  activityLog: document.getElementById('activityLog')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  logActivity('System', 'Application initialized');
  updateSystemStatus('ready', 'Ready');

  // Load saved configuration from localStorage
  loadConfiguration();

  // Initialize QR Scanner
  qrScanner = new window.QRScanner();
  await qrScanner.initialize();
  qrScanner.onQRDetected = handleQRDetection;

  // Set up event listeners
  setupEventListeners();

  logActivity('System', 'QR scanner initialized');
});

// Event Listeners
function setupEventListeners() {
  elements.toggleBtn.addEventListener('click', toggleDetection);
  elements.settingsBtn.addEventListener('click', openSettings);
  elements.closeSettings.addEventListener('click', closeSettings);
  elements.cancelSettings.addEventListener('click', closeSettings);
  elements.saveSettings.addEventListener('click', saveConfiguration);

  // Close modal on outside click
  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) {
      closeSettings();
    }
  });
}

// Toggle Detection
async function toggleDetection() {
  if (!appState.isDetecting) {
    await startDetection();
  } else {
    stopDetection();
  }
}

async function startDetection() {
  // Check if video source is configured
  if (!appState.config.videoSourceUrl) {
    showNotification('error', 'Please configure video source in settings');
    openSettings();
    return;
  }

  try {
    logActivity('System', 'Starting video stream...');

    // Load video source
    elements.video.src = appState.config.videoSourceUrl;
    elements.videoPlaceholder.classList.add('hidden');

    // Wait for video to load
    await new Promise((resolve, reject) => {
      elements.video.onloadedmetadata = resolve;
      elements.video.onerror = () => reject(new Error('Failed to load video stream'));
      setTimeout(() => reject(new Error('Video load timeout')), 10000);
    });

    // Start QR scanning
    qrScanner.setScanInterval(appState.config.scanInterval);
    qrScanner.setPreventDuplicates(appState.config.preventDuplicates);
    qrScanner.startScanning();

    appState.isDetecting = true;
    elements.toggleBtnText.textContent = 'Stop Detection';
    elements.toggleBtn.classList.remove('btn-primary');
    elements.toggleBtn.classList.add('bg-red-600', 'hover:bg-red-700');
    elements.scanOverlay.classList.remove('hidden');

    updateDetectionStatus('scanning', 'Scanning...');
    updateSystemStatus('active', 'Active');
    logActivity('System', 'Detection started successfully');

  } catch (error) {
    console.error('Error starting detection:', error);
    logActivity('Error', `Failed to start detection: ${error.message}`);
    showNotification('error', `Failed to start: ${error.message}`);
    stopDetection();
  }
}

function stopDetection() {
  if (qrScanner) {
    qrScanner.stopScanning();
  }

  elements.video.src = '';
  elements.videoPlaceholder.classList.remove('hidden');
  elements.scanOverlay.classList.add('hidden');

  appState.isDetecting = false;
  elements.toggleBtnText.textContent = 'Start Detection';
  elements.toggleBtn.classList.add('btn-primary');
  elements.toggleBtn.classList.remove('bg-red-600', 'hover:bg-red-700');

  updateDetectionStatus('standby', 'Standby');
  updateSystemStatus('ready', 'Ready');
  logActivity('System', 'Detection stopped');
}

// Handle QR Detection
async function handleQRDetection(detection) {
  logActivity('QR Detected', `Data: ${detection.data.substring(0, 40)}...`);
  appState.stats.qrDetected++;
  updateStats();

  // Add to detections list
  addDetectionToList(detection);

  try {
    // Generate hash
    const hashResult = await window.electronAPI.generateHash(detection.data);
    if (!hashResult.success) {
      throw new Error('Hash generation failed');
    }

    logActivity('Hash', `Generated: ${hashResult.hash.substring(0, 16)}...`);

    // Send to API if configured
    if (appState.config.apiUrl) {
      const apiResult = await window.electronAPI.sendToAPI({
        hash: hashResult.hash,
        apiUrl: appState.config.apiUrl,
        apiKey: appState.config.apiKey
      });

      if (apiResult.success) {
        appState.stats.apiCalls++;
        updateStats();
        logActivity('API', `Hash sent successfully (${apiResult.status})`);

        // Trigger webhook if configured and API returned contact info
        if (appState.config.webhookUrl && apiResult.data) {
          const webhookResult = await window.electronAPI.triggerWebhook({
            webhookUrl: appState.config.webhookUrl,
            contactInfo: apiResult.data,
            qrHash: hashResult.hash
          });

          if (webhookResult.success) {
            appState.stats.webhooksCalled++;
            updateStats();
            logActivity('Webhook', `Triggered successfully (${webhookResult.status})`);
          } else {
            logActivity('Webhook Error', webhookResult.error);
          }
        }
      } else {
        logActivity('API Error', `${apiResult.error} (${apiResult.status})`);
      }
    }

  } catch (error) {
    console.error('Error processing QR code:', error);
    logActivity('Error', `Processing failed: ${error.message}`);
  }
}

// UI Update Functions
function updateSystemStatus(type, text) {
  const statusColors = {
    ready: 'bg-green-500',
    active: 'bg-blue-500',
    error: 'bg-red-500'
  };

  elements.systemStatus.innerHTML = `
    <div class="w-2 h-2 ${statusColors[type]} rounded-full animate-pulse"></div>
    <span class="text-sm text-slate-300">${text}</span>
  `;
}

function updateDetectionStatus(type, text) {
  const statusColors = {
    standby: 'bg-slate-700 text-slate-300',
    scanning: 'bg-blue-600 text-white',
    detected: 'bg-green-600 text-white'
  };

  const dotColors = {
    standby: 'bg-slate-400',
    scanning: 'bg-blue-300 animate-pulse',
    detected: 'bg-green-300 animate-pulse'
  };

  elements.detectionStatus.className = `status-badge ${statusColors[type]}`;
  elements.detectionStatus.innerHTML = `
    <div class="w-2 h-2 ${dotColors[type]} rounded-full"></div>
    ${text}
  `;
}

function updateStats() {
  elements.qrCount.textContent = appState.stats.qrDetected;
  elements.apiCount.textContent = appState.stats.apiCalls;
  elements.webhookCount.textContent = appState.stats.webhooksCalled;
}

function addDetectionToList(detection) {
  const detectionItem = document.createElement('div');
  detectionItem.className = 'bg-slate-700/50 rounded-lg p-3 border border-slate-600 animate-pulse';

  const time = new Date().toLocaleTimeString();
  const preview = detection.data.length > 40 ? detection.data.substring(0, 40) + '...' : detection.data;

  detectionItem.innerHTML = `
    <div class="flex items-start justify-between mb-2">
      <span class="text-xs font-semibold text-primary-400">QR Code Detected</span>
      <span class="text-xs text-slate-400">${time}</span>
    </div>
    <p class="text-sm font-mono text-slate-200 break-all">${escapeHtml(preview)}</p>
  `;

  // Remove placeholder if exists
  if (elements.detectionsList.querySelector('.text-center')) {
    elements.detectionsList.innerHTML = '';
  }

  elements.detectionsList.insertBefore(detectionItem, elements.detectionsList.firstChild);

  // Remove animation after 1 second
  setTimeout(() => {
    detectionItem.classList.remove('animate-pulse');
  }, 1000);

  // Keep only last 10 detections
  while (elements.detectionsList.children.length > 10) {
    elements.detectionsList.removeChild(elements.detectionsList.lastChild);
  }

  // Temporarily change detection status
  updateDetectionStatus('detected', 'QR Detected!');
  setTimeout(() => {
    if (appState.isDetecting) {
      updateDetectionStatus('scanning', 'Scanning...');
    }
  }, 2000);
}

function logActivity(type, message) {
  const logEntry = document.createElement('div');
  const time = new Date().toLocaleTimeString();
  const typeColors = {
    'System': 'text-blue-400',
    'QR Detected': 'text-green-400',
    'Hash': 'text-purple-400',
    'API': 'text-emerald-400',
    'Webhook': 'text-violet-400',
    'Error': 'text-red-400',
    'Config': 'text-yellow-400'
  };

  logEntry.className = `text-xs ${typeColors[type] || 'text-slate-400'}`;
  logEntry.textContent = `[${time}] [${type}] ${message}`;

  elements.activityLog.insertBefore(logEntry, elements.activityLog.firstChild);

  // Keep only last 50 log entries
  while (elements.activityLog.children.length > 50) {
    elements.activityLog.removeChild(elements.activityLog.lastChild);
  }

  // Scroll to top
  elements.activityLog.scrollTop = 0;
}

function showNotification(type, message) {
  // Simple notification system - could be enhanced with a toast library
  const color = type === 'error' ? 'text-red-400' : 'text-green-400';
  logActivity(type === 'error' ? 'Error' : 'System', message);
}

// Settings Functions
function openSettings() {
  // Populate form with current config
  document.getElementById('videoSourceUrl').value = appState.config.videoSourceUrl;
  document.getElementById('apiUrl').value = appState.config.apiUrl;
  document.getElementById('apiKey').value = appState.config.apiKey;
  document.getElementById('webhookUrl').value = appState.config.webhookUrl;
  document.getElementById('scanInterval').value = appState.config.scanInterval;
  document.getElementById('preventDuplicates').checked = appState.config.preventDuplicates;

  elements.settingsModal.classList.remove('hidden');
  elements.settingsModal.classList.add('flex');
}

function closeSettings() {
  elements.settingsModal.classList.add('hidden');
  elements.settingsModal.classList.remove('flex');
}

async function saveConfiguration() {
  // Get form values
  appState.config.videoSourceUrl = document.getElementById('videoSourceUrl').value.trim();
  appState.config.apiUrl = document.getElementById('apiUrl').value.trim();
  appState.config.apiKey = document.getElementById('apiKey').value.trim();
  appState.config.webhookUrl = document.getElementById('webhookUrl').value.trim();
  appState.config.scanInterval = parseInt(document.getElementById('scanInterval').value) || 500;
  appState.config.preventDuplicates = document.getElementById('preventDuplicates').checked;

  // Save to localStorage
  localStorage.setItem('qrDetectionConfig', JSON.stringify(appState.config));

  // Save via Electron API (for future persistence)
  await window.electronAPI.saveConfig(appState.config);

  logActivity('Config', 'Configuration saved successfully');
  showNotification('success', 'Configuration saved');

  closeSettings();
}

function loadConfiguration() {
  const saved = localStorage.getItem('qrDetectionConfig');
  if (saved) {
    try {
      appState.config = { ...appState.config, ...JSON.parse(saved) };
      logActivity('Config', 'Configuration loaded');
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }
}

// Utility Functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle video errors
elements.video.addEventListener('error', (e) => {
  console.error('Video error:', e);
  logActivity('Error', 'Video stream error - check video source URL');
  if (appState.isDetecting) {
    stopDetection();
  }
});
