// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const createGameBtn = document.getElementById('create-game');
const joinGameBtn = document.getElementById('join-game');
const gameCodeInput = document.getElementById('game-code');
const gameCodeDisplay = document.getElementById('game-code-display');
const playerNameInput = document.getElementById('player-name');
const setNameBtn = document.getElementById('set-name');
const playersList = document.getElementById('players');
const startGameBtn = document.getElementById('start-game');
const playersArea = document.getElementById('players-area');
const battleArea = document.getElementById('battle-area');
const playCardBtn = document.getElementById('play-card');
const exitGameBtn = document.getElementById('exit-game');
const roundCount = document.getElementById('round-count');
const warAnimation = document.getElementById('war-animation');
const copyUrlBtn = document.getElementById('copy-url');
const copyConfirmation = document.getElementById('copy-confirmation');
const gameStatusDiv = document.getElementById('game-status'); // Get game status div

// Game state
let currentGame = {
    gameCode: null,
    playerId: null,
    isHost: false,
    playerName: null,
    players: {},
    gameState: null,
    deck: [],
    myCards: [],
    isPlayingCard: false,
    appCheckVerified: false,
    isResolvingRound: false, // Flag to prevent multiple winner checks triggered by rapid state changes
    debugMode: false,
    forceWarCards: false
};

// Card values and suits
const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const CARD_SUITS = ['♠', '♥', '♦', '♣'];
const CARD_COLORS = {
    '♠': 'black',
    '♥': 'red',
    '♦': 'red',
    '♣': 'black'
};

// Create a player ID
currentGame.playerId = 'player_' + Date.now().toString() + Math.floor(Math.random() * 1000).toString();

// Event Listeners
createGameBtn.addEventListener('click', handleCreateGame);
joinGameBtn.addEventListener('click', handleJoinGame);
setNameBtn.addEventListener('click', handleSetName);
startGameBtn.addEventListener('click', handleStartGame);
playCardBtn.addEventListener('click', handlePlayCard);
exitGameBtn.addEventListener('click', handleExitGame);
copyUrlBtn.addEventListener('click', handleCopyUrl);

// Add debug key listener for war testing
document.addEventListener('keydown', function(event) {
    if (event.key.toLowerCase() === 'w') {
        currentGame.forceWarCards = true;
        console.log('WAR MODE ACTIVATED: Next cards will be identical to force war!');
        alert('WAR MODE ACTIVATED: Next cards will be identical!');
    }
     // NEW: Add space bar/Enter as an alternative way to play a card
    if (event.key === ' ' || event.key === 'Enter') {
        // Prevent default space behavior (like scrolling)
        event.preventDefault();
        if (!playCardBtn.disabled && !currentGame.isPlayingCard) {
             console.log('Playing card via keyboard shortcut (Space/Enter)');
             handlePlayCard();
        }
    }
    // NEW: Force enable play button with F key (Use with caution!)
    if (event.key.toLowerCase() === 'f') {
        console.warn('FORCE ENABLE: Manually enabling play button via F key.');
        enablePlayButton();
        alert('Play button forcibly enabled. Try clicking it now.');
    }
});


// Setup App Check after Firebase is initialized
function setupAppCheck() {
    // ... (keep existing setupAppCheck function) ...
    if (typeof firebase !== 'undefined' && firebase.app && firebase.appCheck) {
        try {
            // Listen for App Check state
            firebase.appCheck().onTokenChanged(
                (token) => {
                    currentGame.appCheckVerified = true;
                    console.log('App Check verified successfully');
                },
                (error) => {
                    currentGame.appCheckVerified = false;
                    console.error('App Check error:', error);
                    showAppCheckError(error);
                }
            );
        } catch (error) {
            console.error('Failed to setup App Check listener:', error);
            // Allow the game to continue even if App Check setup fails
            currentGame.appCheckVerified = true;
        }
    } else {
        console.warn('Firebase App Check not available, proceeding without verification');
        // Allow the game to continue without App Check
        currentGame.appCheckVerified = true;
    }
}

// Handle App Check errors
function showAppCheckError(error) {
    // ... (keep existing showAppCheckError function) ...
    let errorMessage = 'Firebase security verification failed. ';
    if (error && error.code) {
        switch (error.code) {
            case 'app-check/token-error': errorMessage += 'Unable to verify app identity. '; break;
            case 'app-check/throttled': errorMessage += 'Too many verification attempts. Please try again later. '; break;
            default: errorMessage += 'Please refresh the page and try again. ';
        }
    }
    errorMessage += 'If this problem persists, please contact support.';
    alert(errorMessage);
}

// Check App Check verification before database operations
function checkAppCheckBeforeOperation(operation, fallback = null) {
    // ... (keep existing checkAppCheckBeforeOperation function) ...
    if (window.location.hostname === 'localhost' || currentGame.appCheckVerified) {
        return operation();
    } else {
        console.warn('Operation attempted before App Check verification');
        if (fallback) { return fallback(); }
        return Promise.reject(new Error('App Check verification required'));
    }
}

// Initialize - check URL for game code and setup App Check
document.addEventListener('DOMContentLoaded', () => {
    // ... (keep existing DOMContentLoaded listener) ...
    setTimeout(() => {
        setupAppCheck();
        setTimeout(() => {
            checkUrlForGameCode();
        }, 200);
    }, 1000);
});

// --- Lobby and Setup Functions --- (Keep existing: handleCopyUrl, generateShareableUrl, copyToClipboard, showCopyConfirmation, handleCreateGame, handleJoinGame, checkUrlForGameCode, handleSetName) ---

async function handleCreateGame() {
    try {
        const gameCode = await checkAppCheckBeforeOperation(() => createGame(), () => Promise.reject(new Error('App Check verification required')));
        currentGame.gameCode = gameCode;
        currentGame.isHost = true;
        await database.ref(`games/${gameCode}`).update({ host: currentGame.playerId });
        showLobbyScreen();
        gameCodeDisplay.textContent = gameCode;
        listenForGameChanges(gameCode, handleGameStateChange);
        listenForPlayerChanges(gameCode, updatePlayersList);
    } catch (error) { alert('Error creating game: ' + error.message); }
}

async function handleJoinGame() {
    const gameCode = gameCodeInput.value.trim().toUpperCase();
    if (!gameCode) { alert('Please enter a game code'); return; }
    try {
        await checkAppCheckBeforeOperation(() => joinGame(gameCode), () => Promise.reject(new Error('App Check verification required')));
        currentGame.gameCode = gameCode;
        showLobbyScreen();
        gameCodeDisplay.textContent = gameCode;
        listenForGameChanges(gameCode, handleGameStateChange);
        listenForPlayerChanges(gameCode, updatePlayersList);
    } catch (error) { alert('Error joining game: ' + error.message); }
}

function checkUrlForGameCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameCode = urlParams.get('code');
    if (gameCode) { gameCodeInput.value = gameCode; handleJoinGame(); }
}

async function handleSetName() {
    const name = playerNameInput.value.trim();
    if (!name) { alert('Please enter your name'); return; }
    try {
        await checkAppCheckBeforeOperation(() => setPlayerName(currentGame.gameCode, currentGame.playerId, name), () => Promise.reject(new Error('App Check verification required')));
        currentGame.playerName = name;
        setNameBtn.disabled = true;
        playerNameInput.disabled = true;
        if (currentGame.isHost) {
             // Enable start button only if enough players later in updatePlayersList
        }
    } catch (error) { alert('Error setting name: ' + error.message); }
}

function handleCopyUrl() {
    const gameCode = currentGame.gameCode;
    if (!gameCode) return;
    const shareableUrl = generateShareableUrl(gameCode);
    copyToClipboard(shareableUrl);
    showCopyConfirmation();
}
function generateShareableUrl(gameCode) {
    const url = new URL(window.location.href.split('?')[0]);
    url.searchParams.set('code', gameCode);
    return url.toString();
}
function copyToClipboard(text) {
    const tempInput = document.createElement('input');
    tempInput.style.position = 'absolute'; tempInput.style.left = '-1000px';
    tempInput.value = text; document.body.appendChild(tempInput);
    tempInput.select(); document.execCommand('copy');
    document.body.removeChild(tempInput);
}
function showCopyConfirmation() {
    copyConfirmation.classList.remove('hidden');
    setTimeout(() => { copyConfirmation.classList.add('hidden'); }, 2000);
}

// --- Game Start and Core Logic ---

