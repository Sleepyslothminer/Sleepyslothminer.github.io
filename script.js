function logDebug(...args) {
    // Check if debug mode is enabled via localStorage
    const debugEnabled = localStorage.getItem('debugMode') === 'true';
    
    // If debug mode is enabled, log to console with timestamp
    if (debugEnabled) {
      const timestamp = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm format
      console.log(`[DEBUG ${timestamp}]`, ...args);
    }
  }
// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          logDebug('ServiceWorker registration successful with scope: ', registration.scope);
          
          // Add event listeners for service worker updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            logDebug('Service worker update found!');
            
            newWorker.addEventListener('statechange', () => {
              logDebug('Service worker state:', newWorker.state);
            });
          });
          
          // Set up message channel to communicate with the service worker
          setupServiceWorkerMessaging();
        })
        .catch(error => {
          console.error('ServiceWorker registration failed: ', error);
        });
    });
  }
     // Handle service worker messages
     navigator.serviceWorker.addEventListener('message', event => {
        console.log('Message from service worker:', event.data);
        
        if (event.data.action === 'reportMiningProgress') {
          // Update UI with background mining progress
          updateBackgroundMiningStats(event.data);
        }
      });
    
    // Function to setup communication with service worker
    function setupServiceWorkerMessaging() {
      // Send ping every minute to keep service worker alive
      setInterval(() => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            action: 'ping',
            timestamp: Date.now()
          });
        }
      }, 60000);
    }
  
const firebaseConfig = {
    apiKey: "AIzaSyBbIeF_VtKI6z60oZmnn0TgKjPx8kv61kQ",
    authDomain: "sleepyslothminer-73351.firebaseapp.com",
    projectId: "sleepyslothminer-73351",
    storageBucket: "sleepyslothminer-73351.firebasestorage.app",
    messagingSenderId: "315791075690",
    appId: "1:315791075690:web:dd5563deef281397999d13"
};
if (!firebase.apps.length) 
  firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

let hashCount = 0;
let totalHashes = 0;
let currentHashRate = 0
let hashRateInterval;
let hashRateHistory = [];
let lastPointUpdate = 0;
let hashWorkerInterval;
const TARGET_HASH_RATE = 1000
let userId = null;
let points = 0;
let mining = false;
let miningInterval;
let countdownInterval;
const dailyPoints = 30;
let miningWorker;


const buttons = ["mineButton", "stopButton", "likeButton", "submitSuggestion", "verifyTwitter", "verifyRetweet", "verifyTelegram"];
// Modified checkMiningStatus function
function checkMiningStatus() {
    if (!userId) {
      logDebug("No userId, can't check mining status");
      return;
    }
    
    logDebug("Checking mining status for user", userId);
    
    db.ref("users/" + userId).once("value")
      .then(snapshot => {
        if (!snapshot.exists()) {
          logDebug("User data not found in Firebase");
          return;
        }
        
        const userData = snapshot.val();
        logDebug("User data from Firebase:", userData);
        
        // Clear any existing intervals to avoid duplicates
        if (miningInterval) clearInterval(miningInterval);
        if (hashRateInterval) clearInterval(hashRateInterval);
        if (countdownInterval) clearInterval(countdownInterval);
        if (hashWorkerInterval) clearInterval(hashWorkerInterval);
        
        // Check if mining was active
        if (userData.miningActive && userData.miningStartTime) {
          const now = Date.now();
          const miningStartTime = userData.miningStartTime;
          const miningEndTime = miningStartTime + 24 * 60 * 60 * 1000;
          const timeRemaining = miningEndTime - now;
          
          logDebug(`Mining was active. Time remaining: ${Math.floor(timeRemaining/1000/60)} minutes`);
          
          if (timeRemaining > 0) {
            // Update localStorage with current state
            localStorage.setItem("miningStartTime", miningStartTime.toString());
            localStorage.setItem("miningEndTime", miningEndTime.toString());
            localStorage.setItem("miningActive", "true");
            
            // Update UI first
            document.getElementById("mineButton").disabled = true;
            document.getElementById("stopButton").disabled = false;
            document.getElementById("status").innerText = "⏳ Mining active...";
            
            // IMPORTANT: Must call these functions in this specific order
            logDebug("Restarting mining processes...");
            
            // 1. First start the countdown to update the UI
            startCountdown();
            
            // 2. Then start the main mining process
            startMiningProcess();
            
            // 3. Finally initialize the worker
            startBackgroundMining();
            
            logDebug("✅ Mining processes restarted after page reload");
          } else {
            logDebug("Mining session expired, stopping");
            stopMining();
          }
        } else {
          logDebug("No active mining session found");
        }
      })
      .catch(error => {
        console.error("Error checking mining status:", error);
      });
  }
  
  auth.onAuthStateChanged((user) => {
    const likeButton = document.getElementById("likeButton");

    if (user) {
        userId = user.uid;
        checkIfLiked();

        // ✅ Show the ad only after successful login
        showAdAfterLogin();

        db.ref("users/" + userId).once("value").then((snapshot) => {
            const userData = snapshot.val();
            const now = Date.now();

            if (userData?.miningActive && userData?.miningStartTime) {
                const miningStart = userData.miningStartTime;
                const timeElapsed = now - miningStart;
                const maxMiningDuration = 24 * 60 * 60 * 1000; // 24h in ms

                const effectiveMiningTime = Math.min(timeElapsed, maxMiningDuration);
                const pointsEarned = Math.floor(effectiveMiningTime / (1000 * 60)); // 1 point/minute

                if (pointsEarned > 0) {
                    const newPoints = (userData.points || 0) + pointsEarned;

                    // Reset mining status
                    db.ref("users/" + userId).update({
                        points: newPoints,
                        miningActive: false,
                        miningStartTime: null
                    });

                    // Update UI
                    document.getElementById("pointsBalance").innerText = newPoints;
                    document.getElementById("status").innerText = `⛏️ You mined ${pointsEarned} points while away!`;
                    console.log(`💸 Mined while offline: ${pointsEarned} points`);
                } else {
                    document.getElementById("status").innerText = `⏳ Mining session is still running...`;
                }
            }
        });

    } else {
        // User is signed out
        userId = null;
        likeButton.disabled = true;
        likeButton.textContent = "👍 Like";
        likeButton.style.opacity = "1";

        // ❌ Hide the ad if user is not logged in
        document.getElementById('ad-wrapper').style.display = 'none';
    }
});

// ✅ Your likePost and checkIfLiked functions
function likePost() {
    if (!userId) {
        alert("⚠️ Please log in first!");
        return;
    }

    db.ref("userLikes").child(userId).once("value").then((snapshot) => {
        if (snapshot.exists()) {
            alert("You already liked this post!");
        } else {
            db.ref("userLikes").child(userId).set(true);
            db.ref("likes").transaction((likes) => (likes || 0) + 1);

            const likeButton = document.getElementById("likeButton");
            likeButton.disabled = true;
            likeButton.textContent = "👍 Liked!";
            likeButton.style.opacity = "0.7";
        }
    });
}

function checkIfLiked() {
    if (!userId) return;

    const likeButton = document.getElementById("likeButton");

    db.ref("userLikes").child(userId).once("value").then((snapshot) => {
        const liked = snapshot.exists();
        likeButton.disabled = liked;
        likeButton.textContent = liked ? "👍 Liked!" : "👍 Like";
        likeButton.style.opacity = liked ? "0.7" : "1";
    });

    db.ref("likes").on("value", (snapshot) => {
        document.getElementById("likeCount").innerText = snapshot.val() || 0;
    });
}
document.getElementById("likeButton").addEventListener("click", likePost);

