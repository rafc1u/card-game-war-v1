// Firebase configuration
// Replace these values with your Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyBd5B0ArqTTeWN0F6bOnaELhHH_w7jFqfU",
    authDomain: "war-card-game-vsi.firebaseapp.com",
    databaseURL: "https://war-card-game-vsi-default-rtdb.firebaseio.com",
    projectId: "war-card-game-vsi",
    storageBucket: "war-card-game-vsi.firebasestorage.app",
    messagingSenderId: "284339995933",
    appId: "1:284339995933:web:f2dce7b5b4a068f879cdf4",
    measurementId: "G-9WTX0CPWJW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize App Check - moved to a function that will be called after Firebase is ready
function initializeAppCheck() {
    try {
        // Make sure Firebase is fully initialized first
        if (!firebase || !firebase.app) {
            console.warn('Firebase not yet fully initialized, skipping App Check setup');
            return false;
        }
        
        // Pass your reCAPTCHA v3 site key (public key) to activate(). Make sure this
        // key is the counterpart to the secret key you set in the Firebase console.
        const appCheck = firebase.appCheck();
        
        if (!appCheck) {
            console.warn('Firebase App Check not available');
            return false;
        }
        
        // Use debug token in development (replace with your actual reCAPTCHA site key in production)
        if (window.location.hostname === 'localhost') {
            // Enable debug mode for local testing (remove in production)
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
            appCheck.activate('debugToken');
        } else {
            // For production, use your reCAPTCHA site key
            appCheck.activate(
                '6Lek5QkrAAAAABkXtpFiLvnh0V1f9A46ltx_U9t-', // Replace with your actual reCAPTCHA site key
                true // Set to true for debug mode if needed
            );
        }
        
        console.log('Firebase App Check initialized successfully');
        
        // Add error event listener for App Check token refresh failures
        appCheck.onTokenChanged(() => {
            console.log('App Check token refreshed');
        }, (error) => {
            console.error('Error refreshing App Check token:', error);
            alert('There was a security verification error. Please refresh the page and try again.');
        });
        
        return true;
    } catch (error) {
        console.error('Failed to initialize Firebase App Check:', error);
        // Fallback if App Check initialization fails - still allow the app to work
        return false;
    }
}

// Reference to database
const database = firebase.database();

// Try initializing App Check after a short delay to ensure Firebase is ready
setTimeout(() => {
    initializeAppCheck();
}, 500);

// Generate a random game code (6 characters)
function generateGameCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Check if a game exists
async function checkGameExists(gameCode) {
    const snapshot = await database.ref(`games/${gameCode}`).once('value');
    return snapshot.exists();
}

// Create a new game in the database
async function createGame() {
    let gameCode;
    let exists = true;
    
    // Generate a unique game code
    while (exists) {
        gameCode = generateGameCode();
        exists = await checkGameExists(gameCode);
    }
    
    // Create the game in the database
    await database.ref(`games/${gameCode}`).set({
        status: 'lobby',
        players: {},
        host: null,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    
    return gameCode;
}

// Join a game
async function joinGame(gameCode) {
    const exists = await checkGameExists(gameCode);
    
    if (!exists) {
        throw new Error('Game not found');
    }
    
    const gameSnapshot = await database.ref(`games/${gameCode}`).once('value');
    const gameData = gameSnapshot.val();
    
    if (gameData.status !== 'lobby') {
        throw new Error('Game already in progress');
    }
    
    return gameCode;
}

// Set player name and join the game
async function setPlayerName(gameCode, playerId, name) {
    return database.ref(`games/${gameCode}/players/${playerId}`).update({
        name: name,
        cards: 0,
        active: true
    });
}

// Listen for changes in the game
function listenForGameChanges(gameCode, callback) {
    return database.ref(`games/${gameCode}`).on('value', snapshot => {
        const gameData = snapshot.val();
        if (gameData) {
            callback(gameData);
        }
    });
}

// Listen for player changes
function listenForPlayerChanges(gameCode, callback) {
    return database.ref(`games/${gameCode}/players`).on('value', snapshot => {
        const players = snapshot.val() || {};
        callback(players);
    });
}

// Start the game
async function startGame(gameCode) {
    return database.ref(`games/${gameCode}`).update({
        status: 'playing',
        currentRound: 0,
        deck: null,
        battleCards: {},
        warState: false
    });
}

// Update game state
function updateGameState(gameCode, updates) {
    return database.ref(`games/${gameCode}`).update(updates);
}

// Update player state
function updatePlayerState(gameCode, playerId, updates) {
    return database.ref(`games/${gameCode}/players/${playerId}`).update(updates);
}

// Remove listeners
function removeListeners(gameCode) {
    database.ref(`games/${gameCode}`).off();
    database.ref(`games/${gameCode}/players`).off();
} 