async function handleStartGame() {
    if (!currentGame.isHost) return;
    const activePlayerIds = Object.keys(currentGame.players).filter(id => currentGame.players[id].active); // Ensure only active players are counted
    const playerCount = activePlayerIds.length;

    if (playerCount < 2) { alert('Need at least 2 players to start'); return; }
    if (playerCount > 10) { alert('Maximum 10 players allowed'); return; }

    try {
        await checkAppCheckBeforeOperation(async () => {
            const deck = createDeck();
            const shuffledDeck = shuffleDeck(deck);
            const dealtCards = dealCards(shuffledDeck, activePlayerIds); // Deal only to active players

            const updates = {};
            Object.keys(dealtCards).forEach(playerId => {
                updates[`games/${currentGame.gameCode}/players/${playerId}/cards`] = dealtCards[playerId];
                // Ensure player is marked active if they received cards
                updates[`games/${currentGame.gameCode}/players/${playerId}/active`] = true;
            });

            // Set initial game state properties
             updates[`games/${currentGame.gameCode}/status`] = 'playing';
             updates[`games/${currentGame.gameCode}/currentRound`] = 1; // Start at round 1
             updates[`games/${currentGame.gameCode}/deck`] = null; // Deck is dealt
             updates[`games/${currentGame.gameCode}/battleCards`] = {};
             updates[`games/${currentGame.gameCode}/warState`] = false;
             updates[`games/${currentGame.gameCode}/warStage`] = null;
             updates[`games/${currentGame.gameCode}/warPlayers`] = null;
             updates[`games/${currentGame.gameCode}/warFaceDownCards`] = {}; // NEW
             updates[`games/${currentGame.gameCode}/warFaceUpCards`] = {};   // NEW
             updates[`games/${currentGame.gameCode}/warPot`] = []; // Initialize war pot
             updates[`games/${currentGame.gameCode}/message`] = "Game started!"; // Initial message


            // Apply all updates together
            await firebase.database().ref().update(updates);

            // startGame function is now effectively merged here
            // await startGame(currentGame.gameCode); - remove this call

        }, () => Promise.reject(new Error('App Check verification required')));
    } catch (error) {
        alert('Error starting game: ' + error.message);
    }
}

function handlePlayCard() {
    if (playCardBtn.disabled || currentGame.isPlayingCard) {
        console.log('Play card blocked (disabled or already playing)');
        return;
    }

    currentGame.isPlayingCard = true;
    disablePlayButton();
    updateGameStatusMessage("Playing card..."); // Update status

    const gameCode = currentGame.gameCode;
    const playerId = currentGame.playerId;
    const gameState = currentGame.gameState;

    // --- WAR LOGIC ---
    if (gameState && gameState.warState && gameState.warStage === 'play_war_cards') {
        handlePlayWarCards(); // Separate function for clarity
        return; // handlePlayWarCards will manage isPlayingCard and button state
    }

    // --- REGULAR PLAY LOGIC ---
    if (!currentGame.myCards || currentGame.myCards.length === 0) {
        console.log('No cards left to play.');
        // Player might be out, let game state handle it, don't alert
        // Do not re-enable button here, state change will handle it
        currentGame.isPlayingCard = false; // Reset flag
        return;
    }

    // Check if already played this round (shouldn't happen with button disabling, but safety check)
    if (gameState.battleCards && gameState.battleCards[playerId]) {
        console.log('Already played a card this round.');
        currentGame.isPlayingCard = false; // Reset flag
        // Don't re-enable button, wait for state update
        return;
    }

    const topCard = currentGame.myCards[0];
    let cardToPlay = { ...topCard };

    // Debug mode: Force card for war testing (only if war isn't already active)
    if (currentGame.forceWarCards && !gameState.warState) {
        console.log('Debug mode: Forcing card to 10♥ for potential war');
        cardToPlay = { value: '10', suit: '♥' };
        // Don't reset forceWarCards here, let it persist until a war actually triggers or is reset manually
    }

    // Optimistic local update (card removed)
    const updatedCards = [...currentGame.myCards];
    updatedCards.shift();
    currentGame.myCards = updatedCards; // Update local cache immediately

    // Update Database
    const updates = {};
    updates[`/games/${gameCode}/battleCards/${playerId}`] = cardToPlay;
    updates[`/games/${gameCode}/players/${playerId}/cards`] = updatedCards; // Update player's deck

    database.ref().update(updates)
        .then(() => {
            console.log(`Player ${playerId} played regular card: ${cardToPlay.value}${cardToPlay.suit}`);
            // No need to enable button here, handleGameStateChange will do it based on overall state
        })
        .catch(error => {
            console.error('Error playing card:', error);
            // Revert local state on error
            currentGame.myCards.unshift(cardToPlay);
            updateGameStatusMessage("Error playing card. Try again.", true); // Show error
            enablePlayButton(); // Allow retry on error
        })
        .finally(() => {
            currentGame.isPlayingCard = false; // Reset flag after DB operation attempt
        });
}


// NEW: Handle playing the two cards required for War
function handlePlayWarCards() {
    console.log(`Player ${currentGame.playerId} attempting to play war cards.`);
    const gameCode = currentGame.gameCode;
    const playerId = currentGame.playerId;

    // Check if player has enough cards for war (needs 2)
    if (!currentGame.myCards || currentGame.myCards.length < 2) {
        console.log(`Player ${playerId} does not have enough cards (needs 2) for war.`);
        updateGameStatusMessage("Not enough cards for war! Forfeiting this war round.", true);

        // Mark player as having forfeited this war round (e.g., by not adding cards)
        // The resolution logic will need to handle players who didn't play war cards.
        // We can signal this by setting their war cards to a specific value, e.g., null or 'forfeit'
        // Or simply check for their existence in warFaceUpCards during resolution.

        const updates = {};
        // Indicate forfeit indirectly by not adding cards for this player
        // Let's ensure the player is removed from contention in the DB if possible,
        // but for now, resolution logic will handle missing cards.

        // Check if all other war players have played or forfeited
        checkWarRoundCompletion();

        currentGame.isPlayingCard = false; // Reset flag
        // Button remains disabled as they can't play
        return;
    }

    const faceDownCard = { ...currentGame.myCards[0] };
    const faceUpCard = { ...currentGame.myCards[1] };

    // Debug: Force specific war cards if needed
     if (currentGame.forceWarCards) {
         console.log('Debug mode: Forcing war cards to 10♥ and J♥');
         // Note: This assumes player has at least 2 cards. Check done above.
         faceDownCard = { value: '10', suit: '♥' }; // Example face down
         faceUpCard   = { value: 'J', suit: '♥' };  // Example face up
         currentGame.forceWarCards = false; // Reset after use in war
     }


    // Optimistic local update (remove both cards)
    const updatedCards = currentGame.myCards.slice(2);
    currentGame.myCards = updatedCards; // Update local cache

    // Update Database
    const updates = {};
    updates[`/games/${gameCode}/warFaceDownCards/${playerId}`] = faceDownCard;
    updates[`/games/${gameCode}/warFaceUpCards/${playerId}`] = faceUpCard;
    updates[`/games/${gameCode}/players/${playerId}/cards`] = updatedCards;

    database.ref().update(updates)
        .then(() => {
            console.log(`Player ${playerId} played war cards: Down=${faceDownCard.value}${faceDownCard.suit}, Up=${faceUpCard.value}${faceUpCard.suit}`);
            // Don't check completion here, let handleGameStateChange do it based on DB state
        })
        .catch(error => {
            console.error('Error playing war cards:', error);
            // Revert local state on error
            currentGame.myCards.unshift(faceUpCard); // Add back in reverse order
            currentGame.myCards.unshift(faceDownCard);
            updateGameStatusMessage("Error playing war cards. Try again.", true);
            enablePlayButton(); // Allow retry
        })
        .finally(() => {
             currentGame.isPlayingCard = false; // Reset flag
             // Button remains disabled until next round or state change allows play
             // Let handleGameStateChange handle re-enabling based on the *full* game state after update.
        });
}

// NEW: Check if all necessary war cards have been played
function checkWarRoundCompletion() {
    // This function might be better integrated into handleGameStateChange
    // to ensure it runs only *after* Firebase confirms the update.
    // Let's rely on handleGameStateChange triggering resolveWarWinner.
    console.log("checkWarRoundCompletion called - deferring to handleGameStateChange");
}


function handleExitGame() {
    // ... (keep existing handleExitGame function) ...
    if (currentGame.gameCode && currentGame.playerId) {
         // Mark player as inactive instead of removing immediately
         // This prevents issues if they were the host or involved in state updates
         database.ref(`games/${currentGame.gameCode}/players/${currentGame.playerId}`).update({ active: false })
             .then(() => console.log(`Player ${currentGame.playerId} marked as inactive.`))
             .catch(err => console.error("Error marking player inactive:", err));

        // If host is leaving, ideally transfer host or end game gracefully
        if (currentGame.isHost) {
            // Option 1: Find next active player to be host
            const activePlayers = Object.entries(currentGame.players || {})
                                      .filter(([id, p]) => p.active && id !== currentGame.playerId);
            if (activePlayers.length > 0) {
                const newHostId = activePlayers[0][0];
                 database.ref(`games/${currentGame.gameCode}`).update({ host: newHostId })
                     .then(() => console.log(`Host transferred to ${newHostId}`))
                     .catch(err => console.error("Error transferring host:", err));
            } else {
                // Option 2: End the game if no other active players
                 database.ref(`games/${currentGame.gameCode}`).update({ status: 'ended', message: 'Host left, game ended.' })
                     .then(() => console.log("Host left, game ended."))
                     .catch(err => console.error("Error ending game:", err));
            }
        }
         // Remove listeners immediately
        removeListeners(currentGame.gameCode);
    }
    resetGameState();
    showWelcomeScreen();
}