// ✅ Disable buttons & show login alert before login
buttons.forEach((btnId) => {
    let btn = document.getElementById(btnId);
    if (btn) {
        btn.disabled = true; // Keep buttons disabled

        // Show alert when clicked before login
        btn.addEventListener("click", function (event) {
            if (!userId) { // Ensure user is not logged in
                event.preventDefault(); // Prevent default action
                alert("⚠️ Please Google Sign-In first!"); // Show alert
            }
        });
    }
});
// ✅ Show alert before login
function showLoginAlert(event) {
    alert("⚠️ Please log in to Google first!");
    event.preventDefault();
}

// ✅ Google Sign-In Function
function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    auth.signInWithPopup(provider)
        .then((result) => {
            userId = result.user.uid;
            document.getElementById("user").innerText = `Logged in as: ${result.user.displayName}`;

            enableButtons(); // Enable all buttons after login

            // Load user data
            db.ref("users/" + userId).once("value").then((snapshot) => {
                if (snapshot.exists()) {
                    let userData = snapshot.val();
                    document.getElementById("pointsBalance").innerText = userData.points || 0;
                    document.getElementById("walletBalance").innerText = userData.wallet || 0;
                } else {
                    db.ref("users/" + userId).set({ 
                        points: 0, 
                        wallet: 0, 
                        miningActive: false,
                        lastLogin: new Date().toISOString()
                    });
                } 
            });
            // REMOVE THE "refe" LINE THAT WAS HEREs
        })
        .catch((error) => {
            let errorMessage = "Sign-in failed. ";
            switch(error.code) {
                case 'auth/popup-closed-by-user':
                    errorMessage += "You closed the sign-in window.";
                    break;
                case 'auth/cancelled-popup-request':
                    errorMessage += "Sign-in was cancelled.";
                    break;
                default:
                    errorMessage += error.message;
            }
            console.error("Google Sign-In Error:", error);
            alert(errorMessage);
        });
}
// ✅ Enable buttons after login & remove login alert
function enableButtons() {
    console.log("✅ Enabling buttons...");
    buttons.forEach((btnId) => {
        let btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = false; // Enable all buttons
            console.log(`Enabled: ${btnId}`);

            // Remove login alert event
            btn.replaceWith(btn.cloneNode(true)); // This removes previous event listeners
        }
    });

    // ✅ Explicitly enable mining buttons after login
    document.getElementById("mineButton").disabled = false;
    document.getElementById("stopButton").disabled = true; // Stop is only enabled after starting

    // ✅ Attach event listeners properly
    let mineBtn = document.getElementById("mineButton");
    if (mineBtn) {
        console.log("⛏️ Attaching Start Mining button event");
        mineBtn.addEventListener("click", startMining);
    }

    let stopBtn = document.getElementById("stopButton");
    if (stopBtn) {
        console.log("🛑 Attaching Stop Mining button event");
        stopBtn.addEventListener("click", stopMining);
    }
}

    // ✅ Ensure this function exists before attaching

    let submitBtn = document.getElementById("submitSuggestion");
    if (submitBtn) submitBtn.addEventListener("click", submitSuggestion);


