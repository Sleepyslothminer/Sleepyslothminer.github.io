// service-worker.js - Place this file in your root directory

// Cache name for offline functionality
const CACHE_NAME = 'sleepy-sloth-miner-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js' 
];

// Install service worker and cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  // Force the waiting service worker to become active
  self.skipWaiting();
});

// Activate and clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Variables for background mining
let isBackgroundMining = false;
let userId = null;
let miningInterval = null;
let lastReportTime = 0;
const REPORT_INTERVAL = 30000; // 30 seconds
let totalHashesMined = 0;

// Handle messages from main application
self.addEventListener('message', event => {
  const message = event.data;
  
  if (message.action === 'startMining') {
    userId = message.userId;
    isBackgroundMining = true;
    console.log('[Service Worker] Started background mining for user:', userId);
    
    // Start background mining
    startBackgroundMining();
    
    // Respond to the client
    if (event.source) {
      event.source.postMessage({
        action: 'miningStarted',
        status: 'Mining started in background'
      });
    }
  } 
  else if (message.action === 'stopMining') {
    stopBackgroundMining();
    
    // Respond to the client
    if (event.source) {
      event.source.postMessage({
        action: 'miningStopped',
        status: 'Mining stopped in background',
        totalHashesMined
      });
    }
  }
  else if (message.action === 'ping') {
    // Keep-alive ping from main thread
    if (event.source) {
      event.source.postMessage({
        action: 'pong',
        isBackgroundMining,
        totalHashesMined
      });
    }
  }
});

// Background mining functionality
function startBackgroundMining() {
  if (miningInterval) {
    clearInterval(miningInterval);
  }
  
  totalHashesMined = 0;
  
  // Low-intensity mining to preserve battery
  miningInterval = setInterval(() => {
    if (!isBackgroundMining || !userId) {
      return;
    }
    
    // Perform mining operations
    const hashesThisRound = performMining(100); // Limit to 100 hashes per cycle
    totalHashesMined += hashesThisRound;
    
    // Report to Firebase periodically
    const now = Date.now();
    if (now - lastReportTime > REPORT_INTERVAL) {
      reportMiningProgress();
      lastReportTime = now;
    }
  }, 5000); // Run every 5 seconds
}

function stopBackgroundMining() {
  isBackgroundMining = false;
  if (miningInterval) {
    clearInterval(miningInterval);
    miningInterval = null;
  }
  
  // Final report
  reportMiningProgress();
  console.log('[Service Worker] Background mining stopped');
}

// Simple mining simulation
function performMining(iterations) {
  let hashCount = 0;
  
  // Perform a lighter version of the hash calculation
  for (let i = 0; i < iterations; i++) {
    let hash = 0;
    const str = userId + "-" + totalHashesMined + "-" + Date.now();
    for (let j = 0; j < str.length; j++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(j);
      hash |= 0;
    }
    hashCount++;
  }
  
  return hashCount;
}

// Report mining progress using fetch API (since we can't use Firebase directly)
function reportMiningProgress() {
  if (!userId || totalHashesMined === 0) return;
  
  // We can't use Firebase directly in a service worker,
  // so send data to a server endpoint
  fetch('/api/report-mining', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      totalHashesMined,
      timestamp: Date.now(),
      isBackground: true
    })
  }).catch(error => {
    console.error('[Service Worker] Error reporting mining progress:', error);
  });
  
  // If fetch isn't possible, try to notify any active clients
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        action: 'reportMiningProgress',
        totalHashesMined,
        timestamp: Date.now()
      });
    });
  });
}

// Add this to your service-worker.js
self.addEventListener('fetch', event => {
    event.respondWith(
      fetch(event.request)
        .catch(error => {
          console.log('Fetch failed; returning offline page instead.', error);
          // Return a fallback response or handle the error gracefully
          return new Response('Network error occurred', {
            status: 503,
            headers: {'Content-Type': 'text/plain'}
          });
        })
    );
  });

// Listen for periodic sync events (if supported)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'mining-sync') {
    event.waitUntil(reportMiningProgress());
  }
});

// Handle push notifications (optional)
self.addEventListener('push', event => {
  const data = event.data.json();
  
  self.registration.showNotification('Sleepy Sloth Miner', {
    body: data.message || 'Mining update available',
    icon: '/images/sloth-icon.png'
  });
});