// Game State Change Handler
function handleGameStateChange(gameData) {
    if (!gameData) {
        // Game data might be null if the game node was deleted
        console.warn("Received null game data. Game might have ended or been deleted.");
        // Avoid errors, potentially exit if not already handled
        if (gameScreen.classList.contains('hidden') === false) {
            alert("Game data not found. Returning to lobby.");
            handleExitGame(); // Gracefully exit
        }
        return; // Stop processing if no game data
    }

    const previousGameState = currentGame.gameState; // Store previous state for comparison
    currentGame.gameState = gameData; // Update current state

    // Update local player cards count if necessary
     if (gameData.players && gameData.players[currentGame.playerId]) {
        const myDbCards = gameData.players[currentGame.playerId].cards || [];
        // Only update local cards if they differ, prevents unnecessary redraws/flicker
        // This comparison might be flaky with object arrays, safer to just update if needed
        // Let's update if the length differs or if it was previously null/undefined
        if (!currentGame.myCards || currentGame.myCards.length !== myDbCards.length) {
             console.log("Updating local cards cache from DB state.");
             currentGame.myCards = Array.isArray(myDbCards) ? [...myDbCards] : [];
        }
     }


    // --- Handle Game Status Transitions ---
    if (gameData.status === 'playing') {
        if (lobbyScreen.classList.contains('hidden') === false) {
            showGameScreen();
            setupGameBoard(); // Setup board only once when transitioning to game screen
        }
        updateGameBoard(); // Update visuals based on new state
        updateGameStatusMessage(gameData.message || ""); // Display current message

        // --- Core Round/War Logic Trigger ---
        // Check if all active players have played their initial card
        const activePlayers = Object.keys(gameData.players || {}).filter(id => gameData.players[id].active);
        const battleCardsPlayed = Object.keys(gameData.battleCards || {}).length;
        const expectedBattleCards = activePlayers.length; // Number of players who *should* play

        // Condition 1: Regular round resolution
        if (!gameData.warState && battleCardsPlayed > 0 && battleCardsPlayed === expectedBattleCards) {
            if (!currentGame.isResolvingRound) { // Prevent multiple triggers
                currentGame.isResolvingRound = true;
                console.log(`All ${expectedBattleCards} battle cards played. Determining winner.`);
                updateGameStatusMessage("All cards played. Determining winner...");
                setTimeout(() => {
                    determineRoundWinner(); // This will handle ties and start war if needed
                    currentGame.isResolvingRound = false;
                }, 1500); // Delay for players to see cards
            }
        }
        // Condition 2: War resolution
        else if (gameData.warState && gameData.warStage === 'play_war_cards') {
             // Check if all *required* war players have played their face-up cards OR forfeited
            const warPlayers = gameData.warPlayers || [];
            const faceUpCardsPlayed = Object.keys(gameData.warFaceUpCards || {}).length;
            // How many players *should* have played war cards? (Those who had >= 2 cards)
            let expectedWarCards = 0;
            warPlayers.forEach(pId => {
                 // We need the card count *before* they played war cards. This is tricky.
                 // Let's assume if they are in warPlayers, they were expected to play.
                 // The resolution logic will handle those who didn't submit cards (ran out).
                 expectedWarCards++;
            });

             // Check if *all* players listed in warPlayers have an entry in warFaceUpCards
             // (or have forfeited - which we detect by absence for now)
             let allWarCardsAccountedFor = true;
             if(warPlayers.length === 0) allWarCardsAccountedFor = false; // Avoid resolving if no war players somehow

             // A better check: count how many war players *have* played
             let actualWarPlayersPlayed = 0;
             const playedWarCardIds = Object.keys(gameData.warFaceUpCards || {});
             warPlayers.forEach(pId => {
                 if (playedWarCardIds.includes(pId)) {
                     actualWarPlayersPlayed++;
                 }
                 // How to account for forfeits robustly? Maybe add a 'forfeitedWar' flag?
                 // For now, assume resolution handles missing entries.
             });

            // We need to know when *all* players *expected* to play *have* played or forfeited.
            // Let's trigger resolution when the number of faceUpCards equals the number of warPlayers.
            // This relies on handlePlayWarCards *not* adding an entry if the player forfeits.
            if (faceUpCardsPlayed > 0 && faceUpCardsPlayed === warPlayers.length) {
                 if (!currentGame.isResolvingRound) { // Prevent multiple triggers
                     currentGame.isResolvingRound = true;
                     console.log(`All ${warPlayers.length} war cards played. Resolving war.`);
                     updateGameStatusMessage("All war cards played. Resolving war...");
                     setTimeout(() => {
                         resolveWarWinner();
                         currentGame.isResolvingRound = false;
                     }, 1500); // Delay for visibility
                 }
            } else {
                // Still waiting for some war players
                 const waitingOn = warPlayers.filter(pId => !playedWarCardIds.includes(pId));
                 console.log(`Waiting for war cards from: ${waitingOn.join(', ')}`);
                 updateGameStatusMessage(`WAR! Waiting for cards from: ${waitingOn.map(id => gameData.players[id]?.name || id).join(', ')}`);
            }
        }

        // --- Handle War Animation ---
        if (gameData.warState && gameData.warStage === 'war_declare') {
            showWarAnimation();
            // Transition state after animation shows
            setTimeout(() => {
                // Check if the state hasn't changed already by another process
                if (currentGame.gameState?.warState && currentGame.gameState?.warStage === 'war_declare') {
                    console.log("Transitioning war state to play_war_cards");
                     updateGameState(currentGame.gameCode, {
                         warStage: 'play_war_cards',
                         message: "WAR! Play 2 cards (1 down, 1 up)."
                     });
                }
            }, 2000); // Duration of animation + buffer
        } else if (!gameData.warState) {
            hideWarAnimation(); // Ensure hidden if not in war
        }

    } else if (gameData.status === 'ended') {
         // Ensure UI is updated before showing alert
        updateGameBoard();
        const winnerId = gameData.winner;
        const winnerName = gameData.players && gameData.players[winnerId] ? gameData.players[winnerId].name : "Someone";
        const finalMessage = gameData.message || `${winnerName} has won the game!`;
        updateGameStatusMessage(finalMessage, false); // Display final message
        alert(finalMessage);
        disablePlayButton(); // Disable play button permanently
        // Optional: Add a "New Game" button or similar
    } else if (gameData.status === 'lobby') {
        // If game reverts to lobby (e.g., host restarts)
        showLobbyScreen();
        updatePlayersList(gameData.players || {});
    }
}


// Update Players List in Lobby
function updatePlayersList(playersData) {
    currentGame.players = playersData || {}; // Ensure players is an object
    playersList.innerHTML = ''; // Clear current list

    let activePlayerCount = 0;
    Object.keys(currentGame.players).forEach(playerId => {
        const player = currentGame.players[playerId];
        // Only list active players in the lobby list
        if (player.active) {
             activePlayerCount++;
            const li = document.createElement('li');
            li.textContent = player.name || 'Joining...'; // Show name or placeholder

            if (playerId === currentGame.playerId) {
                li.textContent += ' (You)';
                li.style.fontWeight = 'bold';
                // If player name is set, disable input/button
                if(player.name) {
                    playerNameInput.value = player.name;
                    playerNameInput.disabled = true;
                    setNameBtn.disabled = true;
                }
            }

            if (currentGame.gameState && playerId === currentGame.gameState.host) {
                li.textContent += ' (Host)';
            }
            playersList.appendChild(li);
        }
    });

     // Enable start game button for host only if enough active players have joined and set names
     if (currentGame.isHost) {
         const allActivePlayersNamed = Object.values(currentGame.players)
                                         .filter(p => p.active)
                                         .every(p => p.name && p.name.length > 0);
         startGameBtn.disabled = !(activePlayerCount >= 2 && activePlayerCount <= 10 && allActivePlayersNamed);
     } else {
         startGameBtn.disabled = true; // Non-hosts can never start
     }
}