// ✅ Start Mining Function
// Modified startMining function
async function startMining() {
    // Validate user is logged in
    if (!userId) {
        alert("⚠️ Please log in first!");
        return;
    }

    // Show loading state immediately
    const miningLoader = document.getElementById("mining-loader");
    const mineButton = document.getElementById("mineButton");
    const stopButton = document.getElementById("stopButton");
    
    if (miningLoader) miningLoader.style.display = "block";
    if (mineButton) mineButton.disabled = true;
    if (stopButton) stopButton.disabled = true;

    try {
        console.log("⛏️ Starting mining process with userId:", userId);
        
        // Get current points from Firebase
        const snapshot = await db.ref("users/" + userId).once("value");
        const userData = snapshot.val() || {};
        const currentPoints = userData.points || 0;
        
        console.log("Current points before mining:", currentPoints);
        
        // Set mining times
        const miningStartTime = Date.now();
        const miningEndTime = miningStartTime + 24 * 60 * 60 * 1000; // 24 hours

        // Save to Firebase
        await db.ref("users/" + userId).update({
            miningStartTime: firebase.database.ServerValue.TIMESTAMP,
            miningActive: true,
            lastActivity: firebase.database.ServerValue.TIMESTAMP,
            points: currentPoints // Ensure points are consistent
        });

        localStorage.setItem("miningStartTime", miningStartTime.toString());
        localStorage.setItem("miningEndTime", miningEndTime.toString());
        localStorage.setItem("miningActive", "true");

        console.log("✅ Mining session initialized");
        
        // Start mining process (main thread)
        startMiningProcess();
        
        // Start background worker as well
        startBackgroundMining();
        
        // Initialize service worker for background mining
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            try {
                // Notify service worker to start background mining
                navigator.serviceWorker.controller.postMessage({
                    action: 'startMining',
                    userId: userId,
                    miningStartTime: miningStartTime,
                    miningEndTime: miningEndTime
                });
                console.log("✅ Service worker notified to start background mining");
                
                // Update UI to show background mining is active
                const bgStatusEl = document.getElementById("bgMiningStatus");
                if (bgStatusEl) {
                    bgStatusEl.innerText = "Background mining: Active";
                    bgStatusEl.style.color = "#4caf50"; // Green
                }
            } catch (err) {
                console.warn("⚠️ Could not start service worker mining:", err);
            }
        } else {
            console.log("ℹ️ Service worker not available for background mining");
        }

        // Update UI
        if (mineButton) mineButton.disabled = true;
        if (stopButton) stopButton.disabled = false;
        
        const statusEl = document.getElementById("status");
        if (statusEl) statusEl.innerText = "⏳ Mining active...";
        
        // Start countdown timer
        startCountdown();
        
        // Debug state after starting
        setTimeout(debugMiningState, 2000);

    } catch (error) {
        console.error("❌ Mining start failed:", error);
        
        const statusEl = document.getElementById("status");
        if (statusEl) statusEl.innerText = "❌ Failed to start mining";
        
        // Clean up if failed
        stopMiningProcess();
        if (miningWorker) {
            try {
                miningWorker.postMessage({ action: "stop" });
                miningWorker.terminate();
                miningWorker = null;
            } catch (e) {
                console.error("Error terminating worker:", e);
            }
        }
        
        // Reset UI
        if (mineButton) mineButton.disabled = false;
        if (stopButton) stopButton.disabled = true;
    } finally {
        // Always hide loader
        if (miningLoader) miningLoader.style.display = "none";
    }
}// Modified startBackgroundMining function
function startBackgroundMining() {
    if (typeof Worker !== "undefined") {
        // Stop any existing worker first to avoid duplicates
        if (miningWorker) {
            try {
                miningWorker.terminate();
            } catch (e) {
                console.error("Error terminating worker:", e);
            }
            miningWorker = null;
        }
        
        // Create worker with improved code
        const workerCode = `
            // Worker-specific variables to avoid conflicts with main thread
            let workerHashCount = 0;
            let workerTotalHashes = 0;
            let workerStartTime = Date.now();
            let workerInterval;
            let isRunning = false;
            let isBackgroundMode = false;
            
            self.onmessage = function(e) {
                const action = e.data.action;
                const userId = e.data.userId;
                
                if (action === "start") {
                    // Set background mode flag
                    isBackgroundMode = !!e.data.background;
                    
                    // If already running, just update the mode
                    if (isRunning) {
                        return;
                    }
                    
                    isRunning = true;
                    workerStartTime = Date.now();
                    
                    // Clear any existing interval
                    if (workerInterval) {
                        clearInterval(workerInterval);
                    }
                    
                    // Set up processing interval - slower in background
                    const intervalTime = isBackgroundMode ? 3000 : 1000;
                    const iterations = isBackgroundMode ? 2000 : 5000;
                    
                    workerInterval = setInterval(() => {
                        // Mining simulation - lighter when in background
                        for (let i = 0; i < iterations; i++) {
                            workerHashCount++;
                            workerTotalHashes++;
                            
                            // Hash calculation
                            let hash = 0;
                            const str = userId + "-" + workerTotalHashes + "-" + Date.now();
                            for (let j = 0; j < str.length; j++) {
                                hash = ((hash << 5) - hash) + str.charCodeAt(j);
                                hash |= 0;
                            }
                        }
                        
                        const currentTime = Date.now();
                        const elapsed = (currentTime - workerStartTime) / 1000;
                        const hashRate = elapsed > 0 ? Math.floor(workerHashCount / elapsed) : 0;
                        
                        // Don't reset count for more accurate rates over time
                        
                        // Only send updates every 3 seconds when in background
                        // to reduce message frequency
                        const shouldUpdate = !isBackgroundMode || (currentTime % 3000 < 100);
                        
                        if (shouldUpdate) {
                            self.postMessage({ 
                                hashRate, 
                                totalHashes: workerTotalHashes,
                                timestamp: currentTime,
                                userId: userId,
                                isBackground: isBackgroundMode
                            });
                        }
                    }, intervalTime);
                }
                else if (action === "stop") {
                    if (workerInterval) {
                        clearInterval(workerInterval);
                        workerInterval = null;
                    }
                    isRunning = false;
                    // Send final stats before stopping
                    self.postMessage({
                        final: true,
                        totalHashes: workerTotalHashes,
                        timestamp: Date.now(),
                        userId: userId
                    });
                }
            };
        `;

        const blob = new Blob([workerCode], { type: "application/javascript" });
        miningWorker = new Worker(URL.createObjectURL(blob));

        // Improved message handler with Firebase throttling
        let lastFirebaseUpdate = 0;
        const FIREBASE_UPDATE_INTERVAL = 10000; // 10 seconds

        miningWorker.onmessage = function(e) {
            if (!e.data || !userId) return;
            
            // Update hashCount from worker for UI display
            if (e.data.hashRate) {
                // Add to hashCount rather than replacing it
                hashCount += e.data.hashRate;
                
                // Update UI immediately with worker data
                const hashRateElement = document.getElementById("hashRateDisplay");
                if (hashRateElement) {
                    // Don't directly use worker hash rate, use our smoothed calculation
                    // from updateHashRateDisplay instead
                }
                
                if (document.getElementById("totalHashes") && e.data.totalHashes) {
                    document.getElementById("totalHashes").textContent = e.data.totalHashes.toLocaleString();
                    // Update our total hashes to match worker's
                    totalHashes = e.data.totalHashes;
                }
            }
            
            // Throttle Firebase updates to prevent rate limiting
            const now = Date.now();
            if (now - lastFirebaseUpdate > FIREBASE_UPDATE_INTERVAL || e.data.final) {
                console.log("💾 Updating Firebase with worker stats");
                // Only update Firebase occasionally or on final update
                const updates = {};
                updates[`users/${userId}/miningStats/${e.data.timestamp}`] = {
                    hashRate: e.data.hashRate || 0,
                    totalHashes: e.data.totalHashes || 0,
                    timestamp: e.data.timestamp
                };
                
                firebase.database().ref().update(updates)
                    .then(() => {
                        console.log("✅ Mining stats synced to Firebase");
                        lastFirebaseUpdate = now;
                    })
                    .catch(error => {
                        console.error("❌ Firebase sync error:", error);
                    });
            }
        };
        // Start the worker with user context
        miningWorker.postMessage({ 
            action: "start",
            userId: userId,
            background: false // Start in foreground mode
        });
        
        console.log("✅ Mining worker started successfully");
        return true;
    } else {
        console.warn("⚠️ Web Workers not supported - falling back to main thread");
        return false;
    }
}
// ✅ Stop Mining & Transfer Points to Wallet
function stopMining() {
    if (!userId) {
        alert("⚠️ Please log in first!");
        return;
    }

    console.log("🛑 Stopping mining...");

    // Stop all mining processes
    stopMiningProcess();
    
    // Stop background worker if it exists
    if (miningWorker) {
        try {
            miningWorker.postMessage({ action: "stop" });
            miningWorker.terminate();
            miningWorker = null;
        } catch (error) {
            console.error("Error stopping worker:", error);
        }
    }
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
            navigator.serviceWorker.controller.postMessage({
                action: 'stopMining',
                userId: userId
            });
            console.log("✅ Service worker notified to stop background mining");
            
            // Update UI to show background mining is inactive
            const bgStatusEl = document.getElementById("bgMiningStatus");
            if (bgStatusEl) {
                bgStatusEl.innerText = "Background mining: Inactive";
                bgStatusEl.style.color = "#999"; // Gray
            }
        } catch (err) {
            console.warn("⚠️ Could not stop service worker mining:", err);
        }
    }
    // Clear all intervals safely
    const intervals = [miningInterval, hashRateInterval, countdownInterval];
    intervals.forEach(interval => {
        if (interval) clearInterval(interval);
    });

    try {
        // Calculate points earned (in minutes for consistency)
        const miningStartTime = parseInt(localStorage.getItem("miningStartTime") || "0");
        const timeMinedMinutes = Math.floor((Date.now() - miningStartTime) / (1000 * 60));
        
        console.log(`⏳ Time Mined: ${timeMinedMinutes} minutes`);

        // Get current balances from UI (fallback to 0 if invalid)
        const currentPoints = parseInt(document.getElementById("pointsBalance")?.innerText || "0") || 0;
        const currentWallet = parseInt(document.getElementById("walletBalance")?.innerText || "0") || 0;
        const newWalletBalance = currentWallet + currentPoints;

        console.log(`💰 New Wallet Balance: ${newWalletBalance}`);

        // Update status safely
        const statusEl = document.getElementById("status");
        if (statusEl) {
            statusEl.innerText = "⛏️ Mining paused. Press Start to begin.";
        }

        // Update Firebase transactionally
        const updates = {
            wallet: newWalletBalance,
            points: 0,
            miningActive: false,
            lastMiningSession: {
                endTime: firebase.database.ServerValue.TIMESTAMP,
                durationMinutes: timeMinedMinutes,
                pointsEarned: currentPoints
            }
        };

        db.ref("users/" + userId).update(updates)
            .then(() => {
                console.log("✅ Mining stopped and wallet updated!");
                
                // Update UI after successful Firebase update
                const walletEl = document.getElementById("walletBalance");
                const pointsEl = document.getElementById("pointsBalance");
                const mineBtn = document.getElementById("mineButton");
                const stopBtn = document.getElementById("stopButton");
                const countdownEl = document.getElementById("countdown");
                
                if (walletEl) walletEl.innerText = newWalletBalance.toString();
                if (pointsEl) pointsEl.innerText = "0";
                if (mineBtn) mineBtn.disabled = false;
                if (stopBtn) stopBtn.disabled = true;
                if (countdownEl) countdownEl.innerText = "";
                
                // Clean up local storage
                localStorage.removeItem("miningStartTime");
                localStorage.removeItem("miningEndTime");
                localStorage.removeItem("miningActive");
            })
            .catch((error) => {
                console.error("❌ Firebase update error:", error);
                alert("Failed to save mining data. Please check your connection.");
            });
    } catch (error) {
        console.error("Error in stopMining:", error);
        const statusEl = document.getElementById("status");
        if (statusEl) statusEl.innerText = "❌ Error stopping mining";
    }
}

