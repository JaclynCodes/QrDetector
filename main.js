const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
    show: false
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Generate hash from QR code data
ipcMain.handle('generate-hash', async (event, qrData) => {
  try {
    const hash = crypto.createHash('sha256').update(qrData).digest('hex');
    return { success: true, hash };
  } catch (error) {
    console.error('Hash generation error:', error);
    return { success: false, error: error.message };
  }
});

// Send QR hash to API
ipcMain.handle('send-to-api', async (event, { hash, apiUrl, apiKey }) => {
  try {
    const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};

    const response = await axios.post(apiUrl,
      {
        qr_hash: hash,
        timestamp: new Date().toISOString()
      },
      {
        headers,
        timeout: 10000
      }
    );

    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    console.error('API call error:', error);
    return {
      success: false,
      error: error.message,
      status: error.response?.status
    };
  }
});

// Trigger webhook with contact information
ipcMain.handle('trigger-webhook', async (event, { webhookUrl, contactInfo, qrHash }) => {
  try {
    const payload = {
      qr_hash: qrHash,
      contact_info: contactInfo,
      timestamp: new Date().toISOString(),
      event_type: 'qr_detected'
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.error('Webhook trigger error:', error);
    return {
      success: false,
      error: error.message,
      status: error.response?.status
    };
  }
});

// Save configuration
ipcMain.handle('save-config', async (event, config) => {
  try {
    // In a production app, you'd save this to a file or database
    // For MVP, we'll just acknowledge the save
    console.log('Configuration saved:', config);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