// Setup Game Board (Called once when game screen loads)
function setupGameBoard() {
    playersArea.innerHTML = ''; // Clear previous player boxes
    hideWarAnimation(); // Ensure war animation is hidden initially

    Object.keys(currentGame.players).forEach(playerId => {
        // Only create boxes for active players
        if (currentGame.players[playerId].active) {
            const player = currentGame.players[playerId];
            const playerBox = document.createElement('div');
            playerBox.classList.add('player-box');
            playerBox.id = `player-${playerId}`;

            const playerName = document.createElement('div');
            playerName.classList.add('player-name');
            playerName.textContent = player.name || 'Unnamed Player'; // Use name from state

            if (playerId === currentGame.playerId) {
                playerName.textContent += ' (You)';
                playerBox.classList.add('active-player');
            }
             if (playerId === currentGame.gameState?.host) {
                 playerName.textContent += ' (Host)';
             }


            const playerCards = document.createElement('div');
            playerCards.classList.add('player-cards');
            // Initial count based on game start data (or 0 if somehow missing)
            const initialCardCount = Array.isArray(player.cards) ? player.cards.length : 0;
            playerCards.textContent = `Cards: ${initialCardCount}`;

            const cardDisplay = document.createElement('div');
            cardDisplay.classList.add('player-card-display'); // Area for card back/played card
             cardDisplay.innerHTML = `<div class="player-card card-back">?</div>`; // Default card back


            playerBox.appendChild(playerName);
            playerBox.appendChild(playerCards);
            playerBox.appendChild(cardDisplay); // Add card display area

            playersArea.appendChild(playerBox);
        }
    });

     // Ensure battle area is clear
     battleArea.innerHTML = '';

    // Set initial round count
    roundCount.textContent = currentGame.gameState?.currentRound || 0;
    updateGameStatusMessage(currentGame.gameState?.message || "Game Ready");
}


// Update Game Board (Called on every game state change during 'playing')
function updateGameBoard() {
    if (!currentGame.gameState || currentGame.gameState.status !== 'playing') return;

    // Update round count and status message
    roundCount.textContent = currentGame.gameState.currentRound || 0;
    updateGameStatusMessage(currentGame.gameState.message || "");

    const playersData = currentGame.gameState.players || {};
    const battleCardsData = currentGame.gameState.battleCards || {};
    const warFaceDownData = currentGame.gameState.warFaceDownCards || {};
    const warFaceUpData = currentGame.gameState.warFaceUpCards || {};
    const warPlayers = currentGame.gameState.warPlayers || [];

    // Update player boxes (card counts, active status)
    Object.keys(playersData).forEach(playerId => {
        const player = playersData[playerId];
        const playerBox = document.getElementById(`player-${playerId}`);

        if (playerBox) {
            // Update active status display (e.g., dim if inactive)
             if (!player.active) {
                 playerBox.classList.add('inactive-player'); // Add CSS for this class
                 playerBox.classList.remove('active-player'); // Ensure not marked as current player visually
                 // Optionally hide the card display if inactive
                 const cardDisplayArea = playerBox.querySelector('.player-card-display');
                 if(cardDisplayArea) cardDisplayArea.innerHTML = ''; // Clear card display

             } else {
                 playerBox.classList.remove('inactive-player');
                 // Update card count
                const playerCards = playerBox.querySelector('.player-cards');
                const cardCount = Array.isArray(player.cards) ? player.cards.length : 0;
                if (playerCards) playerCards.textContent = `Cards: ${cardCount}`;

                 // Update player's card display area (show card back if they haven't played)
                 const cardDisplayArea = playerBox.querySelector('.player-card-display');
                 if (cardDisplayArea) {
                    // Show card back by default if they are active and haven't played a battle card yet
                    // or if it's start of war declaration phase
                    if (!battleCardsData[playerId] && !(currentGame.gameState.warState && warFaceUpData[playerId])) {
                        // Keep card back if player still has cards
                        if (cardCount > 0) {
                           cardDisplayArea.innerHTML = `<div class="player-card card-back" title="Click to play (if enabled)">?</div>`;
                           // Add click listener IF it's the current player
                           if (playerId === currentGame.playerId) {
                               const cardBack = cardDisplayArea.querySelector('.card-back');
                               if(cardBack) cardBack.addEventListener('click', () => {
                                   if(!playCardBtn.disabled && !currentGame.isPlayingCard) {
                                       handlePlayCard();
                                   }
                               });
                               // Add hover effect
                                cardBack.addEventListener('mouseover', function() {
                                    if (!playCardBtn.disabled && !currentGame.isPlayingCard) {
                                        this.style.transform = 'scale(1.1)';
                                        this.style.boxShadow = '0 0 10px gold';
                                    }
                                });
                                cardBack.addEventListener('mouseout', function() {
                                    this.style.transform = '';
                                    this.style.boxShadow = '';
                                });
                           }
                        } else {
                           cardDisplayArea.innerHTML = '<div class="player-card empty-hand">OUT</div>'; // Indicate player is out
                        }
                    } else {
                        // Card already played or player is out, battle area will show the card
                        // Clear the personal card display area? Or keep showing card back?
                        // Let's keep showing card back for consistency unless out of cards.
                        if (cardCount === 0) {
                             cardDisplayArea.innerHTML = '<div class="player-card empty-hand">OUT</div>';
                        }
                    }
                 }
            }
        } else if (player.active) {
             // If player is active but has no box, might be a sync issue or needs setupGameBoard rerun
             console.warn(`No player box found for active player ${playerId}. Re-running setup might be needed.`);
             // setupGameBoard(); // Avoid calling this frequently, could cause flicker. Better to debug root cause.
         }
    });


    // --- Update Battle Area ---
    battleArea.innerHTML = ''; // Clear previous battle display

    // Section 1: Initial Battle Cards (Always show if they exist)
    if (Object.keys(battleCardsData).length > 0) {
        const initialSection = createCardSection('Current Battle:', 'initial-battle-cards');
        Object.entries(battleCardsData).forEach(([pId, card]) => {
            const player = playersData[pId];
            if (card && player) {
                const cardElement = createCardElement(card, player, ['battle-card']);
                // Highlight tied cards if war is declared
                if (currentGame.gameState.warState && warPlayers.includes(pId)) {
                     cardElement.classList.add('tied-card'); // Add CSS for this
                 }
                initialSection.container.appendChild(cardElement);
            }
        });
        battleArea.appendChild(initialSection.section);
    }

    // Section 2: War Cards (Only if in war state and cards exist)
    if (currentGame.gameState.warState && (Object.keys(warFaceDownData).length > 0 || Object.keys(warFaceUpData).length > 0)) {

        // Display Face Down Cards
        if (Object.keys(warFaceDownData).length > 0) {
            const downSection = createCardSection('War Cards (Face Down):', 'war-face-down-cards');
            Object.entries(warFaceDownData).forEach(([pId, card]) => {
                 const player = playersData[pId];
                 if (card && player) {
                     // Display as card back
                     const cardElement = document.createElement('div');
                     cardElement.classList.add('player-card', 'card-back', 'war-card', 'face-down');
                     cardElement.textContent = '?';
                     cardElement.title = `${player.name}'s face-down card`;
                     downSection.container.appendChild(cardElement);
                 }
             });
             battleArea.appendChild(downSection.section);
        }

         // Display Face Up Cards
        if (Object.keys(warFaceUpData).length > 0) {
             const upSection = createCardSection('War Cards (Face Up - Deciding Cards):', 'war-face-up-cards');
             Object.entries(warFaceUpData).forEach(([pId, card]) => {
                 const player = playersData[pId];
                 if (card && player) {
                     const cardElement = createCardElement(card, player, ['war-card', 'face-up']);
                     // Highlight tied face-up cards if war continues
                     // (Need logic in resolveWarWinner to determine if tie continues)
                     // if (isContinuingWarTie && tiedWarPlayers.includes(pId)) {
                     //    cardElement.classList.add('tied-card');
                     // }
                     upSection.container.appendChild(cardElement);
                 }
             });
              battleArea.appendChild(upSection.section);
        }
    }


    // --- Enable/Disable Play Button ---
    const myPlayerData = playersData[currentGame.playerId];
    const iAmActive = myPlayerData && myPlayerData.active;
    const iHaveCards = currentGame.myCards && currentGame.myCards.length > 0;

    if (iAmActive && iHaveCards) {
        let shouldBeEnabled = false;
        const warState = currentGame.gameState.warState;
        const warStage = currentGame.gameState.warStage;
        const iAmWarPlayer = warState && warPlayers.includes(currentGame.playerId);

        if (!warState) {
            // Regular play: Enable if haven't played battle card yet
            shouldBeEnabled = !battleCardsData[currentGame.playerId];
        } else if (warStage === 'play_war_cards') {
             // War play: Enable if haven't played war cards yet AND have enough cards
             const hasPlayedWarCards = warFaceUpData[currentGame.playerId]; // Check face-up card presence
             const hasEnoughForWar = currentGame.myCards.length >= 2;
             shouldBeEnabled = iAmWarPlayer && !hasPlayedWarCards && hasEnoughForWar;
        }
        // Other war stages ('war_declare', 'resolving_war') or if not war player: button disabled

        if (shouldBeEnabled && !currentGame.isPlayingCard) {
            enablePlayButton();
        } else {
            disablePlayButton();
        }

    } else {
        // Not active or no cards: disable button
        disablePlayButton();
    }
}