// ✅ Function to Continue Mining After Refresh
function startMiningProcess() {
    if (!userId) {
      console.error("❌ No userId found when starting mining process");
      return;
    }
  
    logDebug("Starting mining process for user", userId);
    
    // ALWAYS clear any existing intervals to avoid duplicates
    if (miningInterval) clearInterval(miningInterval);
    if (hashRateInterval) clearInterval(hashRateInterval);
    if (hashWorkerInterval) clearInterval(hashWorkerInterval);
  
    // Main mining interval (for points)
    miningInterval = setInterval(() => {
      logDebug("Mining interval triggered");
      
      // Get current points from Firebase
      db.ref("users/" + userId).once("value").then((snapshot) => {
        if (!snapshot.exists()) {
          console.error("❌ User data not found in Firebase");
          return;
        }
        
        const userData = snapshot.val();
        const currentPoints = userData.points || 0;
        const newPoints = currentPoints + 1;
        
        logDebug(`Mining point update: ${currentPoints} → ${newPoints}`);
        
        // Update Firebase first
        return db.ref("users/" + userId).update({
          points: newPoints,
          lastUpdate: Date.now(),
          miningActive: true // Make sure this stays true
        });
      }).then(() => {
        logDebug("✅ Points successfully updated in Firebase");
        
        // Update status
        const statusEl = document.getElementById("status");
        if (statusEl) {
          statusEl.innerText = `⛏️ Mined 1 point!`;
          
          // Reset status after 2 seconds
          setTimeout(() => {
            if (statusEl && statusEl.innerText === `⛏️ Mined 1 point!`) {
              statusEl.innerText = `⏳ Mining active...`;
            }
          }, 2000);
        }
      }).catch(error => {
        console.error("❌ Failed to update points in Firebase:", error);
      });
    }, 60000); // Every minute
    
    // Start background worker
    const workerStarted = startBackgroundMining();
    logDebug("Worker started:", workerStarted);
  
    // Update UI
    document.getElementById("mineButton").disabled = true;
    document.getElementById("stopButton").disabled = false;
    mining = true;
    
    logDebug("Mining process started successfully");
    
    // Update hash rate display every second
    hashRateInterval = setInterval(updateHashRateDisplay, 1000);
  }
function startHashWorker() {
    let lastUpdate = Date.now();
    
    hashWorkerInterval = setInterval(() => {
        const now = Date.now();
        const timeDiff = now - lastUpdate;
        
        // Calculate how many hashes to perform to maintain target rate
        const targetHashes = Math.floor((TARGET_HASH_RATE * timeDiff) / 100);
        
        // Perform the hashes
        for (let i = 0; i < targetHashes; i++) {
            calculateHash(`sloth-miner-${totalHashes}`);
            hashCount++;
            totalHashes++;
        }
        
        lastUpdate = now;
    }, 100); // Update every 100ms for smooth hashing
}

function updateHashRate() {
    // Calculate current hash rate (hashes per second)
    currentHashRate = hashCount;
    hashCount = 0; // Reset counter
    
    // Maintain history for smoothing
    hashRateHistory.push(currentHashRate);
    if (hashRateHistory.length > 5) {
        hashRateHistory.shift();
    }
    
    // Calculate average hash rate
    const avgHashRate = Math.floor(hashRateHistory.reduce((a, b) => a + b, 0) / hashRateHistory.length);
    
    // Update UI - FIXED: Changed totalHashesDisplay to totalHashes
    document.getElementById("hashRateDisplay").innerText = avgHashRate.toLocaleString();
    document.getElementById("totalHashes").innerText = totalHashes.toLocaleString(); // Fixed this line
}
function stopMiningProcess() {
    clearInterval(miningInterval);
    clearInterval(hashRateInterval);
    clearInterval(hashWorkerInterval);
    
    // Update UI
    document.getElementById("mineButton").disabled = false;
    document.getElementById("stopButton").disabled = true;
    document.getElementById("status").innerText = "⛏️ Mining stopped";
}

// Optimized hash function
function calculateHash(input) {
    let hash = 0;
    const str = input + userId; // Include user ID for uniqueness
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32-bit integer
    }
    return hash;
}
function updateHashRateDisplay() {
    const now = Date.now();
    
    // Don't reset hashCount to 0 on every update
    // Instead, use a rolling window calculation
    
    // Maintain history for smoothing
    hashRateHistory.push(hashCount);
    if (hashRateHistory.length > 10) { // Use a larger window (10 seconds) for stability
        hashRateHistory.shift();
    }
    
    // Calculate average hash rate over the window
    const avgHashRate = Math.floor(hashRateHistory.reduce((a, b) => a + b, 0) / hashRateHistory.length);
    
    // Update UI with the smoothed hash rate
    const hashRateElement = document.getElementById("hashRateDisplay");
    if (hashRateElement) {
        hashRateElement.innerText = `${avgHashRate.toLocaleString()} H/s`;
    }
    
    // Update total hashes display
    const totalHashesElement = document.getElementById("totalHashes");
    if (totalHashesElement) {
        totalHashesElement.innerText = totalHashes.toLocaleString();
    }
    
    // Reset counter for next second
    hashCount = 0;
    lastPointUpdate = now;
}

// Simple hash function (for display purposes only)
function calculateHash(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}
function startCountdown() {
    function updateCountdown() {
        let now = Date.now();
        let miningEndTime = parseInt(localStorage.getItem("miningEndTime")) || 0;
        let remainingTime = miningEndTime - now;

        if (remainingTime <= 0) {
            clearInterval(miningInterval);
            clearInterval(countdownInterval);
            stopMining();
            return;
        }

        let hours = Math.floor(remainingTime / (1000 * 60 * 60));
        let minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
        let seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

        let countdownEl = document.getElementById("countdown");
        if (countdownEl) {
            countdownEl.innerText = `⏳ Time left: ${hours}h ${minutes}m ${seconds}s`;
        } else {
            console.error("❌ Element with ID 'countdown' not found!");
        }

        // **🔥 Fix Delay Issue:** Instead of using `setInterval`, align with actual time
        let nextUpdate = 1000 - (Date.now() % 1000); // Update at exact second intervals
        setTimeout(updateCountdown, nextUpdate);
    }

    updateCountdown(); // ✅ Run immediately
}

