const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gaba', {
  getAll: () => ipcRenderer.invoke('gaba:getAll'),
  getByCategory: (category) => ipcRenderer.invoke('gaba:getByCategory', category),
  search: (query) => ipcRenderer.invoke('gaba:search', query),
  pickImage: () => ipcRenderer.invoke('gaba:pickImage'),
  pickSound: () => ipcRenderer.invoke('gaba:pickSound'),
  addSpecies: (payload) => ipcRenderer.invoke('gaba:addSpecies', payload),
  updateSpecies: (id, patch) => ipcRenderer.invoke('gaba:updateSpecies', { id, patch }),
  deleteSpecies: (id) => ipcRenderer.invoke('gaba:deleteSpecies', id),
  toFileUrl: (p) => (p ? 'file://' + p.replace(/\\/g, '/') : ''),
  getConfig: () => ipcRenderer.invoke('gaba:getConfig'),
  saveConfig: (partial) => ipcRenderer.invoke('gaba:saveConfig', partial),
  searchImages: (query, provider, apiKey) => ipcRenderer.invoke('gaba:searchImages', { query, provider, apiKey }),
  downloadFileToTemp: (url) => ipcRenderer.invoke('gaba:downloadFileToTemp', url),
  searchSounds: (query, apiKey) => ipcRenderer.invoke('gaba:searchSounds', { query, apiKey }),
  aiAutofill: (payload) => ipcRenderer.invoke('gaba:aiAutofill', payload),
  aiCaption: (payload) => ipcRenderer.invoke('gaba:aiCaption', payload),
  aiScientificName: (payload) => ipcRenderer.invoke('gaba:aiScientificName', payload),
  checkCategory: (payload) => ipcRenderer.invoke('gaba:checkCategory', payload),
});