// Helper to create card sections in battle area
function createCardSection(labelText, sectionClass) {
    const section = document.createElement('div');
    section.classList.add('card-section', sectionClass);

    const label = document.createElement('div');
    label.classList.add('cards-section-label');
    label.textContent = labelText;

    const container = document.createElement('div');
    container.classList.add('cards-container');

    section.appendChild(label);
    section.appendChild(container);

    return { section, container };
}

// Helper to create a single card element
function createCardElement(card, player, additionalClasses = []) {
    const cardElement = document.createElement('div');
    cardElement.classList.add('player-card', ...additionalClasses);
    if (CARD_COLORS[card.suit] === 'red') {
        cardElement.classList.add('red');
    }
    cardElement.textContent = `${card.value}${card.suit}`;
    cardElement.title = `${player.name} played ${card.value}${card.suit}`; // Tooltip
    // Store data for potential animations or logic
    cardElement.dataset.playerId = player.playerId; // Assuming player object has playerId
    cardElement.dataset.playerName = player.name;
    cardElement.dataset.cardValue = CARD_VALUES.indexOf(card.value);
    return cardElement;
}


// Helper functions to properly enable/disable the play button
function enablePlayButton() {
    if (playCardBtn.disabled) { // Only log/change if state actually changes
         console.log('Play button enabled');
         playCardBtn.disabled = false;
         playCardBtn.classList.remove('disabled-button');
         // currentGame.isPlayingCard should be false if button is enabled
         currentGame.isPlayingCard = false;
    }
}

function disablePlayButton() {
     if (!playCardBtn.disabled) { // Only log/change if state actually changes
        console.log('Play button disabled');
        playCardBtn.disabled = true;
        playCardBtn.classList.add('disabled-button');
     }
}

// Helper to update game status message
function updateGameStatusMessage(message, isError = false) {
    const messageArea = gameStatusDiv; // Assuming game-status is the container
    // Clear previous content if needed, or append
     messageArea.innerHTML = `Status: <span class="${isError ? 'error-message' : ''}">${message}</span>`; // Replace entire content
     // Add CSS for .error-message { color: red; font-weight: bold; }
}


// Determine Round Winner (Handles regular rounds and initiates War)
function determineRoundWinner() {
    console.log("Determining round winner...");
    if (!currentGame.gameState || !currentGame.gameState.battleCards) {
        console.error("Cannot determine winner: Missing game state or battle cards.");
        currentGame.isResolvingRound = false; // Reset flag if error
        return;
    }

    const battleCards = currentGame.gameState.battleCards;
    const playersData = currentGame.gameState.players;
    const activePlayerIds = Object.keys(playersData).filter(id => playersData[id].active);

    // Ensure all active players have played
    if (Object.keys(battleCards).length !== activePlayerIds.length) {
         console.warn("Not all active players have played. Aborting winner determination.");
         // This case should ideally be caught by handleGameStateChange logic
         currentGame.isResolvingRound = false; // Reset flag
         return;
     }

    // Map cards to their values for comparison
    let highestValue = -1;
    const cardValuesByPlayer = {};
    activePlayerIds.forEach(playerId => {
        const card = battleCards[playerId];
        if (card) {
            const value = CARD_VALUES.indexOf(card.value);
            cardValuesByPlayer[playerId] = value;
            if (value > highestValue) {
                highestValue = value;
            }
        } else {
             console.error(`Error: Active player ${playerId} missing battle card.`);
             // Handle this error case - perhaps exclude player? For now, log it.
         }
    });

    // Find players with the highest value
    const winningPlayerIds = activePlayerIds.filter(
        playerId => cardValuesByPlayer[playerId] === highestValue
    );

    if (winningPlayerIds.length === 1) {
        // --- Single Winner ---
        const winnerId = winningPlayerIds[0];
        console.log(`Round winner determined: ${playersData[winnerId]?.name} (${winnerId})`);
        updateGameStatusMessage(`${playersData[winnerId]?.name} wins the round!`);
        // Animate and award cards
        // Get card elements from the DOM for animation
        const cardElements = battleArea.querySelectorAll('.battle-card'); // Select only battle cards for this animation
        animateBattleAndCollectCards(winnerId, cardElements, cardValuesByPlayer, Object.values(battleCards));
        // awardCardsToWinner will be called *after* animation completes

    } else if (winningPlayerIds.length > 1) {
        // --- Tie -> WAR! ---
        console.log(`Tie detected between: ${winningPlayerIds.map(id => playersData[id]?.name).join(', ')}. WAR declared!`);
        updateGameStatusMessage(`WAR between: ${winningPlayerIds.map(id => playersData[id]?.name).join(', ')}!`);

        // Prepare war state update
         const updates = {};
         updates[`/games/${currentGame.gameCode}/warState`] = true;
         updates[`/games/${currentGame.gameCode}/warPlayers`] = winningPlayerIds;
         updates[`/games/${currentGame.gameCode}/warStage`] = 'war_declare'; // Start with declaration/animation
         updates[`/games/${currentGame.gameCode}/warFaceDownCards`] = {}; // Reset war cards
         updates[`/games/${currentGame.gameCode}/warFaceUpCards`] = {};
         updates[`/games/${currentGame.gameCode}/warPot`] = Object.values(battleCards); // Initial pot = tied cards
         // *** IMPORTANT: Do NOT clear battleCards here. Keep them for display ***
         // updates[`/games/${currentGame.gameCode}/battleCards`] = {}; // NO!
         updates[`/games/${currentGame.gameCode}/message`] = `WAR declared! Waiting for animation...`;


         // Apply the update to trigger the war state change and animation
         database.ref().update(updates)
             .then(() => {
                 console.log("War state initialized in DB.");
                 // handleGameStateChange will now see warState=true, warStage='war_declare'
                 // and trigger the animation and subsequent state transition.
             })
             .catch(error => {
                 console.error("Error initiating war state:", error);
                 updateGameStatusMessage("Error starting war. Please try again.", true);
             });

    } else {
        // Should not happen if activePlayerIds > 0
        console.error("Error: No winners found, although players participated.");
    }

     // Reset the flag after handling (or attempting to handle) the round outcome
     // Let the subsequent state changes manage the flow.
     // currentGame.isResolvingRound = false; // Do this in the final step (awardCards or war state transition)
}


// Animate battle and collect cards (Modified to accept cards to award)
function animateBattleAndCollectCards(winnerId, cardElements, cardValues, cardsToAward) {
     console.log(`Animating battle win for ${winnerId}`);
     const winnerPlayerData = currentGame.players[winnerId];
     if (!winnerPlayerData) {
         console.error("Winner player data not found for animation.");
         awardCardsToWinner(winnerId, cardsToAward); // Award immediately if animation fails
         return;
     }

     const winningCardEl = Array.from(cardElements).find(
         cardEl => cardEl.dataset.playerId === winnerId
     );

     if (!winningCardEl) {
         console.warn("Winning card element not found in DOM for animation.");
         awardCardsToWinner(winnerId, cardsToAward); // Award immediately
         return;
     }

     const attackPromises = [];
     cardElements.forEach(cardEl => {
         const cardPlayerId = cardEl.dataset.playerId;
         if (cardPlayerId !== winnerId) {
             // Losing card animation
             const valueDiff = cardValues[winnerId] - cardValues[cardPlayerId];
             const isStrongAttack = valueDiff > 3;
             // Simplified animation: just mark as dying
             cardEl.classList.add('dying-card'); // Use existing CSS animation
             // Optionally add blood effect based on your CSS
             animateBloodEffect(cardEl, isStrongAttack); // New helper for blood
             attackPromises.push(new Promise(resolve => setTimeout(resolve, 700))); // Match CSS animation duration
         }
     });

     Promise.all(attackPromises).then(() => {
         console.log("Attack animations complete. Moving cards to winner.");
         animateCardsToWinner(winnerId, cardElements, cardsToAward); // Pass cards to award
     });
}

