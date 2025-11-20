let allExtensions = [];
let settings = {
  defaultCollapsed: true,
  defaultFilter: 'all',
  defaultSort: 'name',
  themeMode: 'auto',
  compactMode: false,
  iconSize: 'medium',
  profiles: {}
};

// Permission severity definitions
const permissionSeverity = {
  // High severity - can access sensitive data or modify browser behavior significantly
  high: [
    'cookies', 'history', 'bookmarks', 'passwords', 'webRequest', 'webRequestBlocking',
    'debugger', 'privacy', 'proxy', 'vpnProvider', 'webNavigation', 'management',
    'nativeMessaging', 'clipboardRead', 'geolocation', 'browsingData', 'contentSettings',
    'downloads', 'downloads.open', 'identity', 'identity.email', 'platformKeys',
    'enterprise.platformKeys', 'certificateProvider', 'documentScan', 'fileSystemProvider',
    'loginState', 'networking.config', 'networking.onc', 'signedInDevices', 'topSites',
    'desktopCapture', 'tabCapture', 'pageCapture', 'declarativeNetRequest',
    '<all_urls>', '*://*/*', 'http://*/*', 'https://*/*', 'file:///*'
  ],
  // Medium severity - can access some user data or modify content
  medium: [
    'tabs', 'activeTab', 'storage', 'notifications', 'alarms', 'contextMenus',
    'clipboardWrite', 'unlimitedStorage', 'scripting', 'offscreen', 'sidePanel',
    'favicon', 'fontSettings', 'gcm', 'idle', 'power', 'printerProvider', 'printing',
    'printingMetrics', 'readingList', 'search', 'sessions', 'system.cpu', 'system.display',
    'system.memory', 'system.storage', 'tts', 'ttsEngine', 'wallpaper', 'webAuthenticationProxy'
  ],
  // Low severity - minimal risk
  low: [
    'accessibilityFeatures.modify', 'accessibilityFeatures.read', 'declarativeContent',
    'enterprise.deviceAttributes', 'enterprise.hardwarePlatform', 'fileBrowserHandler',
    'fileSystem', 'fileSystem.directory', 'fileSystem.requestFileSystem', 'fileSystem.retainEntries',
    'fileSystem.write', 'usb', 'serial', 'hid', 'bluetooth', 'virtualKeyboard'
  ]
};

// Get severity level for a permission
function getPermissionSeverity(permission) {
  const permLower = permission.toLowerCase();

  // Check for host permissions (URLs)
  if (permission.includes('://') || permission === '<all_urls>') {
    if (permission === '<all_urls>' || permission === '*://*/*' ||
        permission === 'http://*/*' || permission === 'https://*/*' ||
        permission === 'file:///*') {
      return 'high';
    }
    // Specific domain access is medium
    return 'medium';
  }

  if (permissionSeverity.high.some(p => permLower === p.toLowerCase())) {
    return 'high';
  }
  if (permissionSeverity.medium.some(p => permLower === p.toLowerCase())) {
    return 'medium';
  }
  if (permissionSeverity.low.some(p => permLower === p.toLowerCase())) {
    return 'low';
  }

  // Default to low for unknown permissions
  return 'low';
}

// Calculate overall risk score for an extension
function calculateRiskScore(ext) {
  const allPerms = [
    ...(ext.permissions || []),
    ...(ext.hostPermissions || [])
  ];

  if (allPerms.length === 0) {
    return { score: 0, level: 'none', label: 'No Risk' };
  }

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  allPerms.forEach(perm => {
    const severity = getPermissionSeverity(perm);
    if (severity === 'high') highCount++;
    else if (severity === 'medium') mediumCount++;
    else lowCount++;
  });

  // Calculate weighted score (0-100)
  const score = Math.min(100, (highCount * 30) + (mediumCount * 10) + (lowCount * 2));

  let level, label;
  if (score >= 60 || highCount >= 3) {
    level = 'high';
    label = 'High Risk';
  } else if (score >= 30 || highCount >= 1) {
    level = 'medium';
    label = 'Medium Risk';
  } else if (score > 0) {
    level = 'low';
    label = 'Low Risk';
  } else {
    level = 'none';
    label = 'No Risk';
  }

  return { score, level, label, highCount, mediumCount, lowCount };
}

// Check if system prefers dark mode
function getSystemDarkMode() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Apply theme based on setting
function applyTheme() {
  const container = document.querySelector('.container');
  let isDark = false;

  if (settings.themeMode === 'auto') {
    isDark = getSystemDarkMode();
  } else if (settings.themeMode === 'dark') {
    isDark = true;
  }

  container.classList.toggle('dark-mode', isDark);
}