window.onload = function () {
    console.log("🚀 Window loaded. Checking Firebase auth...");

    if (!auth) {
        console.error("❌ Firebase auth is not initialized!");
        return;
    }

    auth.onAuthStateChanged((user) => {
        if (user) {
            userId = user.uid;
            console.log(`✅ User logged in: ${user.displayName} (${userId})`);

            enableButtons(); // Enable all buttons
            checkIfLiked();  // Check if the user liked a post
             
               // CRITICAL: Call this after a short delay to ensure DOM is ready
      setTimeout(() => {
        logDebug("Checking mining status after login...");
        checkMiningStatus();
      }, 1000);

            // ✅ ADD THIS: Real-time points sync for both mining and lottery
            db.ref("users/" + userId + "/points").on("value", (snapshot) => {
                const points = snapshot.val() || 0;
                document.getElementById("pointsBalance").innerText = points;
                document.getElementById("points").innerText = points; // Lottery section
                console.log("🔥 Points updated in real-time:", points);
            });

            let statusEl = document.getElementById("status");
            if (statusEl) {
                statusEl.innerText = "✅ Logged in! Press Start to begin mining.";
            }

            let submitBtn = document.getElementById("submitSuggestion");
            if (submitBtn) {
                submitBtn.onclick = submitSuggestion;
                console.log("✅ Submit button enabled");
            } else {
                console.warn("⚠️ Submit button not found!");
            }

            let likeBtn = document.getElementById("likeButton");
            if (likeBtn) {
                likeBtn.onclick = likePost;
                console.log("✅ Like button enabled");
            } else {
                console.warn("⚠️ Like button not found!");
            }

            let mineBtn = document.getElementById("mineButton");
            let stopBtn = document.getElementById("stopButton");

            if (mineBtn) {
                mineBtn.disabled = false;
                mineBtn.onclick = startMining;
                console.log("✅ Start Mining button enabled");
            } else {
                console.warn("⚠️ Start Mining button not found!");
            }

            if (stopBtn) {
                stopBtn.disabled = true; // Keep disabled until mining starts
                stopBtn.onclick = stopMining;
                console.log("✅ Stop Mining button attached but disabled");
            } else {
                console.warn("⚠️ Stop Mining button not found!");
            }

            db.ref("users/" + userId).once("value").then((snapshot) => {
                if (snapshot.exists()) {
                    let userData = snapshot.val();
                    let storedStartTime = userData.miningStartTime;
                    let miningActive = userData.miningActive;

                    if (miningActive && storedStartTime) {
                        let now = Date.now();
                        let elapsedTime = now - storedStartTime;
                        let remainingTime = 24 * 60 * 60 * 1000 - elapsedTime;

                        if (remainingTime > 0) {
                            localStorage.setItem("miningEndTime", storedStartTime + 24 * 60 * 60 * 1000);

                            let countdownEl = document.getElementById("countdown");
                            if (countdownEl) {
                                let hours = Math.floor(remainingTime / (1000 * 60 * 60));
                                let minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
                                let seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);
                                countdownEl.innerText = `⏳ Time left: ${hours}h ${minutes}m ${seconds}s (Press Start to continue)`;
                            }
                        } else {
                            console.log("⛔ Mining session expired. Resetting...");
                            stopMining();
                        }
                    }
                }
            });
        } else {
            console.log("🚫 User logged out.");
            userId = null;
            disableButtons();
        }
    }); // ✅ Closing bracket for auth.onAuthStateChanged
}; // ✅ Closing bracket for window.onload✅ Missing closing bracket added here!

    // ✅ Toggle Daily Rewards Section
    let dailyToggle = document.getElementById("dailyToggle");
    let dailySection = document.getElementById("dailySection");

    if (dailyToggle && dailySection) {
        dailyToggle.addEventListener("click", function () {
            dailySection.style.display = (dailySection.style.display === "none" || dailySection.style.display === "") ? "block" : "none";
        });
        console.log("✅ Daily Rewards button enabled.");
    } else {
        console.warn("⚠️ Daily Rewards section or button not found!");
    }
// ✅ Functions to enable and disable buttons
function enableButtons() {
    console.log("🔓 Enabling buttons...");

    let mineBtn = document.getElementById("mineButton");
    let stopBtn = document.getElementById("stopButton");
    let submitBtn = document.getElementById("submitSuggestion");
    let likeBtn = document.getElementById("likeButton");

    if (mineBtn) mineBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = false;
    if (likeBtn) likeBtn.disabled = false;
}

function disableButtons() {
    console.log("🔒 Disabling buttons...");

    let mineBtn = document.getElementById("mineButton");
    let stopBtn = document.getElementById("stopButton");
    let submitBtn = document.getElementById("submitSuggestion");
    let likeBtn = document.getElementById("likeButton");

    if (mineBtn) mineBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    if (likeBtn) likeBtn.disabled = true;
}
        // ✅ Referral Tracking & Reward System
// Get referrer from URL
const urlParams = new URLSearchParams(window.location.search);
const referrerIdFromURL = urlParams.get("ref");
let user;

// Firebase Auth listener
auth.onAuthStateChanged((user) => {
    if (user) {
        userId = user.uid;

        // Generate referral link
        const referralLink = `https://sleepyslothminer.github.io/?ref=${userId}`;
        document.getElementById("referralLink").innerText = referralLink;

       

        // Handle referral logic only if there's a referrer
        if (referrerIdFromURL && referrerIdFromURL !== userId) {
            handleReferral(referrerIdFromURL, userId);
        }

        // Optional: Show how many people user referred
        showReferralStats();
    }
});

// Handle referral logic
function handleReferral(referrerId, newUserId) {
    // Check if user already referred
    db.ref(`users/${newUserId}/referredBy`).once("value", (snapshot) => {
        if (!snapshot.exists()) {
            // Make sure the referrer exists
            db.ref(`users/${referrerId}`).once("value", (refSnapshot) => {
                if (refSnapshot.exists()) {
                    // Save referral record
                    db.ref(`users/${referrerId}/referrals/${newUserId}`).set({
                        referredAt: Date.now()
                    });

                    // Reward the referrer
                    db.ref(`users/${referrerId}/points`).once("value", (snapshot) => {
                        let currentPoints = snapshot.val() || 0;
                        db.ref(`users/${referrerId}/points`).set(currentPoints + 150);
                    });

                    // Mark this user as referred
                    db.ref(`users/${newUserId}/referredBy`).set(referrerId);

                    alert("🎉 You signed up using a referral! Your referrer earned 150 points!");
                }
            });
        }
    });
}

// Copy referral link to clipboard
function copyReferral() {
    const link = document.getElementById("referralLink").innerText;
    navigator.clipboard.writeText(link).then(() => {
        alert("📋 Referral link copied!");
    });
}

// Optional: Show how many referrals the user made
function showReferralStats() {
    db.ref(`users/${userId}/referrals`).once("value", (snapshot) => {
        const count = snapshot.numChildren();
        document.getElementById("referralCount").innerText = `Referrals: ${count}`;
    });
}
// ✅ Suggestion Submission Function
function submitSuggestion() {
    if (!userId) {
        alert("⚠️ Please log in first!");
        return;
    }

    const suggestionText = document.getElementById("suggestionText").value.trim();
    if (suggestionText === "") {
        alert("⚠️ Suggestion cannot be empty!");
        return;
    }

    // Push suggestion to Firebase
    db.ref("suggestions").push({
        userId,
        suggestion: suggestionText,
        timestamp: Date.now()
    })
    .then(() => {
        document.getElementById("suggestionText").value = ""; // Clear text area
        document.getElementById("suggestionStatus").innerText = "✅ Suggestion submitted successfully!";
        
        // Clear success message after 3 seconds
        setTimeout(() => {
            document.getElementById("suggestionStatus").innerText = "";
        }, 3000);
    })
    .catch((error) => {
        console.error("❌ Error submitting suggestion:", error);
        document.getElementById("suggestionStatus").innerText = "❌ Submission failed! Please try again.";
    });
}