// NEW Helper for blood effect animation
function animateBloodEffect(targetCardElement, isStrong) {
    targetCardElement.classList.add('bloody-card'); // Trigger pulse CSS

    // Optional: Add dripping effect (if defined in CSS)
    const bloodDropsContainer = document.createElement('div');
    bloodDropsContainer.classList.add('blood-drops');
    const rect = targetCardElement.getBoundingClientRect();
     // Position near the card - adjust as needed
    bloodDropsContainer.style.left = `${rect.left + rect.width / 2 - 15}px`; // Center horizontally
    bloodDropsContainer.style.top = `${rect.top + rect.height / 2}px`; // Start near vertical center

    const dropCount = isStrong ? 5 : 3;
    for (let i = 0; i < dropCount; i++) {
        const drop = document.createElement('div');
        drop.classList.add('blood-drop');
         // Randomize appearance slightly
         drop.style.left = `${Math.random() * 20 - 10}px`;
         drop.style.top = `${Math.random() * 10}px`;
         drop.style.transform = `rotate(${Math.random() * 90 - 45}deg) scale(${Math.random() * 0.5 + 0.7})`;
        bloodDropsContainer.appendChild(drop);
    }
     document.body.appendChild(bloodDropsContainer); // Add to body for positioning

     // Trigger animation and cleanup
     setTimeout(() => {
         bloodDropsContainer.classList.add('dripping-blood'); // Assumes CSS animation exists
         setTimeout(() => {
             bloodDropsContainer.remove();
             targetCardElement.classList.remove('bloody-card'); // Clean up pulse effect
         }, 1500); // Duration of drip + buffer
     }, 100); // Short delay before starting drip
}


// Animate cards moving to winner player area (Modified to accept cards to award)
function animateCardsToWinner(winnerId, cardElements, cardsToAward) {
    const winnerBox = document.getElementById(`player-${winnerId}`);
    if (!winnerBox) {
        console.error("Winner player box not found for animation.");
        awardCardsToWinner(winnerId, cardsToAward); // Award immediately
        return;
    }

    const winnerRect = winnerBox.getBoundingClientRect();
    const targetX = winnerRect.left + winnerRect.width / 2;
    const targetY = winnerRect.top + winnerRect.height / 2;

    const animationPromises = [];
    cardElements.forEach((cardEl, index) => {
        // Make sure element is still in DOM
        if (!document.body.contains(cardEl)) {
            console.warn("Card element removed from DOM before animation could complete.");
            return; // Skip this card
        }
        const cardRect = cardEl.getBoundingClientRect();
        const moveX = targetX - cardRect.left - cardRect.width / 2;
        const moveY = targetY - cardRect.top - cardRect.height / 2;
        const rotateAmount = (Math.random() * 40 - 20) + 'deg';

        cardEl.style.setProperty('--moveX', `${moveX}px`);
        cardEl.style.setProperty('--moveY', `${moveY}px`);
        cardEl.style.setProperty('--rotateAmount', rotateAmount);
        cardEl.style.zIndex = 100 + index; // Ensure cards stack visually during animation

        const promise = new Promise(resolve => {
            setTimeout(() => {
                 // Check again if element exists before adding class
                 if (document.body.contains(cardEl)) {
                    cardEl.classList.add('moving-to-winner');
                    cardEl.addEventListener('animationend', () => {
                        // Optionally remove the element after animation IF the state update handles redraw
                        // cardEl.remove();
                        resolve();
                    }, { once: true });
                 } else {
                     resolve(); // Resolve immediately if element disappeared
                 }
            }, index * 50); // Stagger slightly
        });
        animationPromises.push(promise);
    });

    Promise.all(animationPromises).then(() => {
        console.log("Card move animations complete. Awarding cards.");
        // Clear battle area visually *before* awarding cards to prevent flicker
         battleArea.innerHTML = '';
        awardCardsToWinner(winnerId, cardsToAward); // Award cards in DB *after* animation
    });
}

// Resolve War Winner (Handles comparing face-up cards and subsequent ties)
function resolveWarWinner() {
    console.log("Resolving war winner...");
    if (!currentGame.gameState || !currentGame.gameState.warState || !currentGame.gameState.warPlayers) {
        console.error("Cannot resolve war: Invalid war state.");
        resetWarStateOnError(); // Attempt to reset state
        return;
    }

    const warPlayers = currentGame.gameState.warPlayers;
    const warFaceUpCards = currentGame.gameState.warFaceUpCards || {};
    const playersData = currentGame.gameState.players;

    // Identify players who actually played face-up cards (didn't forfeit/run out)
    const participatingWarPlayers = warPlayers.filter(pId => warFaceUpCards[pId]);

    if (participatingWarPlayers.length === 0) {
        console.warn("War resolution: No participating players found (all forfeited?). Awarding pot randomly from initial tie.");
        // Award the current pot randomly among the original war players
        const randomWinnerId = warPlayers[Math.floor(Math.random() * warPlayers.length)];
        updateGameStatusMessage(`All war players forfeited or ran out! Pot awarded randomly to ${playersData[randomWinnerId]?.name}.`);
        awardWarCardsToWinner(randomWinnerId); // Award the accumulated pot
        return;
    }

    if (participatingWarPlayers.length === 1) {
         // Only one player managed to play war cards (others forfeited/ran out)
         const winnerId = participatingWarPlayers[0];
         console.log(`War resolution: Only ${playersData[winnerId]?.name} played war cards. They win the pot.`);
         updateGameStatusMessage(`${playersData[winnerId]?.name} wins the war pot!`);
         awardWarCardsToWinner(winnerId); // Award accumulated pot
         return;
     }


    // Compare face-up cards of participating players
    let highestValue = -1;
    const warCardValues = {};
    participatingWarPlayers.forEach(pId => {
        const card = warFaceUpCards[pId];
        const value = CARD_VALUES.indexOf(card.value);
        warCardValues[pId] = value;
        if (value > highestValue) {
            highestValue = value;
        }
    });

    const warWinningPlayerIds = participatingWarPlayers.filter(
        pId => warCardValues[pId] === highestValue
    );

    if (warWinningPlayerIds.length === 1) {
        // --- Clear War Winner ---
        const winnerId = warWinningPlayerIds[0];
        console.log(`War resolution: Winner is ${playersData[winnerId]?.name} (${winnerId})`);
        updateGameStatusMessage(`${playersData[winnerId]?.name} wins the war!`);
        // Animate the face-up cards only? Or all cards? Let's just award directly for now.
         // TODO: Add animation for war win if desired
         const warCardElements = battleArea.querySelectorAll('.war-card.face-up'); // Select face-up cards
         // animateBattleAndCollectCards(winnerId, warCardElements, warCardValues, []); // Animate face-up, but awardWarCards handles DB

        awardWarCardsToWinner(winnerId); // Award the accumulated pot

    } else if (warWinningPlayerIds.length > 1) {
        // --- Another Tie -> Continue WAR! ---
        console.log(`War continues! Tie between: ${warWinningPlayerIds.map(id => playersData[id]?.name).join(', ')}`);
        updateGameStatusMessage(`WAR CONTINUES between: ${warWinningPlayerIds.map(id => playersData[id]?.name).join(', ')}!`);

        // Check if the tied players have enough cards for *another* round (2 cards)
        const playersWithEnoughCards = warWinningPlayerIds.filter(pId => {
            const playerCards = playersData[pId]?.cards || [];
            return Array.isArray(playerCards) && playerCards.length >= 2;
        });

        if (playersWithEnoughCards.length < warWinningPlayerIds.length || playersWithEnoughCards.length < 2 ) {
             // Someone ran out, or only one player left who can continue - cannot continue war
             console.log("Cannot continue war: Not enough players have 2+ cards.");
             // Award pot randomly among those who tied in this *latest* round
             const randomWinnerId = warWinningPlayerIds[Math.floor(Math.random() * warWinningPlayerIds.length)];
             updateGameStatusMessage(`Cannot continue war (lack of cards)! Pot awarded randomly to ${playersData[randomWinnerId]?.name}.`);
             awardWarCardsToWinner(randomWinnerId);

        } else {
             // Continue the war with the newly tied players
             console.log("Continuing war with players:", playersWithEnoughCards);
             const currentWarPot = currentGame.gameState.warPot || [];
             const newFaceDown = Object.values(currentGame.gameState.warFaceDownCards || {});
             const newFaceUp = Object.values(currentGame.gameState.warFaceUpCards || {});

             const updates = {};
             updates[`/games/${currentGame.gameCode}/warPlayers`] = playersWithEnoughCards; // Only those who can continue
             updates[`/games/${currentGame.gameCode}/warStage`] = 'war_declare'; // Restart the cycle
             updates[`/games/${currentGame.gameCode}/warFaceDownCards`] = {}; // Clear for next round
             updates[`/games/${currentGame.gameCode}/warFaceUpCards`] = {};
             updates[`/games/${currentGame.gameCode}/warPot`] = [...currentWarPot, ...newFaceDown, ...newFaceUp]; // Add last round's cards to pot
             // Keep warState = true
             // Keep battleCards as they were initially
             updates[`/games/${currentGame.gameCode}/message`] = `War continues! Declaring next round...`;

             database.ref().update(updates)
                 .then(() => console.log("War continuation state updated in DB."))
                 .catch(error => {
                     console.error("Error continuing war state:", error);
                     resetWarStateOnError(); // Attempt recovery
                 });
         }

    } else {
         // Should not happen
         console.error("War resolution error: No winning players identified among participants.");
         resetWarStateOnError();
     }
     // Reset flag after handling
     // currentGame.isResolvingRound = false; // Do this in awardWarCards or state transition
}

