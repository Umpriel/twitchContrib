// safely handle module imports
let isModulesLoaded = false;

export function ensureModulesLoaded() {
  if (isModulesLoaded) return;
  
  // Force-load modules in the right order
  if (typeof window === 'undefined') {
    console.log('Loading server modules...');
    require('./db');
    require('./twitchAuth');
    require('./contributionTracking');
    require('./server-init');
    // Importing startup conditionally to avoid circular dependencies
    try {
      require('../pages/api/_startup');
    } catch (e: any) {
      console.log('Startup module not loaded yet:', e.message);
    }
  }
  
  isModulesLoaded = true;
}

// Call this immediately
ensureModulesLoaded(); 