// Settings storage functions
async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get('extensionManagerSettings');
    if (stored.extensionManagerSettings) {
      settings = { ...settings, ...stored.extensionManagerSettings };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ extensionManagerSettings: settings });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

function applySettings() {
  const container = document.querySelector('.container');

  // Apply theme
  applyTheme();

  // Apply compact mode
  container.classList.toggle('compact', settings.compactMode);

  // Apply icon size
  container.classList.remove('icon-small', 'icon-medium', 'icon-large');
  container.classList.add(`icon-${settings.iconSize}`);

  // Set default filter and sort
  document.getElementById('filter').value = settings.defaultFilter;
  document.getElementById('sort').value = settings.defaultSort;

  // Update settings panel UI
  document.getElementById('default-collapsed').checked = settings.defaultCollapsed;
  document.getElementById('default-filter').value = settings.defaultFilter;
  document.getElementById('default-sort').value = settings.defaultSort;
  document.getElementById('theme-mode').value = settings.themeMode;
  document.getElementById('compact-mode').checked = settings.compactMode;
  document.getElementById('icon-size').value = settings.iconSize;

  // Load profiles into dropdown
  updateProfileDropdown();
}

function updateProfileDropdown() {
  const select = document.getElementById('profile-select');
  const currentValue = select.value;

  // Clear existing options except the default
  select.innerHTML = '<option value="">-- None --</option>';

  // Add saved profiles
  Object.keys(settings.profiles).forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  // Restore selection if it still exists
  if (settings.profiles[currentValue]) {
    select.value = currentValue;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  applySettings();
  loadExtensions();

  document.getElementById('search').addEventListener('input', filterExtensions);
  document.getElementById('filter').addEventListener('change', filterExtensions);
  document.getElementById('sort').addEventListener('change', filterExtensions);
  document.getElementById('permissions-filter').addEventListener('change', filterExtensions);

  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (settings.themeMode === 'auto') {
        applyTheme();
      }
    });
  }

  // Settings panel toggle
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.toggle('hidden');
    document.getElementById('help-panel').classList.add('hidden');
  });

  document.getElementById('close-settings').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.add('hidden');
  });

  // Help panel toggle
  document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('help-panel').classList.toggle('hidden');
    document.getElementById('settings-panel').classList.add('hidden');
  });

  document.getElementById('close-help').addEventListener('click', () => {
    document.getElementById('help-panel').classList.add('hidden');
  });

  // Reload extensions button
  document.getElementById('reload-btn').addEventListener('click', () => {
    loadExtensions();
  });

  // Settings change handlers
  document.getElementById('default-collapsed').addEventListener('change', (e) => {
    settings.defaultCollapsed = e.target.checked;
    saveSettings();
  });

  document.getElementById('default-filter').addEventListener('change', (e) => {
    settings.defaultFilter = e.target.value;
    saveSettings();
  });

  document.getElementById('default-sort').addEventListener('change', (e) => {
    settings.defaultSort = e.target.value;
    saveSettings();
  });

  document.getElementById('theme-mode').addEventListener('change', (e) => {
    settings.themeMode = e.target.value;
    applyTheme();
    saveSettings();
  });

  document.getElementById('compact-mode').addEventListener('change', (e) => {
    settings.compactMode = e.target.checked;
    document.querySelector('.container').classList.toggle('compact', settings.compactMode);
    saveSettings();
  });

  document.getElementById('icon-size').addEventListener('change', (e) => {
    settings.iconSize = e.target.value;
    const container = document.querySelector('.container');
    container.classList.remove('icon-small', 'icon-medium', 'icon-large');
    container.classList.add(`icon-${settings.iconSize}`);
    saveSettings();
  });

  // Profile management
  document.getElementById('create-profile').addEventListener('click', createProfile);
  document.getElementById('save-profile').addEventListener('click', saveCurrentProfile);
  document.getElementById('load-profile').addEventListener('click', loadProfile);
  document.getElementById('delete-profile').addEventListener('click', deleteProfile);
});

async function loadExtensions() {
  try {
    const extensions = await chrome.management.getAll();
    allExtensions = extensions;
    updateStats();
    filterExtensions();
  } catch (error) {
    console.error('Error loading extensions:', error);
    document.getElementById('extensions-list').innerHTML =
      '<div class="error">Error loading extensions</div>';
  }
}