// Helper to reset war state in case of errors
function resetWarStateOnError() {
    console.error("Attempting to reset war state due to error.");
    updateGameStatusMessage("Error during war resolution. Attempting to reset.", true);
    const updates = {
        warState: false,
        warStage: null,
        warPlayers: null,
        warFaceDownCards: {},
        warFaceUpCards: {},
        warPot: [],
        battleCards: {}, // Clear battle cards on error reset
        message: "War resolved due to error. Starting next round."
        // Maybe increment round?
        // currentRound: (currentGame.gameState?.currentRound || 0) + 1
    };
    updateGameState(currentGame.gameCode, updates)
        .finally(() => {
            currentGame.isResolvingRound = false; // Ensure flag is reset
        });
}


// Show War Animation
function showWarAnimation() {
    // ... (keep existing showWarAnimation, including blood drops and timeout) ...
    console.log("Showing WAR animation.");
    warAnimation.classList.remove('hidden');
    for (let i = 0; i < 15; i++) { createBloodDrop(); }
    // Consider adding specific instructions for the 2-card play
    updateGameStatusMessage("WAR! Prepare to play 2 cards!");

    // Timeout logic might interfere, rely on state transitions primarily
    // setTimeout(() => {
    //     if (!currentGame.gameState?.warState) { hideWarAnimation(); }
    // }, 3000);
}

// Hide War Animation
function hideWarAnimation() {
    // ... (keep existing hideWarAnimation) ...
     if (!warAnimation.classList.contains('hidden')) {
         console.log("Hiding WAR animation.");
         warAnimation.classList.add('hidden');
         document.querySelectorAll('.blood').forEach(drop => drop.remove());
     }
}

// Create Blood Drop for Animation
function createBloodDrop() {
    // ... (keep existing createBloodDrop) ...
    const drop = document.createElement('div');
    drop.classList.add('blood');
    const centerX = window.innerWidth / 2; const centerY = window.innerHeight / 2;
    const angle = Math.random() * Math.PI * 2; const distance = Math.random() * 150 + 50;
    const x = centerX + Math.cos(angle) * distance; const y = centerY + Math.sin(angle) * distance;
    drop.style.left = x + 'px'; drop.style.top = y + 'px';
    const size = Math.random() * 30 + 10;
    drop.style.width = size + 'px'; drop.style.height = size + 'px';
    document.body.appendChild(drop);
    setTimeout(() => { drop.remove(); }, 1000); // Match CSS animation
}

// Reset game state (local)
function resetGameState() {
    // ... (keep most of existing resetGameState) ...
    currentGame = {
        gameCode: null,
        playerId: currentGame.playerId, // Keep player ID
        isHost: false,
        playerName: null,
        players: {},
        gameState: null,
        deck: [],
        myCards: [],
        isPlayingCard: false,
        appCheckVerified: currentGame.appCheckVerified, // Persist AppCheck status
        isResolvingRound: false,
        debugMode: false,
        forceWarCards: false
    };
    // Reset UI elements
    gameCodeInput.value = '';
    playerNameInput.value = '';
    playerNameInput.disabled = false;
    setNameBtn.disabled = false;
    startGameBtn.disabled = true;
    enablePlayButton(); // Ensure button is usable if they rejoin/create
    battleArea.innerHTML = '';
    playersArea.innerHTML = ''; // Clear player boxes too
    gameStatusDiv.textContent = 'Status: Waiting'; // Reset status message
    roundCount.textContent = '0';
    hideWarAnimation(); // Ensure war animation is hidden
}

// Screen navigation functions
function showScreen(screenToShow) { /* ... keep existing ... */
    [welcomeScreen, lobbyScreen, gameScreen].forEach(screen => screen.classList.add('hidden'));
    setTimeout(() => screenToShow.classList.remove('hidden'), 50);
}
function showWelcomeScreen() { showScreen(welcomeScreen); }
function showLobbyScreen() { showScreen(lobbyScreen); }
function showGameScreen() { showScreen(gameScreen); }


// Award War Cards to Winner (Handles collecting *all* war-related cards)
function awardWarCardsToWinner(winnerId) {
    console.log(`Awarding ALL war cards to winner: ${winnerId}`);
    if (!currentGame.gameState) {
        console.error("Cannot award war cards: Missing game state.");
        currentGame.isResolvingRound = false; // Reset flag on error
        return;
    }

    const initialBattleCards = Object.values(currentGame.gameState.battleCards || {});
    const faceDownCards = Object.values(currentGame.gameState.warFaceDownCards || {});
    const faceUpCards = Object.values(currentGame.gameState.warFaceUpCards || {});
    const potCards = currentGame.gameState.warPot || []; // Cards from previous war rounds

    const allCardsWon = [...initialBattleCards, ...potCards, ...faceDownCards, ...faceUpCards];
    console.log(`Total cards won in war: ${allCardsWon.length}`);

    if (allCardsWon.length === 0) {
         console.warn("No cards to award in war resolution.");
         // Proceed to reset state anyway
     }


    const winnerData = currentGame.players[winnerId];
    if (!winnerData) {
         console.error(`Cannot award war cards: Winner ${winnerId} not found.`);
         resetWarStateOnError(); // Try to recover
         return;
     }

    let winnerCards = Array.isArray(winnerData.cards) ? [...winnerData.cards] : [];
    winnerCards = [...winnerCards, ...allCardsWon]; // Add won cards to bottom

    // Prepare updates to reset war state and award cards
    const updates = {};
    updates[`/games/${currentGame.gameCode}/players/${winnerId}/cards`] = winnerCards;
    updates[`/games/${currentGame.gameCode}/warState`] = false;
    updates[`/games/${currentGame.gameCode}/warStage`] = null;
    updates[`/games/${currentGame.gameCode}/warPlayers`] = null;
    updates[`/games/${currentGame.gameCode}/warFaceDownCards`] = {};
    updates[`/games/${currentGame.gameCode}/warFaceUpCards`] = {};
    updates[`/games/${currentGame.gameCode}/warPot`] = [];
    updates[`/games/${currentGame.gameCode}/battleCards`] = {}; // Clear battle cards *after* war resolution
    updates[`/games/${currentGame.gameCode}/currentRound`] = (currentGame.gameState.currentRound || 0) + 1;
    updates[`/games/${currentGame.gameCode}/message`] = `${winnerData.name} won the war! Round ${currentGame.gameState.currentRound + 1} begins.`;


    // Apply updates
    updateGameState(currentGame.gameCode, updates)
        .then(() => {
            console.log("War state reset and cards awarded.");
            // Update local cards if I won
            if (winnerId === currentGame.playerId) {
                currentGame.myCards = winnerCards;
            }
            checkGameEnd(); // Check if this win ended the game
        })
        .catch(error => {
            console.error("Error finalizing war award:", error);
            // Difficult to recover here, maybe alert user?
            alert("Critical error awarding war cards. State might be inconsistent.");
        })
        .finally(() => {
             currentGame.isResolvingRound = false; // Reset resolution flag
             // Re-enable play button for next round IF player has cards (state change will handle this)
             console.log("War resolution complete.");
        });
}