// Add event listener for the submit button
document.getElementById("submitSuggestion").addEventListener("click", function(e) {
    console.log("Submit button clicked!");
    submitSuggestion(); // Call the function when the button is clicked
});

// Add event listener for the like button
document.getElementById("likeButton").addEventListener("click", function(e) {
    console.log("Like button clicked!");
    likePost(); // Call likePost function when the like button is clicked
});

// ✅ Attach Login Button Event
document.getElementById("loginButton").addEventListener("click", login);
 // Select all navbar items
 const navItems = document.querySelectorAll(".nav-item");

navItems.forEach(item => { 
    item.addEventListener("click", function (event) {
        let taskSection = document.getElementById("taskSection");

        // Check if the Earn button is clicked
        if (this.getAttribute("href") === "earn.html") {
            event.preventDefault(); // Prevent page reload
            
            // Toggle task section visibility
            if (taskSection.style.display === "none" || taskSection.style.display === "") {
                taskSection.style.display = "block"; // Show tasks
            } else {
                taskSection.style.display = "none"; // Hide tasks
            }
        }
    });
});
document.querySelector(".nav-item[href='referrals.html']").addEventListener("click", function (event) {
        event.preventDefault(); // Prevent page reload

        let referralSection = document.getElementById("referralSection");
        if (referralSection.style.display === "none" || referralSection.style.display === "") {
            referralSection.style.display = "block"; // Show referral section
        } else {
            referralSection.style.display = "none"; // Hide referral section
        }
    });

   
// Ensure Firebase is initialized and user login is handled
firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
        // User is signed in
        userId = user.uid;
        enableButtons(); // Enable the submit button after login
        checkIfLiked(); // Check if the user already liked the post
    } else {
        // User is signed out
        userId = null;
        disableButtons(); // Disable the submit button
    }
});
// Function to save Solana wallet in Firebase
function saveWallet() {
    let walletAddress = document.getElementById("solanaWallet").value.trim();

    if (!walletAddress) {
        alert("❌ Please enter a valid Solana wallet address.");
        return;
    }

    db.ref("users/" + userId).update({
        solanaWallet: walletAddress
    }).then(() => {
        alert("✅ Wallet saved successfully!");
    }).catch((error) => {
        console.error("❌ Error saving wallet:", error);
    });
}

// Attach event listener to Save Wallet button
document.getElementById("saveWalletButton").addEventListener("click", saveWallet);
function withdrawCoins() {
    let withdrawAmount = parseInt(document.getElementById("withdrawAmount").value);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        alert("❌ Enter a valid amount to withdraw.");
        return;
    }
    // Get user data from Firebase
    db.ref("users/" + userId).once("value").then((snapshot) => {
        if (snapshot.exists()) {
            let userData = snapshot.val();
            let currentBalance = userData.wallet || 0;
            let walletAddress = userData.solanaWallet;

            if (!walletAddress) {
                alert("❌ No Solana wallet saved! Please enter and save your wallet first.");
                return;
            }
            

            if (withdrawAmount > currentBalance) {
                alert("❌ Not enough coins to withdraw.");
                return;
            }

            // Subtract the withdrawn amount
            let newBalance = currentBalance - withdrawAmount;

            // ✅ Update Firebase with new balance
            db.ref("users/" + userId).update({
                wallet: newBalance
            }).then(() => {
                alert(`✅ Withdraw successful! Sent ${withdrawAmount} coins to ${walletAddress}`);

                // 🚀 TODO: Send coins on Solana blockchain (requires Web3 integration)
            }).catch((error) => {
                console.error("❌ Error withdrawing coins:", error);
            });
        }
    });
}
const navItemss = document.querySelectorAll(".navs-item");

navItems.forEach(item => { 
    item.addEventListener("click", function (event) {
        let wallet = document.getElementById("wallet");

        // Check if the Earn button is clicked
        if (this.getAttribute("href") === "home.html") {
            event.preventDefault(); // Prevent page reload
            
            // Toggle task section visibility
            if (wallet.style.display === "none" || wallet.style.display === "") {
                wallet.style.display = "block"; // Show tasks
            } else {
                wallet.style.display = "none"; // Hide tasks
            }
        }
    });
});

// Example usage: Call this function when the user clicks "Check Telegram"

// ✅ Function to Check If User Has Claimed Today
function checkDailyReward() {
    if (!userId) return;

    const userRef = db.ref(`users/${userId}/lastClaimed`);
    userRef.once("value").then(snapshot => {
        const lastClaimed = snapshot.val();
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

        if (lastClaimed === today) {
            document.getElementById("claimBtn").disabled = true;
            document.getElementById("claimBtn").innerText = "✅ Claimed Today";
        } else {
            document.getElementById("claimBtn").disabled = false;
            document.getElementById("claimBtn").innerText = "Claim Daily Reward";
        }
    });
}

// ✅ Function to Claim Daily Reward
document.getElementById("claimBtn").addEventListener("click", () => {
    if (!userId) {
        alert("⚠️ Please log in first!");
        return;
    }

    const today = new Date().toISOString().split("T")[0];

    db.ref(`users/${userId}`).once("value").then(snapshot => {
        let currentPoints = snapshot.val()?.points || 0;
        db.ref(`users/${userId}`).update({
            points: currentPoints + 30, // Add 30 points
            lastClaimed: today
        }).then(() => {
            document.getElementById("pointsBalance").innerText = currentPoints + 20;
            document.getElementById("claimBtn").disabled = true;
            document.getElementById("claimBtn").innerText = "✅ Claimed Today";
        }).catch(error => {
            console.error("❌ Error updating points:", error);
        });
    });
});

// ✅ Run Check When User Logs In
auth.onAuthStateChanged(user => {
    if (user) {
        userId = user.uid;
        checkDailyReward(); // Check if they already claimed today
    }
});

const navItemsss = document.querySelectorAll(".navs-item");