function updateStats() {
  const total = allExtensions.length;
  const enabled = allExtensions.filter(ext => ext.enabled).length;
  const disabled = total - enabled;

  document.getElementById('total-count').textContent = `Total: ${total}`;
  document.getElementById('enabled-count').textContent = `Enabled: ${enabled}`;
  document.getElementById('disabled-count').textContent = `Disabled: ${disabled}`;
}

function filterExtensions() {
  const searchTerm = document.getElementById('search').value.toLowerCase();
  const filterValue = document.getElementById('filter').value;
  const sortValue = document.getElementById('sort').value;
  const permissionsFilter = document.getElementById('permissions-filter').value;

  let filtered = allExtensions.filter(ext => {
    const matchesSearch = ext.name.toLowerCase().includes(searchTerm) ||
                          (ext.description && ext.description.toLowerCase().includes(searchTerm));

    // Filter by enabled/disabled status
    let matchesStatus = true;
    if (filterValue === 'enabled') {
      matchesStatus = ext.enabled;
    } else if (filterValue === 'disabled') {
      matchesStatus = !ext.enabled;
    }

    // Filter by permissions
    let matchesPermissions = true;
    if (permissionsFilter !== 'all') {
      const extPermissions = ext.permissions || [];
      matchesPermissions = extPermissions.some(p =>
        p.toLowerCase().includes(permissionsFilter.toLowerCase())
      );
    }

    return matchesSearch && matchesStatus && matchesPermissions;
  });

  // Sort extensions
  filtered.sort((a, b) => {
    switch (sortValue) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'enabled':
        if (a.enabled === b.enabled) return a.name.localeCompare(b.name);
        return a.enabled ? -1 : 1;
      case 'type':
        const typeA = a.type || '';
        const typeB = b.type || '';
        if (typeA === typeB) return a.name.localeCompare(b.name);
        return typeA.localeCompare(typeB);
      case 'risk':
        const riskA = calculateRiskScore(a).score;
        const riskB = calculateRiskScore(b).score;
        if (riskA === riskB) return a.name.localeCompare(b.name);
        return riskB - riskA; // Higher risk first
      default:
        return a.name.localeCompare(b.name);
    }
  });

  displayExtensions(filtered);
}

function displayExtensions(extensions) {
  const container = document.getElementById('extensions-list');

  if (extensions.length === 0) {
    container.innerHTML = '<div class="no-results">No extensions found</div>';
    return;
  }

  container.innerHTML = extensions.map(ext => createExtensionCard(ext)).join('');

  // Add toggle event listeners for enable/disable buttons
  container.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = e.target.dataset.id;
      const enabled = e.target.dataset.enabled === 'true';
      await toggleExtension(id, !enabled);
    });
  });

  // Add click event listeners for collapsible headers
  container.querySelectorAll('.extension-header.clickable').forEach(header => {
    header.addEventListener('click', (e) => {
      const toggleId = header.dataset.toggleId;
      const content = document.getElementById(`content-${toggleId}`);
      const card = header.closest('.extension-card');

      if (content && card) {
        card.classList.toggle('collapsed');
      }
    });
  });

  // Add click event listeners for options buttons
  container.querySelectorAll('.options-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const optionsUrl = e.target.dataset.optionsUrl;
      if (optionsUrl) {
        chrome.tabs.create({ url: optionsUrl });
      }
    });
  });

  // Add click event listeners for expandable permissions
  container.querySelectorAll('.perm-expand').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = e.target.dataset.type;
      const extId = e.target.dataset.extId;
      const hidden = document.getElementById(`perm-hidden-${type}-${extId}`);
      const collapse = document.getElementById(`perm-collapse-${type}-${extId}`);

      if (hidden && collapse) {
        hidden.style.display = 'inline';
        collapse.style.display = 'inline';
        e.target.style.display = 'none';
      }
    });
  });

  container.querySelectorAll('.perm-collapse').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.target.id;
      const match = id.match(/perm-collapse-(perms|hosts)-(.+)/);
      if (match) {
        const type = match[1];
        const extId = match[2];
        const hidden = document.getElementById(`perm-hidden-${type}-${extId}`);
        const expand = document.querySelector(`.perm-expand[data-type="${type}"][data-ext-id="${extId}"]`);

        if (hidden && expand) {
          hidden.style.display = 'none';
          e.target.style.display = 'none';
          expand.style.display = 'inline';
        }
      }
    });
  });
}