// Award Cards to Winner (Regular Round) - Modified to accept cards explicitly
function awardCardsToWinner(winnerId, cardsWon) {
    console.log(`Awarding ${cardsWon.length} regular cards to winner: ${winnerId}`);
    if (!currentGame.gameState) {
        console.error("Cannot award regular cards: Missing game state.");
         currentGame.isResolvingRound = false; // Reset flag on error
        return;
    }
     if (!cardsWon || cardsWon.length === 0) {
         console.warn("No cards to award in regular round.");
          // Proceed to reset state anyway
     }


    const winnerData = currentGame.players[winnerId];
     if (!winnerData) {
         console.error(`Cannot award regular cards: Winner ${winnerId} not found.`);
         currentGame.isResolvingRound = false; // Reset flag
         // Maybe try to restart round? For now, just log.
         return;
     }


    let winnerCards = Array.isArray(winnerData.cards) ? [...winnerData.cards] : [];
    winnerCards = [...winnerCards, ...cardsWon]; // Add won cards to bottom

    // Prepare updates
    const updates = {};
    updates[`/games/${currentGame.gameCode}/players/${winnerId}/cards`] = winnerCards;
    updates[`/games/${currentGame.gameCode}/battleCards`] = {}; // Clear battle cards
    // Ensure war state is false if somehow set
    updates[`/games/${currentGame.gameCode}/warState`] = false;
    updates[`/games/${currentGame.gameCode}/warStage`] = null;
    updates[`/games/${currentGame.gameCode}/currentRound`] = (currentGame.gameState.currentRound || 0) + 1;
     updates[`/games/${currentGame.gameCode}/message`] = `${winnerData.name} won the round! Round ${currentGame.gameState.currentRound + 1} begins.`;


    // Apply updates
    updateGameState(currentGame.gameCode, updates)
        .then(() => {
            console.log("Regular round cards awarded.");
            // Update local cards if I won
            if (winnerId === currentGame.playerId) {
                currentGame.myCards = winnerCards;
            }
            checkGameEnd(); // Check if game ended
        })
        .catch(error => {
            console.error("Error awarding regular cards:", error);
            alert("Error awarding cards. State might be inconsistent.");
        })
        .finally(() => {
             currentGame.isResolvingRound = false; // Reset resolution flag
             // Button enabling handled by state change
             console.log("Regular round resolution complete.");
        });
}


// --- Card Deck Utilities --- (Keep existing: createDeck, shuffleDeck, dealCards) ---
function createDeck() { /* ... */
    const deck = [];
    for (const suit of CARD_SUITS) { for (const value of CARD_VALUES) { deck.push({ suit, value }); } }
    return deck;
}
function shuffleDeck(deck) { /* ... */
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    return shuffled;
}
function dealCards(deck, playerIds) { /* ... */
     const dealtCards = {};
     playerIds.forEach(playerId => { dealtCards[playerId] = []; });
     let currentPlayerIndex = 0;
     for (const card of deck) {
         const playerId = playerIds[currentPlayerIndex];
         dealtCards[playerId].push(card);
         currentPlayerIndex = (currentPlayerIndex + 1) % playerIds.length;
     }
     return dealtCards;
}


// Check Game End
function checkGameEnd() {
    console.log("Checking for game end...");
    if (!currentGame.gameState || !currentGame.gameState.players) {
        console.log("Cannot check game end: Missing state or players.");
        return;
    }

    const playersData = currentGame.gameState.players;
    let activePlayersWithCards = 0;
    let lastPlayerWithCardsId = null;

    Object.keys(playersData).forEach(playerId => {
        const player = playersData[playerId];
        // Only consider active players
        if (player.active) {
            const cardCount = Array.isArray(player.cards) ? player.cards.length : 0;
            if (cardCount > 0) {
                activePlayersWithCards++;
                lastPlayerWithCardsId = playerId;
            }
        }
    });

     console.log(`Active players with cards: ${activePlayersWithCards}`);

    // Game ends if only one active player has cards left
    if (activePlayersWithCards === 1 && lastPlayerWithCardsId) {
        const winnerName = playersData[lastPlayerWithCardsId]?.name || 'Winner';
        console.log(`Game Over! Winner: ${winnerName} (${lastPlayerWithCardsId})`);

        // Update game status to ended
        const updates = {};
        updates[`/games/${currentGame.gameCode}/status`] = 'ended';
        updates[`/games/${currentGame.gameCode}/winner`] = lastPlayerWithCardsId;
        updates[`/games/${currentGame.gameCode}/message`] = `Game Over! ${winnerName} wins!`;

        updateGameState(currentGame.gameCode, updates)
            .then(() => {
                console.log("Game end state set in DB.");
                // Alert is handled by handleGameStateChange when status becomes 'ended'
            })
            .catch(error => {
                console.error("Error setting game end state:", error);
                alert("Error ending game. Please refresh."); // Alert user directly on error
            });

    } else if (activePlayersWithCards === 0) {
         // Edge case: No players have cards? (e.g., simultaneous loss in war)
         console.warn("Game End Check: No active players have cards left. Ending game without a clear winner.");
         const updates = {};
         updates[`/games/${currentGame.gameCode}/status`] = 'ended';
         updates[`/games/${currentGame.gameCode}/winner`] = null; // No winner
         updates[`/games/${currentGame.gameCode}/message`] = `Game Over! Draw or unexpected end!`;
         updateGameState(currentGame.gameCode, updates);
     } else {
         console.log("Game continues.");
     }
}


// --- Add necessary CSS --- (Keep existing style injection) ---
document.head.insertAdjacentHTML('beforeend', `
<style>
.cards-section-label { font-size: 0.9rem; color: #ccc; margin: 8px 0 4px 0; text-align: center; font-weight: bold; text-transform: uppercase; }
.cards-container { display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 70px; /* Ensure space even if empty */ margin-bottom: 10px; padding: 5px; background: rgba(0,0,0,0.1); border-radius: 5px;}
.card-section { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #555; }
.card-section:last-child { border-bottom: none; }
.initial-battle-cards {}
.war-face-down-cards {}
.war-face-up-cards {}
.tied-card { outline: 3px solid #f9c74f; box-shadow: 0 0 15px rgba(249, 199, 79, 0.7); animation: pulse-tie 1.5s infinite alternate; }
.war-card { box-shadow: 0 0 10px rgba(255, 0, 0, 0.5); }
.war-card.face-up { border: 2px solid #ff6b6b; }
.player-card.card-back.face-down { background: linear-gradient(135deg, #555, #888); color: #eee; } /* Distinct back for face-down */
#war-animation { z-index: 10; /* Ensure above cards */ }
.player-box.inactive-player { opacity: 0.5; border: 1px solid #666; }
.player-card.empty-hand { background: #444; color: #888; font-size: 1rem; display: flex; justify-content: center; align-items: center; }
#game-status { font-weight: bold; color: #e0e0e0; background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 4px; min-height: 2em; }
.error-message { color: #f94144; font-weight: bold; }
.player-card-display { min-height: 140px; /* Match card height */ display: flex; justify-content: center; align-items: center; margin-top: 10px; }
.player-card.card-back[title]:hover { cursor: pointer; /* Indicate clickable back */ }


@keyframes pulse-tie {
    from { box-shadow: 0 0 15px rgba(249, 199, 79, 0.7); transform: scale(1); }
    to { box-shadow: 0 0 25px rgba(249, 199, 79, 1); transform: scale(1.03); }
}
/* Add other animations (dying-card, moving-to-winner, blood effects) from your styles.css if they are correct */
@keyframes cardDeath { 0% { transform: rotate(0); opacity: 1; } 25% { transform: rotate(-5deg) scale(1.05); } 100% { transform: rotate(5deg) scale(0.95); opacity: 0.5; } }
.dying-card { animation: cardDeath 0.7s forwards; }

@keyframes moveToWinner { 0% { transform: translate(0, 0) rotate(0) scale(1); opacity: 1; z-index: 5; } 100% { transform: translate(var(--moveX), var(--moveY)) rotate(var(--rotateAmount)) scale(0.7); opacity: 0; z-index: 5; } }
.moving-to-winner { animation: moveToWinner 1.2s forwards; position: relative; /* Needed for z-index */}

/* Blood Effects CSS (ensure these match your styles.css or add them here) */
.bloody-card { position: relative; overflow: visible; }
.bloody-card::after { content: ''; position: absolute; width: 100%; height: 100%; top: 0; left: 0; background: radial-gradient(circle, rgba(249, 65, 68, 0.3) 0%, rgba(0, 0, 0, 0) 70%); border-radius: 8px; opacity: 0; animation: blood-pulse 0.8s forwards; }
@keyframes blood-pulse { 0% { opacity: 0; transform: scale(0.5); } 50% { opacity: 0.8; } 100% { opacity: 0; transform: scale(1.2); } }

.blood-drops { position: absolute; width: 30px; height: 30px; z-index: 200; /* High z-index */ opacity: 0; pointer-events: none; }
.blood-drop { position: absolute; background: #f94144; border-radius: 50% 50% 50% 0; width: 8px; height: 8px; transform: rotate(-45deg); }
.blood-drop::before { content: ''; position: absolute; width: 4px; height: 4px; border-radius: 50%; background: #f94144; top: 1px; left: 2px; }
@keyframes bloodDrip { 0% { opacity: 0; transform: translateY(-10px); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(30px); } }
.dripping-blood { animation: bloodDrip 1.5s forwards; }
.blood { /* Style for WAR animation blood */ position: absolute; background: #f94144; border-radius: 50%; opacity: 0; animation: blood 1s forwards; z-index: 15; }
@keyframes blood { 0% { transform: scale(0); opacity: 0.8; } 100% { transform: scale(2); opacity: 0; } }

</style>
`);