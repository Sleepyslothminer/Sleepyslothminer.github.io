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
const dailyPoints = 20;
let miningWorker;


const buttons = ["mineButton", "stopButton", "likeButton", "submitSuggestion", "verifyTwitter", "verifyRetweet", "verifyTelegram"];

auth.onAuthStateChanged((user) => {
    const likeButton = document.getElementById("likeButton");

    if (user) {
        userId = user.uid;
        checkIfLiked(); // Call your existing function here
    } else {
        userId = null;

        // Reset like button
        likeButton.disabled = true;
        likeButton.textContent = "👍 Like";
        likeButton.style.opacity = "1";
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
function startMining() {
    if (!userId) {
        alert("⚠️ Please log in first!");
        return;
    }

    // Show loading buffer
    const miningLoader = document.getElementById("mining-loader");
    const mineButton = document.getElementById("mineButton");
    miningLoader.style.display = "block";
    mineButton.disabled = true;

    setTimeout(() => {
        miningLoader.style.display = "none";
        mineButton.disabled = false;

        console.log("⛏️ Mining started!");

        let miningStartTime = Date.now();
        let miningEndTime = miningStartTime + 24 * 60 * 60 * 1000; // 24 hours from now

        // Save mining session in Firebase
        db.ref("users/" + userId).update({
            miningStartTime: miningStartTime,
            miningActive: true
        }).then(() => {
            console.log("✅ Mining session saved in Firebase!");
        }).catch((error) => {
            console.error("❌ Firebase update error:", error);
        });

        // Save locally only if logged in
        localStorage.setItem("miningStartTime", miningStartTime);
        localStorage.setItem("miningEndTime", miningEndTime);
        localStorage.setItem("miningActive", "true");

        mineButton.disabled = true;
        document.getElementById("stopButton").disabled = false;
        document.getElementById("status").innerText = "⏳ Mining active...";

        startCountdown();
        startMiningProcess();
    }, 100); // buffer time in milliseconds
}
function startBackgroundMining() {
    if (typeof Worker !== "undefined") {
      const workerCode = `
        self.onmessage = function(e) {
          if (e.data === "start") {
            let hashCount = 0;
            const startTime = Date.now();
  
            const miningInterval = setInterval(() => {
              for (let i = 0; i < 1000; i++) {
                hashCount++;
                Math.random() * 1000;
              }
  
              const currentTime = Date.now();
              const hashRate = Math.floor(hashCount / ((currentTime - startTime) / 1000));
              self.postMessage({ hashRate, totalHashes: hashCount });
            }, 1000);
  
            self.onmessage = function(e) {
              if (e.data === "stop") {
                clearInterval(miningInterval);
              }
            };
          }
        };
      `;
  
      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      miningWorker = new Worker(workerUrl);
  
      miningWorker.onmessage = function(e) {
        const { hashRate, totalHashes } = e.data;
        document.getElementById("hashRateDisplay").textContent = hashRate;
        document.getElementById("totalHashes").textContent = totalHashes;
  
        if (userId) {
          firebase.database().ref(`users/${userId}/miningStats`).push({
            timestamp: Date.now(),
            hashRate,
            totalHashes
          });
        }
      };
  
      miningWorker.postMessage("start");
    } else {
      console.error("Web Workers not supported. Falling back to main thread.");
    }
  }
  
  function stopBackgroundMining() {
    if (miningWorker) {
      miningWorker.postMessage("stop");
      miningWorker.terminate();
      miningWorker = null;
    }
  }
// ✅ Stop Mining & Transfer Points to Wallet
function stopMining() {
    clearInterval(miningInterval);
    clearInterval(hashRateInterval);
    clearInterval(miningInterval.backgroundWorker);
    if (!userId) {
        alert("⚠️ Please log in first!");
        return;
    }

    console.log("🛑 Stopping mining...");

    clearInterval(miningInterval);
    clearInterval(countdownInterval);
    
    let miningStartTime = parseInt(localStorage.getItem("miningStartTime")) || 0;
    let timeMined = Math.floor((Date.now() - miningStartTime) / (1000 * 60 * 60)); // 1 point per hour

    console.log(`⏳ Time Mined: ${timeMined} hours`);

    let currentPoints = parseInt(document.getElementById("pointsBalance").innerText);
    let newWalletBalance = parseInt(document.getElementById("walletBalance").innerText) + currentPoints;

    console.log(`💰 New Wallet Balance: ${newWalletBalance}`);

    // ✅ Ensure "status" exists before setting text
    let statusEl = document.getElementById("status");
    if (statusEl) {
        statusEl.innerText = "⛏️ Mining paused. Press Start to begin.";
    } else {
        console.error("❌ Element with ID 'status' not found!");
    }

    // Update Firebase
    db.ref("users/" + userId).update({
        wallet: newWalletBalance,
        points: 0,
        miningActive: false
    }).then(() => {
        console.log("✅ Wallet updated in Firebase!");
    }).catch((error) => {
        console.error("❌ Firebase update error:", error);
    });

    // Update UI
    document.getElementById("walletBalance").innerText = newWalletBalance;
    document.getElementById("pointsBalance").innerText = "0";

    // Reset mining status
    localStorage.removeItem("miningStartTime");
    localStorage.removeItem("miningEndTime");
    localStorage.removeItem("miningActive");

    document.getElementById("mineButton").disabled = false;
    document.getElementById("stopButton").disabled = true;
    document.getElementById("countdown").innerText = ""; // Reset countdown
}
// ✅ Function to Continue Mining After Refresh
function startMiningProcess() {
    if (!userId) {
        alert("⚠️ Please log in first!");
        return;
    }

    // Clear any existing intervals
    stopMiningProcess();

    // Reset mining metrics
    hashCount = 0;
    totalHashes = 0;
    currentHashRate = 0;
    hashRateHistory = [];

    // Start hash rate monitoring (updates every second)
    hashRateInterval = setInterval(updateHashRate, 1000);

    // Start background mining work (for hash rate calculation)
    startHashWorker();

    // Start main mining interval (1 coin per minute)
    miningInterval = setInterval(() => {
        // Award exactly 1 coin
        const currentCoins = parseInt(document.getElementById("pointsBalance").innerText) || 0;
        const newCoins = currentCoins + 1;
        
        document.getElementById("pointsBalance").innerText = newCoins;
        db.ref("users/" + userId + "/points").set(newCoins);
        
        // Update status
        document.getElementById("status").innerText = `⛏️ Mined 1 point! (${totalHashes.toLocaleString()} hashes)`;
        
        // Store hash rate data
        db.ref(`users/${userId}/miningStats`).push({
            timestamp: Date.now(),
            hashRate: currentHashRate,
            totalHashes: totalHashes
        });

    }, 60000); // Exactly 1 minute

    // Update UI
    document.getElementById("mineButton").disabled = true;
    document.getElementById("stopButton").disabled = false;
    document.getElementById("status").innerText = "⏳ Mining active...";
}

function startHashWorker() {
    let lastUpdate = Date.now();
    
    hashWorkerInterval = setInterval(() => {
        const now = Date.now();
        const timeDiff = now - lastUpdate;
        
        // Calculate how many hashes to perform to maintain target rate
        const targetHashes = Math.floor((TARGET_HASH_RATE * timeDiff) / 1000);
        
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
    const elapsedSeconds = (now - lastPointUpdate) / 1000;
    
    // Calculate hashes per second
    hashRate = elapsedSeconds > 0 ? Math.floor(hashCount / elapsedSeconds) : 0;
    
    // Update UI only
    const hashRateElement = document.getElementById("hashRateDisplay");
    if (hashRateElement) {
        hashRateElement.innerText = `${hashRate.toLocaleString()} H/s`;
    }
    
    // Reset counter for fresh calculation
    hashCount = 0;
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
            points: currentPoints + 20, // Add 20 points
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
    document.querySelector(".h1").style.display = "none"; 
    document.querySelectorAll("body > *:not(.h1)").forEach(el => el.style.display = ""); 
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
            const box = document.getElementById("info-box");
            box.classList.toggle("hidden");
          }
          function toggleInfo() {
            const infoBox = document.getElementById("info-box");
            // Select only the main content containers we want to hide
            const contentToHide = [
                document.querySelector('.container'),
                document.querySelector('.nav-bar'),
                document.getElementById('lotterySection')
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
    // miner-worker.js

// ✅ Attach Login Button Event
document.getElementById("loginButton").addEventListener("click", login);