function createExtensionCard(ext) {
  const iconUrl = getIconUrl(ext);
  const statusClass = ext.enabled ? 'enabled' : 'disabled';
  const statusText = ext.enabled ? 'Enabled' : 'Disabled';
  const collapsedClass = settings.defaultCollapsed ? 'collapsed' : '';

  // Calculate risk score
  const riskInfo = calculateRiskScore(ext);

  // Format permissions with severity badges
  const formatPermissionWithSeverity = (perm) => {
    const severity = getPermissionSeverity(perm);
    return `<span class="perm-badge perm-${severity}">${escapeHtml(perm)}</span>`;
  };

  // Sort permissions by criticality (high -> medium -> low)
  const sortByСriticality = (perms) => {
    if (!perms || perms.length === 0) return [];
    return [...perms].sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      const sevA = severityOrder[getPermissionSeverity(a)];
      const sevB = severityOrder[getPermissionSeverity(b)];
      if (sevA !== sevB) return sevA - sevB;
      return a.localeCompare(b);
    });
  };

  const sortedPermissions = sortByСriticality(ext.permissions);
  const sortedHostPermissions = sortByСriticality(ext.hostPermissions);

  // Generate permissions HTML with expandable functionality
  const generateExpandablePerms = (perms, limit, type) => {
    if (!perms || perms.length === 0) {
      return '<span class="perm-none">None</span>';
    }

    const visiblePerms = perms.slice(0, limit);
    const hiddenPerms = perms.slice(limit);

    let html = visiblePerms.map(formatPermissionWithSeverity).join(' ');

    if (hiddenPerms.length > 0) {
      const hiddenHtml = hiddenPerms.map(formatPermissionWithSeverity).join(' ');
      html += `<span class="perm-expand" data-type="${type}" data-ext-id="${ext.id}">+${hiddenPerms.length} more</span>`;
      html += `<span class="perm-hidden" id="perm-hidden-${type}-${ext.id}" style="display: none;"> ${hiddenHtml}</span>`;
      html += `<span class="perm-collapse" id="perm-collapse-${type}-${ext.id}" style="display: none;">Show less</span>`;
    }

    return html;
  };

  const permissionsHtml = generateExpandablePerms(sortedPermissions, 5, 'perms');
  const hostPermissionsHtml = generateExpandablePerms(sortedHostPermissions, 3, 'hosts');

  return `
    <div class="extension-card ${statusClass} ${collapsedClass}" data-id="${ext.id}">
      <div class="extension-header clickable" data-toggle-id="${ext.id}">
        <img src="${iconUrl}" alt="${ext.name}" class="extension-icon" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><rect fill=%22%23ccc%22 width=%2224%22 height=%2224%22 rx=%224%22/></svg>'">
        <div class="extension-title">
          <h3>${escapeHtml(ext.name)}</h3>
          <span class="version">v${ext.version}</span>
        </div>
        <span class="risk-badge risk-${riskInfo.level}" title="Risk Score: ${riskInfo.score}/100">${riskInfo.label}</span>
        <span class="status ${statusClass}">${statusText}</span>
        <span class="collapse-icon">&#9660;</span>
      </div>

      <div class="collapsible-content" id="content-${ext.id}">
        <p class="description">${escapeHtml(ext.description || 'No description available')}</p>

        <div class="details">
        <div class="detail-row">
          <span class="label">Risk Score:</span>
          <span class="value">
            <span class="risk-score-display risk-${riskInfo.level}">${riskInfo.score}/100</span>
            <span class="risk-breakdown">(${riskInfo.highCount || 0} high, ${riskInfo.mediumCount || 0} medium, ${riskInfo.lowCount || 0} low)</span>
          </span>
        </div>
        <div class="detail-row">
          <span class="label">ID:</span>
          <span class="value id-value">${ext.id}</span>
        </div>
        <div class="detail-row">
          <span class="label">Type:</span>
          <span class="value">${formatType(ext.type)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Install Type:</span>
          <span class="value">${formatInstallType(ext.installType)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Permissions:</span>
          <span class="value perm-list">${permissionsHtml}</span>
        </div>
        <div class="detail-row">
          <span class="label">Host Access:</span>
          <span class="value perm-list">${hostPermissionsHtml}</span>
        </div>
        ${ext.homepageUrl ? `
        <div class="detail-row">
          <span class="label">Homepage:</span>
          <a href="${ext.homepageUrl}" target="_blank" class="value link">${truncateUrl(ext.homepageUrl)}</a>
        </div>
        ` : ''}
        <div class="detail-row">
          <span class="label">Offline:</span>
          <span class="value">${ext.offlineEnabled ? 'Yes' : 'No'}</span>
        </div>
      </div>

      <div class="actions">
        ${ext.mayDisable ? `
        <button class="toggle-btn ${ext.enabled ? 'disable' : 'enable'}"
                data-id="${ext.id}"
                data-enabled="${ext.enabled}">
          ${ext.enabled ? 'Disable' : 'Enable'}
        </button>
        ` : '<span class="cannot-disable">Cannot be disabled</span>'}
        ${ext.optionsUrl ? `
        <button class="options-btn" data-options-url="${ext.optionsUrl}">
          Options
        </button>
        ` : ''}
      </div>
      </div>
    </div>
  `;
}

