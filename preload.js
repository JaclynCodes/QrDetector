const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  generateHash: (qrData) => ipcRenderer.invoke('generate-hash', qrData),
  sendToAPI: (data) => ipcRenderer.invoke('send-to-api', data),
  triggerWebhook: (data) => ipcRenderer.invoke('trigger-webhook', data),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config)
});
