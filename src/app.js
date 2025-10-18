// Main Application Logic

// Application State
const appState = {
  isDetecting: false,
  videoStream: null,
  config: {
    videoSource: 'webcam', // 'webcam' or 'network'
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

  // Video source change handler
  const videoSourceSelect = document.getElementById('videoSource');
  if (videoSourceSelect) {
    videoSourceSelect.addEventListener('change', toggleVideoSourceFields);
  }

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
  try {
    logActivity('System', 'Starting video stream...');
    elements.videoPlaceholder.classList.add('hidden');

    // Choose video source based on configuration
    if (appState.config.videoSource === 'webcam') {
      // Use local webcam
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment' // Prefer back camera on mobile
          }
        });

        appState.videoStream = stream;
        elements.video.srcObject = stream;
        logActivity('System', 'Webcam connected successfully');

        // Wait for video to be ready
        await new Promise((resolve) => {
          elements.video.onloadedmetadata = resolve;
        });
      } catch (error) {
        throw new Error(`Webcam access failed: ${error.message}`);
      }
    } else {
      // Use network video source
      if (!appState.config.videoSourceUrl) {
        showNotification('error', 'Please configure video source URL in settings');
        openSettings();
        return;
      }

      elements.video.src = appState.config.videoSourceUrl;

      // Wait for video to load
      await new Promise((resolve, reject) => {
        elements.video.onloadedmetadata = resolve;
        elements.video.onerror = () => reject(new Error('Failed to load video stream'));
        setTimeout(() => reject(new Error('Video load timeout')), 10000);
      });
    }

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

  // Stop webcam stream if active
  if (appState.videoStream) {
    appState.videoStream.getTracks().forEach(track => track.stop());
    appState.videoStream = null;
    elements.video.srcObject = null;
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
  const statusConfigs = {
    ready: {
      color: 'bg-emerald-500',
      shadow: 'shadow-emerald-500/50',
      text: 'text-slate-200'
    },
    active: {
      color: 'bg-primary-500',
      shadow: 'shadow-primary-500/50',
      text: 'text-white'
    },
    error: {
      color: 'bg-red-500',
      shadow: 'shadow-red-500/50',
      text: 'text-slate-200'
    }
  };

  const config = statusConfigs[type];
  elements.systemStatus.innerHTML = `
    <div class="w-2.5 h-2.5 ${config.color} rounded-full animate-pulse shadow-lg ${config.shadow}"></div>
    <span class="text-sm font-medium ${config.text}">${text}</span>
  `;
}

function updateDetectionStatus(type, text) {
  const statusConfigs = {
    standby: {
      bg: 'bg-slate-800/50',
      border: 'border-slate-700/50',
      dot: 'bg-slate-400',
      text: 'text-slate-300'
    },
    scanning: {
      bg: 'bg-primary-500/20',
      border: 'border-primary-500/50',
      dot: 'bg-primary-400 animate-pulse shadow-lg shadow-primary-400/50',
      text: 'text-primary-300'
    },
    detected: {
      bg: 'bg-emerald-500/20',
      border: 'border-emerald-500/50',
      dot: 'bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50',
      text: 'text-emerald-300'
    }
  };

  const config = statusConfigs[type];
  elements.detectionStatus.className = `flex items-center gap-2.5 px-4 py-2 ${config.bg} rounded-xl border ${config.border} transition-all duration-300`;
  elements.detectionStatus.innerHTML = `
    <div class="w-2 h-2 ${config.dot} rounded-full"></div>
    <span class="text-sm font-semibold ${config.text}">${text}</span>
  `;
}

function updateStats() {
  elements.qrCount.textContent = appState.stats.qrDetected;
  elements.apiCount.textContent = appState.stats.apiCalls;
  elements.webhookCount.textContent = appState.stats.webhooksCalled;
}

function addDetectionToList(detection) {
  const detectionItem = document.createElement('div');
  detectionItem.className = 'group bg-gradient-to-br from-slate-800/80 to-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50 hover:border-primary-500/50 transition-all duration-300 animate-pulse shadow-lg';

  const time = new Date().toLocaleTimeString();
  const preview = detection.data.length > 35 ? detection.data.substring(0, 35) + '...' : detection.data;

  detectionItem.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/50"></div>
        <span class="text-xs font-bold text-emerald-400 uppercase tracking-wide">Detected</span>
      </div>
      <span class="text-xs text-slate-500 font-medium">${time}</span>
    </div>
    <p class="text-sm font-mono text-slate-300 break-all leading-relaxed">${escapeHtml(preview)}</p>
    <div class="mt-3 pt-3 border-t border-slate-700/30 flex items-center gap-2">
      <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
      </svg>
      <span class="text-xs text-slate-500">Hash Generated</span>
    </div>
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
  document.getElementById('videoSource').value = appState.config.videoSource;
  document.getElementById('videoSourceUrl').value = appState.config.videoSourceUrl;
  document.getElementById('apiUrl').value = appState.config.apiUrl;
  document.getElementById('apiKey').value = appState.config.apiKey;
  document.getElementById('webhookUrl').value = appState.config.webhookUrl;
  document.getElementById('scanInterval').value = appState.config.scanInterval;
  document.getElementById('preventDuplicates').checked = appState.config.preventDuplicates;

  // Show/hide network URL based on video source
  toggleVideoSourceFields();

  elements.settingsModal.classList.remove('hidden');
  elements.settingsModal.classList.add('flex');
}

function closeSettings() {
  elements.settingsModal.classList.add('hidden');
  elements.settingsModal.classList.remove('flex');
}

async function saveConfiguration() {
  // Get form values
  appState.config.videoSource = document.getElementById('videoSource').value;
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

function toggleVideoSourceFields() {
  const videoSource = document.getElementById('videoSource').value;
  const urlField = document.getElementById('networkUrlField');

  if (videoSource === 'webcam') {
    urlField.classList.add('hidden');
  } else {
    urlField.classList.remove('hidden');
  }
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