navItems.forEach(item => { 
    item.addEventListener("click", function (event) {
        let wallet = document.getElementById("dailySection");

        // Check if the Earn button is clicked
        if (this.getAttribute("href") === "Daily.html") {
            event.preventDefault(); // Prevent page reload
            
            // Toggle task section visibility
            if (wallet.style.display === "none" || wallet.style.display === "") {
                wallet.style.display = "block"; // Show tasks
            } else {
                wallet.style.display = "none"; // Hide tasks
            }
        }
    });
});
// Add the toggleLottery function at the end or wherever suitable
function toggleLottery() {
    let lotterySection = document.getElementById("lotterySection");
    if (lotterySection.style.display === "none" || lotterySection.style.display === "") {
        lotterySection.style.display = "block";
    } else {
        lotterySection.style.display = "none";
    }
}
let pointss = localStorage.getItem("points") ? parseInt(localStorage.getItem("points")) : 0;
        let lastSpinDate = localStorage.getItem("lastSpinDate") || "";
        let freeSpins = localStorage.getItem("freeSpins") ? parseInt(localStorage.getItem("freeSpins")) : 3;

        let today = new Date().toISOString().split("T")[0];

        // Reset spins at midnight
        if (lastSpinDate !== today) {
            freeSpins = 3;
            localStorage.setItem("freeSpins", freeSpins);
            localStorage.setItem("lastSpinDate", today);
        }

        // Display points and free spins
        document.getElementById("points").innerText = points;
        document.getElementById("freeSpins").innerText = freeSpins;
        let spinButton = document.getElementById("spinButton");

        // Disable spin button if no free spins left
        if (freeSpins === 0) {
            spinButton.disabled = true;
        }

       let currentRotations = 0; // Store the current rotation

       let currentRotation = 0; // Ensure rotation starts properly

       function spinWheel() {
    // Debug: Check if function is being called
    console.log("Spin wheel function called");
    
    if (!userId) {
        alert("⚠️ Please log in first!");
        return;
    }

    if (freeSpins <= 0) {
        document.getElementById("result").innerText = "No free spins left for today!";
        return;
    }

    // Deduct a free spin
    freeSpins--;
    localStorage.setItem("freeSpins", freeSpins);
    document.getElementById("freeSpins").innerText = freeSpins;

    // Weighted rewards
    const weightedRewards = [
        { value: 2, angle: 0, weight: 55 },
        { value: 5, angle: 40, weight: 30 },
        { value: 150, angle: 120, weight: 12 },
        { value: 750, angle: 280, weight: 2 },
        { value: 1000, angle: 320, weight: 1 }
    ];

    // Select a random reward
    const totalWeight = weightedRewards.reduce((sum, item) => sum + item.weight, 0);
    let randomNum = Math.random() * totalWeight;
    let selectedReward;
    
    for (const reward of weightedRewards) {
        if (randomNum <= reward.weight) {
            selectedReward = reward;
            break;
        }
        randomNum -= reward.weight;
    }

    // Debug: Verify reward selection
    console.log("Selected reward:", selectedReward);

    // Get wheel element
    const wheel = document.getElementById("wheel");
    if (!wheel) {
        console.error("Wheel element not found!");
        return;
    }

    // Debug: Check current wheel state
    console.log("Current wheel transform:", wheel.style.transform);

    // Reset wheel position
    wheel.style.transition = "none";
    wheel.style.transform = "rotate(0deg)";
    
    // Force browser to apply the reset
    void wheel.offsetWidth;

    // Calculate spin parameters
    const spinDuration = 4000; // 4 seconds
    const spins = 5; // Number of full rotations
    const targetRotation = 360 * spins + selectedReward.angle;

    // Debug: Verify rotation calculation
    console.log(`Target rotation: ${targetRotation}°`);
     
      let spinAudio = document.getElementById("spinSound");
        spinAudio.volume = 0.5;
        spinAudio.play();

    // Apply spin animation
    wheel.style.transition = `transform ${spinDuration}ms cubic-bezier(0.2, 0.1, 0.1, 1)`;
    wheel.style.transform = `rotate(-${targetRotation}deg)`;

    // Debug: Verify applied styles
    console.log("Applied transition:", wheel.style.transition);
    console.log("Applied transform:", wheel.style.transform);

    // Update points after spin completes
    setTimeout(() => {
        db.ref("users/" + userId).once("value").then((snapshot) => {
            const userData = snapshot.val() || {};
            const currentPoints = userData.points || 0;
            const newPoints = currentPoints + selectedReward.value;

            db.ref("users/" + userId).update({ points: newPoints })
                .then(() => {
                    document.getElementById("points").innerText = newPoints;
                    document.getElementById("pointsBalance").innerText = newPoints;
                    document.getElementById("result").innerText = `🎉 You won ${selectedReward.value} points!`;
                          
                        // ✅ Play win sound
                        let winAudio = document.getElementById("winSound");
                        winAudio.volume = 0.6;
                        winAudio.play();

                    if (freeSpins === 0) {
                        document.getElementById("spinButton").disabled = true;
                    }
                })
                .catch(error => {
                    console.error("Firebase update error:", error);
                    // Restore spin if update fails
                    freeSpins++;
                    localStorage.setItem("freeSpins", freeSpins);
                    document.getElementById("freeSpins").innerText = freeSpins;
                });
        });
    }, spinDuration);
}
    

document.querySelector(".button-container").addEventListener("click", () => {
    let lotterySection = document.querySelector(".h1");
    let allContent = document.querySelectorAll("body > *:not(.h1)"); // Select all except .h1

    if (lotterySection.style.opacity === "0" || !lotterySection.style.opacity) {
        // Show lottery section at the top
        lotterySection.style.display = "block";
        setTimeout(() => {
            lotterySection.style.opacity = "1";
            lotterySection.style.maxHeight = "100vh"; // Full screen height
        }, 10);
        
        // Hide other content
        allContent.forEach(el => el.style.display = "none");

    } else {
        // Hide lottery section
        lotterySection.style.opacity = "0";
        lotterySection.style.maxHeight = "0";
        setTimeout(() => {
            lotterySection.style.display = "none";
        }, 300);

        // Show all hidden content back
        allContent.forEach(el => el.style.display = "");
    }
});
document.getElementById("backHome").addEventListener("click", () => {
    const lotterySection = document.querySelector(".h1");
    const loadingScreen = document.getElementById("loading-screen");

    // Hide lottery section
    lotterySection.style.opacity = "0";
    lotterySection.style.maxHeight = "0";
    setTimeout(() => {
        lotterySection.style.display = "none";
    }, 300);

    // Always hide loading screen (in case it’s visible)
    if (loadingScreen) {
        loadingScreen.style.display = "none";
    }

    // Show all content EXCEPT .h1 and #loading-screen
    const allContent = Array.from(document.body.children).filter(
        el => el !== lotterySection && el !== loadingScreen
    );

    allContent.forEach(el => {
        el.style.display = "";
    });
});

  document.getElementById("submitTwitter").addEventListener("click", function() {
            let handle = document.getElementById("twitterHandle").value;
            if (handle.trim() === "") {
                document.getElementById("twitterStatus").innerText = "❌ Please enter your Twitter handle.";
            } else {
                document.getElementById("twitterStatus").innerText = "✅ Submitted for review!";
                // Send handle to admin (You can store this in a database)
            }
        });
        
        document.getElementById("submitRetweet").addEventListener("click", function() {
            let link = document.getElementById("retweetLink").value;
            if (!link.includes("twitter.com")) {
                document.getElementById("retweetStatus").innerText = "❌ Please enter a valid Twitter link.";
            } else {
                document.getElementById("retweetStatus").innerText = "✅ Submitted for review!";
                // Send link to admin (You can store this in a database)
            }
        });
        
        document.getElementById("submitTelegram").addEventListener("click", function() {
            let userId = document.getElementById("telegramUserId").value;
            if (userId.trim() === "") {
                document.getElementById("telegramStatus").innerText = "❌ Please enter your Telegram User ID.";
            } else {
                document.getElementById("telegramStatus").innerText = "✅ Submitted for review!";
                // Send Telegram ID to admin (You can store this in a database)
            }
        });
		      // 🔥 Firebase Authentication Handling