function getIconUrl(ext) {
  if (ext.icons && ext.icons.length > 0) {
    // Get the largest icon available
    const largestIcon = ext.icons.reduce((prev, current) =>
      (prev.size > current.size) ? prev : current
    );
    return largestIcon.url;
  }
  return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect fill="%23ccc" width="24" height="24" rx="4"/></svg>';
}

function formatType(type) {
  const types = {
    'extension': 'Extension',
    'hosted_app': 'Hosted App',
    'packaged_app': 'Packaged App',
    'legacy_packaged_app': 'Legacy App',
    'theme': 'Theme',
    'login_screen_extension': 'Login Screen Extension'
  };
  return types[type] || type;
}

function formatInstallType(installType) {
  const types = {
    'admin': 'Admin',
    'development': 'Developer Mode',
    'normal': 'Chrome Web Store',
    'sideload': 'Sideloaded',
    'other': 'Other'
  };
  return types[installType] || installType;
}

function truncateUrl(url) {
  if (url.length > 40) {
    return url.substring(0, 37) + '...';
  }
  return url;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function toggleExtension(id, enable) {
  try {
    await chrome.management.setEnabled(id, enable);
    await loadExtensions();
  } catch (error) {
    console.error('Error toggling extension:', error);
    alert('Failed to toggle extension: ' + error.message);
  }
}

// Profile management functions
function createProfile() {
  const nameInput = document.getElementById('new-profile-name');
  const name = nameInput.value.trim();

  if (!name) {
    alert('Please enter a profile name');
    return;
  }

  if (settings.profiles[name]) {
    alert('A profile with this name already exists');
    return;
  }

  // Save current extension states
  const profile = {};
  allExtensions.forEach(ext => {
    if (ext.mayDisable) {
      profile[ext.id] = ext.enabled;
    }
  });

  settings.profiles[name] = profile;
  saveSettings();
  updateProfileDropdown();

  // Select the new profile
  document.getElementById('profile-select').value = name;
  nameInput.value = '';

  alert(`Profile "${name}" created successfully`);
}

function saveCurrentProfile() {
  const select = document.getElementById('profile-select');
  const name = select.value;

  if (!name) {
    alert('Please select a profile to save to');
    return;
  }

  // Update profile with current extension states
  const profile = {};
  allExtensions.forEach(ext => {
    if (ext.mayDisable) {
      profile[ext.id] = ext.enabled;
    }
  });

  settings.profiles[name] = profile;
  saveSettings();

  alert(`Profile "${name}" saved successfully`);
}

async function loadProfile() {
  const select = document.getElementById('profile-select');
  const name = select.value;

  if (!name) {
    alert('Please select a profile to load');
    return;
  }

  const profile = settings.profiles[name];
  if (!profile) {
    alert('Profile not found');
    return;
  }

  // Apply profile settings
  const promises = [];
  for (const ext of allExtensions) {
    if (ext.mayDisable && profile.hasOwnProperty(ext.id)) {
      if (ext.enabled !== profile[ext.id]) {
        promises.push(chrome.management.setEnabled(ext.id, profile[ext.id]));
      }
    }
  }

  try {
    await Promise.all(promises);
    await loadExtensions();
    alert(`Profile "${name}" loaded successfully`);
  } catch (error) {
    console.error('Error loading profile:', error);
    alert('Failed to load profile: ' + error.message);
  }
}

function deleteProfile() {
  const select = document.getElementById('profile-select');
  const name = select.value;

  if (!name) {
    alert('Please select a profile to delete');
    return;
  }

  if (!confirm(`Are you sure you want to delete the profile "${name}"?`)) {
    return;
  }

  delete settings.profiles[name];
  saveSettings();
  updateProfileDropdown();

  alert(`Profile "${name}" deleted successfully`);
}