// Store Twitter Handle
function submitTask(taskType, inputId, statusId, validationFunc) {
            let inputValue = document.getElementById(inputId).value.trim();
            
            if (!validationFunc(inputValue)) {
                document.getElementById(statusId).innerText = `❌ Invalid ${taskType}!`;
                return;
            }

            if (!userId) {
                document.getElementById(statusId).innerText = "❌ User not logged in!";
                console.error("❌ Error: User is not authenticated.");
                return;
            }

            console.log(`📩 Submitting ${taskType}:`, inputValue);

            db.ref(`tasks/${userId}/${taskType}`).set({
                [taskType]: inputValue,
                timestamp: Date.now()
            }).then(() => {
                document.getElementById(statusId).innerText = `✅ ${taskType} saved!`;
                console.log(`✅ ${taskType} successfully saved in Firebase.`);
            }).catch(error => {
                console.error("🔥 Firebase Error:", error);
                document.getElementById(statusId).innerText = `❌ Error saving ${taskType}.`;
            });
        }
        // 🐦 Twitter Handle Submission
        document.getElementById("submitTwitter").addEventListener("click", function () {
            submitTask("twitter", "twitterHandle", "twitterStatus", value => value !== "");
        });

        // 🔁 Retweet Link Submission
        document.getElementById("submitRetweet").addEventListener("click", function () {
            submitTask("retweet", "retweetLink", "retweetStatus", value => value.includes("twitter.com"));
        });

        // 💬 Telegram ID Submission
        document.getElementById("submitTelegram").addEventListener("click", function () {
            submitTask("telegram", "telegramUserId", "telegramStatus", value => value !== "");
        });
          function toggleInfo() {
            const infoBox = document.getElementById("info-box");
            // Select only the main content containers we want to hide
            const contentToHide = [
                document.querySelector('.container'),
                document.querySelector('.nav-bar'),
                document.getElementById('lotterySection'),
            ].filter(Boolean); // Remove any null elements
            
            if (infoBox.style.opacity === "0" || !infoBox.style.opacity) {
                // Show info box
                infoBox.style.display = "block";
                setTimeout(() => {
                    infoBox.style.opacity = "1";
                    infoBox.style.maxHeight = "100vh";
                }, 10);
                
                // Hide main content (but keep logo container visible)
                contentToHide.forEach(el => {
                    el.style.display = "none";
                });
        
            } else {
                // Hide info box
                infoBox.style.opacity = "0";
                infoBox.style.maxHeight = "0";
                setTimeout(() => {
                    infoBox.style.display = "none";
                }, 300);
        
                // Show main content again
                contentToHide.forEach(el => {
                    el.style.display = "";
                });
            }
        }
        // Hide all sections initially
    // miner-worker.j
    function showAdAfterLogin() {
    const adWrapper = document.getElementById('ad-wrapper');
    if (!adWrapper) {
        console.error("Ad wrapper element not found!");
        return;
    }

    // Show the ad container
    adWrapper.style.display = 'block';

    // Load the ad script only if not already loaded
    if (!window.adScriptLoaded) {
        if (typeof atAsyncOptions !== 'object') {
            window.atAsyncOptions = [];
        }
        
        atAsyncOptions.push({
            'key': '2b9cdc94d712b5f48eb73f37e47cc203',
            'format': 'js',
            'async': true,
            'container': 'atContainer-2b9cdc94d712b5f48eb73f37e47cc203',
            'params': {}
        });

        const script = document.createElement('script');
        script.id = 'adsterra-script';
        script.type = "text/javascript";
        script.async = true;
        script.src = 'https://www.highperformanceformat.com/2b9cdc94d712b5f48eb73f37e47cc203/invoke.js';
        
        script.onload = function() {
            console.log("Ad script loaded successfully");
            window.adScriptLoaded = true;
        };
        
        script.onerror = function() {
            console.error("Failed to load ad script");
            adWrapper.style.display = 'none';
        };

        document.head.appendChild(script);
    }
}      
  window.addEventListener('load', () => {
    setTimeout(() => {
      document.getElementById('loading-screen').style.display = 'none';
      const main = document.getElementsByClassName('container')[0]; // get the first .container
      if (main) main.style.display = 'block';
      else alert("❌ No element with class 'container' found.");
    }, 2500);
  }); 
  // Handle tab visibility changes
// Enhanced visibility change handler
document.addEventListener('visibilitychange', () => {
    if (!userId || !miningWorker) return;
    
    const isHidden = document.visibilityState === 'hidden';
    console.log(`👁️ Visibility changed: ${isHidden ? 'hidden' : 'visible'}`);
    
    try {
        // Update worker with new state
        miningWorker.postMessage({ 
            action: "start",
            userId: userId,
            background: isHidden
        });
        
        // Only update UI when visible
        if (!isHidden && document.getElementById("status")) {
            document.getElementById("status").innerText = "⏳ Mining active...";
            updateMiningUI();
        }
    } catch (e) {
        console.error("Error updating worker state:", e);
    }
});
 // Add visibility change handler to restart mining when tab becomes active
 document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && userId) {
      logDebug("Tab became visible, checking mining status...");
      setTimeout(checkMiningStatus, 500);
    }
  });
// Enhanced updateMiningUI function
function updateMiningUI() {
    if (!userId) return;
    
    // Get latest mining stats
    db.ref(`users/${userId}`).once('value').then(snapshot => {
        if (!snapshot.exists()) return;
        
        const userData = snapshot.val() || {};
        
        // Update points if element exists
        const pointsEl = document.getElementById("pointsBalance");
        if (pointsEl && userData.points !== undefined) {
            pointsEl.textContent = userData.points;
        }
        
        // Get latest mining stats - only if visible
        if (document.visibilityState === 'visible') {
            db.ref(`users/${userId}/miningStats`)
                .orderByKey()
                .limitToLast(1)
                .once('value')
                .then(snap => {
                    if (!snap.exists()) return;
                    
                    const data = snap.val();
                    const lastKey = Object.keys(data)[0];
                    const stats = data[lastKey];
                    
                    const hashRateEl = document.getElementById("hashRateDisplay");
                    const totalHashesEl = document.getElementById("totalHashes");
                    
                    if (hashRateEl && stats.hashRate !== undefined) {
                        hashRateEl.textContent = stats.hashRate;
                    }
                    
                    if (totalHashesEl && stats.totalHashes !== undefined) {
                        totalHashesEl.textContent = stats.totalHashes;
                    }
                })
                .catch(error => {
                    console.error("Error fetching mining stats:", error);
                });
        }
    }).catch(error => {
        console.error("Error updating mining UI:", error);
    });
}
function debugMiningState() {
    console.group("🔍 Mining Debug Information");
    console.log("User ID:", userId);
    console.log("Mining active:", mining);
    console.log("Mining interval:", miningInterval ? "Active" : "Inactive");
    console.log("Worker active:", miningWorker ? "Yes" : "No");
    
    if (userId) {
        // Check Firebase state
        db.ref("users/" + userId).once("value").then((snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                console.log("Firebase user data:", userData);
                console.log("Points in Firebase:", userData.points);
                console.log("Mining active in Firebase:", userData.miningActive);
                console.log("Mining start time:", userData.miningStartTime ? new Date(userData.miningStartTime).toLocaleString() : "Not set");
            } else {
                console.log("User data not found in Firebase");
            }
            console.groupEnd();
        }).catch(error => {
            console.error("Error fetching user data:", error);
            console.groupEnd();
        });
    } else {
        console.log("User not logged in");
        console.groupEnd();
    }
}
function updateBackgroundMiningStats(data) {
    const bgMiningStatus = document.getElementById('bgMiningStatus');
    if (bgMiningStatus) {
      bgMiningStatus.innerText = `Background mining: ${data.totalHashesMined.toLocaleString()} hashes`;
    }
    
    // Also update Firebase if needed
    if (userId) {
      db.ref(`users/${userId}/backgroundMining`).update({
        lastUpdate: firebase.database.ServerValue.TIMESTAMP,
        totalHashes: data.totalHashesMined
      });
    }
  }
// ✅ Attach Login Button Event
document.getElementById("loginButton").addEventListener("click", login);
