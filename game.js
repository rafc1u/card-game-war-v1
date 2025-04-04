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
    isPlayingCard: false,  // Track if a card play is in progress
    appCheckVerified: false, // Track if App Check verification passed
    isResolvingRound: false, // Flag to prevent multiple winner checks
    debugMode: false,  // Flag for debug mode
    forceWarCards: false  // Flag to force war condition
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
    
    // NEW: Add space bar as an alternative way to play a card during war
    if (event.key === ' ' || event.key === 'Enter') {
        if (currentGame.gameState?.warState && 
            currentGame.gameState?.warStage === 'war_cards' &&
            currentGame.gameState?.warPlayers?.includes(currentGame.playerId) &&
            (!currentGame.gameState?.warCards || !currentGame.gameState?.warCards[currentGame.playerId])) {
            
            console.log('Emergency: Playing war card via keyboard shortcut');
            handleWarPlayCard();
        }
    }
    
    // NEW: Force enable play button with F key
    if (event.key.toLowerCase() === 'f') {
        if (currentGame.gameState?.warState) {
            console.log('FORCE ENABLE: Manually enabling play button');
            document.getElementById('play-card').disabled = false;
            document.getElementById('play-card').classList.remove('disabled-button');
            currentGame.isPlayingCard = false;
            alert('Play button forcibly enabled. Try clicking it now.');
        }
    }
});

// Setup App Check after Firebase is initialized
function setupAppCheck() {
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
    let errorMessage = 'Firebase security verification failed. ';
    
    if (error && error.code) {
        switch (error.code) {
            case 'app-check/token-error':
                errorMessage += 'Unable to verify app identity. ';
                break;
            case 'app-check/throttled':
                errorMessage += 'Too many verification attempts. Please try again later. ';
                break;
            default:
                errorMessage += 'Please refresh the page and try again. ';
        }
    }
    
    errorMessage += 'If this problem persists, please contact support.';
    
    // Show error to user
    alert(errorMessage);
}

// Check App Check verification before database operations
function checkAppCheckBeforeOperation(operation, fallback = null) {
    // In development mode or if App Check is unavailable, allow operations
    if (window.location.hostname === 'localhost' || currentGame.appCheckVerified) {
        return operation();
    } else {
        console.warn('Operation attempted before App Check verification');
        if (fallback) {
            return fallback();
        }
        // Return a rejected promise with an error
        return Promise.reject(new Error('App Check verification required'));
    }
}

// Initialize - check URL for game code and setup App Check
document.addEventListener('DOMContentLoaded', () => {
    // Give App Check a moment to initialize first
    setTimeout(() => {
        setupAppCheck();
        
        // Now attempt to check for and join a game via URL code
        // This ensures setupAppCheck has likely run and set appCheckVerified
        setTimeout(() => {
            checkUrlForGameCode();
        }, 200); // Short delay after App Check setup attempted

    }, 1000); // Initial delay for Firebase/AppCheck scripts
});

// Copy URL Handler
function handleCopyUrl() {
    const gameCode = currentGame.gameCode;
    if (!gameCode) return;
    
    // Create shareable URL with game code
    const shareableUrl = generateShareableUrl(gameCode);
    
    // Copy to clipboard
    copyToClipboard(shareableUrl);
    
    // Show confirmation message
    showCopyConfirmation();
}

// Generate shareable URL with game code
function generateShareableUrl(gameCode) {
    // Get the current URL without any query parameters
    const url = new URL(window.location.href.split('?')[0]);
    
    // Add game code as query parameter
    url.searchParams.set('code', gameCode);
    
    return url.toString();
}

// Copy text to clipboard
function copyToClipboard(text) {
    // Create a temporary input element
    const tempInput = document.createElement('input');
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-1000px';
    tempInput.value = text;
    document.body.appendChild(tempInput);
    
    // Select and copy the text
    tempInput.select();
    document.execCommand('copy');
    
    // Remove the temporary element
    document.body.removeChild(tempInput);
}

// Show copy confirmation message
function showCopyConfirmation() {
    copyConfirmation.classList.remove('hidden');
    
    // Hide after 2 seconds
    setTimeout(() => {
        copyConfirmation.classList.add('hidden');
    }, 2000);
}

// Create Game Handler
async function handleCreateGame() {
    try {
        const gameCode = await checkAppCheckBeforeOperation(
            () => createGame(),
            () => {
                console.warn('App Check verification required for createGame');
                return Promise.reject(new Error('App Check verification required'));
            }
        );
        
        currentGame.gameCode = gameCode;
        currentGame.isHost = true;
        
        // Update the host in the database
        await database.ref(`games/${gameCode}`).update({
            host: currentGame.playerId
        });
        
        showLobbyScreen();
        gameCodeDisplay.textContent = gameCode;
        
        // Listen for changes in the game
        listenForGameChanges(gameCode, handleGameStateChange);
        listenForPlayerChanges(gameCode, updatePlayersList);
    } catch (error) {
        alert('Error creating game: ' + error.message);
    }
}

// Join Game Handler
async function handleJoinGame() {
    const gameCode = gameCodeInput.value.trim().toUpperCase();
    
    if (!gameCode) {
        alert('Please enter a game code');
        return;
    }
    
    try {
        await checkAppCheckBeforeOperation(
            () => joinGame(gameCode),
            () => {
                console.warn('App Check verification required for joinGame');
                return Promise.reject(new Error('App Check verification required'));
            }
        );
        
        currentGame.gameCode = gameCode;
        
        showLobbyScreen();
        gameCodeDisplay.textContent = gameCode;
        
        // Listen for changes in the game
        listenForGameChanges(gameCode, handleGameStateChange);
        listenForPlayerChanges(gameCode, updatePlayersList);
    } catch (error) {
        alert('Error joining game: ' + error.message);
    }
}

// Check for game code in URL on page load
function checkUrlForGameCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameCode = urlParams.get('code');
    
    if (gameCode) {
        gameCodeInput.value = gameCode;
        handleJoinGame();
    }
}

// Set Name Handler
async function handleSetName() {
    const name = playerNameInput.value.trim();
    
    if (!name) {
        alert('Please enter your name');
        return;
    }
    
    try {
        await checkAppCheckBeforeOperation(
            () => setPlayerName(currentGame.gameCode, currentGame.playerId, name),
            () => {
                console.warn('App Check verification required for setPlayerName');
                return Promise.reject(new Error('App Check verification required'));
            }
        );
        
        currentGame.playerName = name;
        setNameBtn.disabled = true;
        playerNameInput.disabled = true;
        
        // If host, enable the start game button once name is set
        if (currentGame.isHost) {
            startGameBtn.disabled = false;
        }
    } catch (error) {
        alert('Error setting name: ' + error.message);
    }
}

// Start Game Handler
async function handleStartGame() {
    if (!currentGame.isHost) return;
    
    const playerCount = Object.keys(currentGame.players).length;
    
    if (playerCount < 2) {
        alert('Need at least 2 players to start');
        return;
    }
    
    if (playerCount > 10) {
        alert('Maximum 10 players allowed');
        return;
    }
    
    try {
        await checkAppCheckBeforeOperation(async () => {
            // Create and shuffle deck
            const deck = createDeck();
            const shuffledDeck = shuffleDeck(deck);
            
            // Deal cards to players
            const dealtCards = dealCards(shuffledDeck, Object.keys(currentGame.players));
            
            // Update database with dealt cards
            const updates = {};
            Object.keys(dealtCards).forEach(playerId => {
                updates[`games/${currentGame.gameCode}/players/${playerId}/cards`] = dealtCards[playerId];
            });
            
            await firebase.database().ref().update(updates);
            
            // Start the game
            await startGame(currentGame.gameCode);
        }, () => {
            console.warn('App Check verification required for startGame');
            return Promise.reject(new Error('App Check verification required'));
        });
    } catch (error) {
        alert('Error starting game: ' + error.message);
    }
}

// Play Card Handler
function handlePlayCard() {
    // Prevent clicks if button is disabled OR a play is already in progress
    if (playCardBtn.disabled || currentGame.isPlayingCard) {
        return;
    }
    
    // Set the playing state to true
    currentGame.isPlayingCard = true;
    
    // Disable button immediately to prevent double-clicks
    disablePlayButton();
    
    // Check if we're in war state
    if (currentGame.gameState && currentGame.gameState.warState && 
        currentGame.gameState.warStage === 'war_cards' &&
        currentGame.gameState.warPlayers &&
        currentGame.gameState.warPlayers.includes(currentGame.playerId)) {
        
        handleWarPlayCard();
        return;
    }

    if (!currentGame.myCards || currentGame.myCards.length === 0) {
        alert('You have no cards left');
        // Re-enable button if the action failed
        enablePlayButton();
        return;
    }
    
    // Check if we've already played a card this round
    if (currentGame.gameState.battleCards && 
        currentGame.gameState.battleCards[currentGame.playerId]) {
        console.log('Already played a card this round');
        currentGame.isPlayingCard = false;
        return;
    }
    
    // Get the top card
    const topCard = currentGame.myCards[0];
    
    // Create a copy of the card for display while database updates
    const cardCopy = { ...topCard };
    
    // Debug mode: Force card to be a 10 of hearts for war testing
    if (currentGame.forceWarCards) {
        console.log('Debug mode: Forcing card to 10♥');
        cardCopy.value = '10';
        cardCopy.suit = '♥';
    }
    
    // Update local state first (optimistic update)
    const updatedCards = [...currentGame.myCards];
    updatedCards.shift();
    currentGame.myCards = updatedCards;
    
    // Add to battle cards in database
    const battleCardRef = database.ref(`games/${currentGame.gameCode}/battleCards/${currentGame.playerId}`);
    battleCardRef.set(cardCopy)
        .then(() => {
            // Then update my cards in database
            return updatePlayerState(currentGame.gameCode, currentGame.playerId, {
                cards: updatedCards
            });
        })
        .catch(error => {
            // Revert local state if there was an error
            console.error('Error playing card:', error);
            currentGame.myCards.unshift(cardCopy);
            enablePlayButton();
        })
        .finally(() => {
            // Reset playing state
            currentGame.isPlayingCard = false;
        });
}

// Exit Game Handler
function handleExitGame() {
    // Remove player from game
    if (currentGame.gameCode) {
        database.ref(`games/${currentGame.gameCode}/players/${currentGame.playerId}`).remove();
        
        // If host is leaving, end the game
        if (currentGame.isHost) {
            database.ref(`games/${currentGame.gameCode}`).update({
                status: 'ended'
            });
        }
        
        // Remove listeners
        removeListeners(currentGame.gameCode);
    }
    
    // Reset game state
    resetGameState();
    
    // Show welcome screen
    showWelcomeScreen();
}

// Game State Change Handler
function handleGameStateChange(gameData) {
    // Store the previous state for comparison
    const previousWarStage = currentGame.gameState?.warStage;
    
    // Update the game state
    currentGame.gameState = gameData;
    
    // Update based on game status
    if (gameData.status === 'playing') {
        if (lobbyScreen.classList.contains('hidden') === false) {
            showGameScreen();
            setupGameBoard();
        }
        
        updateGameBoard();
        
        // Handle different war stages
        if (gameData.warState) {
            showWarAnimation();
            
            // Check for war state transition to war_cards
            if (previousWarStage === 'war_declare' && gameData.warStage === 'war_cards') {
                console.log('War stage changed from declare to cards - refreshing UI');
            }
            
            // Check if all war players have played their cards
            if (gameData.warStage === 'war_cards' && 
                gameData.warCards && 
                gameData.warPlayers && 
                Object.keys(gameData.warCards).length === gameData.warPlayers.length) {
                
                setTimeout(() => {
                    resolveWarWinner();
                }, 1000);
            }
        } else {
            hideWarAnimation(); // Ensure it's hidden if not in war state
            
            // Regular round checking
            if (gameData.battleCards && 
                Object.keys(gameData.players).length > 0 && // Ensure players exist
                Object.keys(gameData.battleCards).length === Object.keys(gameData.players).length) {
                
                // Check if round winner calculation is already in progress
                if (!currentGame.isResolvingRound) {
                    currentGame.isResolvingRound = true;
                    setTimeout(() => {
                        determineRoundWinner();
                        currentGame.isResolvingRound = false; // Reset flag
                    }, 1000);
                }
            }
        }
    } else if (gameData.status === 'ended') {
        alert('Game has ended');
        handleExitGame();
    }
}

// Update Players List
function updatePlayersList(players) {
    currentGame.players = players;
    
    // Clear players list
    playersList.innerHTML = '';
    
    // Add each player to the list
    Object.keys(players).forEach(playerId => {
        const player = players[playerId];
        const li = document.createElement('li');
        li.textContent = player.name || 'Unnamed Player';
        
        if (playerId === currentGame.playerId) {
            li.textContent += ' (You)';
            li.style.fontWeight = 'bold';
        }
        
        if (currentGame.gameState && playerId === currentGame.gameState.host) {
            li.textContent += ' (Host)';
        }
        
        playersList.appendChild(li);
    });
    
    // Update my cards if they exist
    if (players[currentGame.playerId] && players[currentGame.playerId].cards) {
        currentGame.myCards = players[currentGame.playerId].cards;
    }
}

// Setup Game Board
function setupGameBoard() {
    playersArea.innerHTML = '';
    
    // Ensure WAR animation is hidden at start
    hideWarAnimation();
    
    // Create player boxes
    Object.keys(currentGame.players).forEach(playerId => {
        const player = currentGame.players[playerId];
        
        const playerBox = document.createElement('div');
        playerBox.classList.add('player-box');
        playerBox.id = `player-${playerId}`;
        
        const playerName = document.createElement('div');
        playerName.classList.add('player-name');
        playerName.textContent = player.name;
        
        if (playerId === currentGame.playerId) {
            playerName.textContent += ' (You)';
            playerBox.classList.add('active-player');
        }
        
        const playerCards = document.createElement('div');
        playerCards.classList.add('player-cards');
        playerCards.textContent = `Cards: ${player.cards ? player.cards.length : 0}`;
        
        const cardDisplay = document.createElement('div');
        cardDisplay.classList.add('player-card', 'card-back');
        cardDisplay.textContent = '��';
        
        // NEW: Add click handler to card back as alternative to button
        if (playerId === currentGame.playerId) {
            cardDisplay.style.cursor = 'pointer';
            cardDisplay.addEventListener('click', function() {
                if (currentGame.gameState?.warState && 
                    currentGame.gameState?.warStage === 'war_cards' &&
                    currentGame.gameState?.warPlayers?.includes(currentGame.playerId) &&
                    (!currentGame.gameState?.warCards || !currentGame.gameState?.warCards[currentGame.playerId])) {
                    
                    console.log('Emergency: Playing war card via card click');
                    handleWarPlayCard();
                } else if (!playCardBtn.disabled) {
                    handlePlayCard();
                }
            });
            
            // Add hover effect
            cardDisplay.addEventListener('mouseover', function() {
                if ((currentGame.gameState?.warState && 
                     currentGame.gameState?.warStage === 'war_cards' &&
                     currentGame.gameState?.warPlayers?.includes(currentGame.playerId) &&
                     (!currentGame.gameState?.warCards || !currentGame.gameState?.warCards[currentGame.playerId])) ||
                    !playCardBtn.disabled) {
                    this.style.transform = 'scale(1.1)';
                    this.style.boxShadow = '0 0 10px gold';
                }
            });
            
            cardDisplay.addEventListener('mouseout', function() {
                this.style.transform = '';
                this.style.boxShadow = '';
            });
        }
        
        playerBox.appendChild(playerName);
        playerBox.appendChild(playerCards);
        playerBox.appendChild(cardDisplay);
        
        playersArea.appendChild(playerBox);
    });
    
    // Add war instructions
    const warInstructions = document.createElement('div');
    warInstructions.id = 'war-instructions';
    warInstructions.classList.add('hidden');
    warInstructions.innerHTML = `
        <p>WAR! Play your next card or:</p>
        <ul>
            <li>Click your card directly</li>
            <li>Press SPACE or ENTER</li>
            <li>Press F to force-enable button</li>
        </ul>
    `;
    document.getElementById('game-screen').appendChild(warInstructions);
}

// Update Game Board
function updateGameBoard() {
    // Update round count
    if (currentGame.gameState) {
        roundCount.textContent = currentGame.gameState.currentRound || 0;
    }
    
    // Update player cards count
    Object.keys(currentGame.players).forEach(playerId => {
        const player = currentGame.players[playerId];
        const playerBox = document.getElementById(`player-${playerId}`);
        
        if (playerBox) {
            const playerCards = playerBox.querySelector('.player-cards');
            const cardCount = player.cards ? (Array.isArray(player.cards) ? player.cards.length : 0) : 0;
            playerCards.textContent = `Cards: ${cardCount}`;
            
            // Disable players who are out of cards
            if (cardCount === 0) {
                playerBox.classList.add('disabled');
            } else {
                playerBox.classList.remove('disabled');
            }
        }
    });
    
    // Update battle area with played cards
    if (currentGame.gameState) {
        battleArea.innerHTML = '';
        
        // First section: Initial battle cards that caused the war (if in war state)
        if (currentGame.gameState.warState && currentGame.gameState.battleCards) {
            // Create a section for initial battle cards
            const initialCardsSection = document.createElement('div');
            initialCardsSection.classList.add('initial-battle-cards');
            
            // Add a label
            const initialLabel = document.createElement('div');
            initialLabel.classList.add('cards-section-label');
            initialLabel.textContent = 'Initial Tied Cards:';
            initialCardsSection.appendChild(initialLabel);
            
            // Add the cards div
            const initialCards = document.createElement('div');
            initialCards.classList.add('cards-container');
            
            // Add the actual cards
            Object.keys(currentGame.gameState.battleCards).forEach(playerId => {
                const card = currentGame.gameState.battleCards[playerId];
                const player = currentGame.players[playerId];
                
                if (card && player) {
                    const cardElement = document.createElement('div');
                    cardElement.classList.add('player-card', 'initial-war-card');
                    
                    if (CARD_COLORS[card.suit] === 'red') {
                        cardElement.classList.add('red');
                    }
                    
                    cardElement.textContent = `${card.value}${card.suit}`;
                    cardElement.dataset.playerId = playerId;
                    cardElement.dataset.playerName = player.name;
                    cardElement.dataset.cardValue = CARD_VALUES.indexOf(card.value);
                    
                    initialCards.appendChild(cardElement);
                }
            });
            
            initialCardsSection.appendChild(initialCards);
            battleArea.appendChild(initialCardsSection);
        }
        // Regular battle cards (if not in war state)
        else if (currentGame.gameState.battleCards) {
            Object.keys(currentGame.gameState.battleCards).forEach(playerId => {
                const card = currentGame.gameState.battleCards[playerId];
                const player = currentGame.players[playerId];
                
                if (card && player) {
                    const cardElement = document.createElement('div');
                    cardElement.classList.add('player-card');
                    
                    if (CARD_COLORS[card.suit] === 'red') {
                        cardElement.classList.add('red');
                    }
                    
                    cardElement.textContent = `${card.value}${card.suit}`;
                    cardElement.dataset.playerId = playerId;
                    cardElement.dataset.playerName = player.name;
                    cardElement.dataset.cardValue = CARD_VALUES.indexOf(card.value);
                    
                    battleArea.appendChild(cardElement);
                }
            });
        }
        
        // Second section: War cards (if in war state)
        if (currentGame.gameState.warState && currentGame.gameState.warCards && Object.keys(currentGame.gameState.warCards).length > 0) {
            // Create a section for war cards
            const warCardsSection = document.createElement('div');
            warCardsSection.classList.add('war-cards-section');
            
            // Add a label
            const warLabel = document.createElement('div');
            warLabel.classList.add('cards-section-label');
            warLabel.textContent = 'War Cards:';
            warCardsSection.appendChild(warLabel);
            
            // Add the cards div
            const warCardsContainer = document.createElement('div');
            warCardsContainer.classList.add('cards-container');
            
            // Add the actual war cards
            Object.keys(currentGame.gameState.warCards).forEach(playerId => {
                const card = currentGame.gameState.warCards[playerId];
                const player = currentGame.players[playerId];
                
                if (card && player) {
                    const cardElement = document.createElement('div');
                    cardElement.classList.add('player-card', 'war-card');
                    
                    if (CARD_COLORS[card.suit] === 'red') {
                        cardElement.classList.add('red');
                    }
                    
                    cardElement.textContent = `${card.value}${card.suit}`;
                    cardElement.dataset.playerId = playerId;
                    cardElement.dataset.playerName = player.name;
                    cardElement.dataset.cardValue = CARD_VALUES.indexOf(card.value);
                    
                    warCardsContainer.appendChild(cardElement);
                }
            });
            
            warCardsSection.appendChild(warCardsContainer);
            battleArea.appendChild(warCardsSection);
        }
    }
    
    // Enable/disable play button depending on game state
    if (currentGame.myCards && currentGame.myCards.length > 0) {
        if (currentGame.gameState.warState) {
            // Enable only for war players
            const isWarPlayer = currentGame.gameState.warPlayers && 
                                currentGame.gameState.warPlayers.includes(currentGame.playerId);
            const isWarCardsStage = currentGame.gameState.warStage === 'war_cards';
            const hasNotPlayedWarCard = !currentGame.gameState.warCards || 
                                      !currentGame.gameState.warCards[currentGame.playerId];
            
            console.log('War state conditions:', {
                isWarPlayer,
                isWarCardsStage,
                hasNotPlayedWarCard,
                warPlayers: currentGame.gameState.warPlayers,
                warStage: currentGame.gameState.warStage,
                warCards: currentGame.gameState.warCards
            });
            
            if (isWarPlayer && isWarCardsStage && hasNotPlayedWarCard) {
                if (playCardBtn.disabled) {
                    console.log('Enabling war play button that was previously disabled');
                    enablePlayButton();
                }
            } else {
                if (!playCardBtn.disabled) {
                    console.log('Disabling war play button that was previously enabled');
                    disablePlayButton();
                }
            }
        } else {
            // Regular play
            if (!currentGame.gameState.battleCards || !currentGame.gameState.battleCards[currentGame.playerId]) {
                if (playCardBtn.disabled) {
                    console.log('Enabling regular play button that was previously disabled');
                    enablePlayButton();
                }
            } else {
                if (!playCardBtn.disabled) {
                    console.log('Disabling regular play button that was previously enabled');
                    disablePlayButton();
                }
            }
        }
    } else {
        if (!playCardBtn.disabled) {
            console.log('Disabling play button due to no cards');
            disablePlayButton();
        }
    }
    
    // EMERGENCY FIX: Extra check for war state button enabling
    if (currentGame.gameState?.warState && 
        currentGame.gameState?.warStage === 'war_cards' &&
        currentGame.gameState?.warPlayers && 
        currentGame.gameState?.warPlayers.includes(currentGame.playerId) &&
        (!currentGame.gameState?.warCards || !currentGame.gameState?.warCards[currentGame.playerId]) &&
        currentGame.myCards && 
        currentGame.myCards.length > 0 &&
        playCardBtn.disabled) {
        
        console.log('Emergency fix: Enabling play button in updateGameBoard during war');
        enablePlayButton();
    }
}

// Helper functions to properly enable/disable the play button
function enablePlayButton() {
    playCardBtn.disabled = false;
    playCardBtn.classList.remove('disabled-button');
    currentGame.isPlayingCard = false;
    console.log('Play button enabled');
}

function disablePlayButton() {
    playCardBtn.disabled = true;
    playCardBtn.classList.add('disabled-button');
    console.log('Play button disabled');
}

// Determine Round Winner
function determineRoundWinner() {
    if (!currentGame.gameState || !currentGame.gameState.battleCards) return;
    
    // Get all battle cards
    const battleCards = currentGame.gameState.battleCards;
    
    // Map cards to their values
    const cardValues = {};
    Object.keys(battleCards).forEach(playerId => {
        const card = battleCards[playerId];
        const value = CARD_VALUES.indexOf(card.value);
        cardValues[playerId] = value;
    });
    
    // Find highest value
    const highestValue = Math.max(...Object.values(cardValues));
    
    // Find players with highest value
    const winningPlayers = Object.keys(cardValues).filter(
        playerId => cardValues[playerId] === highestValue
    );
    
    // If more than one winner, it's a war
    if (winningPlayers.length > 1) {
        // Set war state
        updateGameState(currentGame.gameCode, {
            warState: true,
            warPlayers: winningPlayers,
            warStage: 'war_declare',
            warCards: {}
        });
        
        // Keep battle cards visible instead of resetting them (key change)
        // Store them in warInitialCards and keep them in battleCards for display
        const warPot = Object.values(battleCards);
        
        // Store the war pot in the database
        updateGameState(currentGame.gameCode, {
            warPot: warPot,
            warInitialCards: battleCards // Store the initial tied cards
            // Don't reset battleCards: battleCards: null - keep them visible
        });
        
        // After animation, prompt war players to play additional cards
        setTimeout(() => {
            updateGameState(currentGame.gameCode, {
                warStage: 'war_cards',
                message: 'War! Play your next card!'
            })
            .catch(error => {
                console.error('Error updating war stage:', error);
            });
        }, 3000);
    } else {
        // One clear winner - animate the victory
        const winnerId = winningPlayers[0];
        
        // Get cards in the battle area
        const cardElements = battleArea.querySelectorAll('.player-card');
        if (cardElements.length >= 2) {
            animateBattleAndCollectCards(winnerId, cardElements, cardValues);
        } else {
            // If animation can't work, just award cards
            awardCardsToWinner(winnerId);
        }
    }
}

// Animate battle and collect cards
function animateBattleAndCollectCards(winnerId, cardElements, cardValues) {
    // Find winning card element
    const winningCardEl = Array.from(cardElements).find(
        cardEl => cardEl.dataset.playerId === winnerId
    );
    
    if (!winningCardEl) {
        awardCardsToWinner(winnerId);
        return;
    }
    
    // Create attack animations for each losing card
    const attackPromises = [];
    
    cardElements.forEach(cardEl => {
        if (cardEl.dataset.playerId !== winnerId) {
            // This is a losing card
            const losingPlayerId = cardEl.dataset.playerId;
            
            // Determine attack type based on card value difference
            const valueDiff = cardValues[winnerId] - cardValues[losingPlayerId];
            const isStrongAttack = valueDiff > 3; // Bigger difference = stronger attack
            
            // Create attack animation
            const attackPromise = animateAttack(winningCardEl, cardEl, isStrongAttack);
            attackPromises.push(attackPromise);
        }
    });
    
    // After all attack animations complete, move cards to winner
    Promise.all(attackPromises).then(() => {
        animateCardsToWinner(winnerId, cardElements);
    });
}

// Animate attack from winning card to losing card
function animateAttack(winningCard, losingCard, isStrongAttack) {
    return new Promise(resolve => {
        // Calculate positions
        const winRect = winningCard.getBoundingClientRect();
        const loseRect = losingCard.getBoundingClientRect();
        
        // Use blood drops for all attacks
        losingCard.classList.add('bloody-card');
        
        // Create blood drops
        const bloodDropsContainer = document.createElement('div');
        bloodDropsContainer.classList.add('blood-drops');
        
        // Position at center of losing card
        bloodDropsContainer.style.left = `${loseRect.left + loseRect.width / 2}px`;
        bloodDropsContainer.style.top = `${loseRect.top + loseRect.height / 3}px`;
        
        // Create multiple blood drops - more drops for stronger attacks
        const dropCount = isStrongAttack ? 8 : 5;
        
        for (let i = 0; i < dropCount; i++) {
            const drop = document.createElement('div');
            drop.classList.add('blood-drop');
            
            // Random position within container
            drop.style.left = `${Math.random() * 20 - 10}px`;
            drop.style.top = `${Math.random() * 10}px`;
            drop.style.opacity = Math.random() * 0.5 + 0.5;
            
            // Larger drops for stronger attacks
            const scale = isStrongAttack ? 
                Math.random() * 0.7 + 0.9 : 
                Math.random() * 0.5 + 0.7;
                
            drop.style.transform = `rotate(${Math.random() * 90 - 45}deg) scale(${scale})`;
            
            bloodDropsContainer.appendChild(drop);
        }
        
        document.body.appendChild(bloodDropsContainer);
        
        // Start dripping animation
        setTimeout(() => {
            bloodDropsContainer.classList.add('dripping-blood');
            
            // Show blood effect on card
            setTimeout(() => {
                losingCard.classList.add('dying-card');
                
                // Clean up
                setTimeout(() => {
                    bloodDropsContainer.remove();
                    resolve();
                }, 800);
            }, 200);
        }, 100);
    });
}

// Animate cards moving to winner player area
function animateCardsToWinner(winnerId, cardElements) {
    // Find winner player box
    const winnerBox = document.getElementById(`player-${winnerId}`);
    
    if (!winnerBox) {
        awardCardsToWinner(winnerId);
        return;
    }
    
    const winnerRect = winnerBox.getBoundingClientRect();
    const centerX = winnerRect.left + winnerRect.width / 2;
    const centerY = winnerRect.top + winnerRect.height / 2;
    
    // Create array of promises to track when all animations complete
    const animationPromises = [];
    
    // Animate each card
    cardElements.forEach((cardEl, index) => {
        const cardRect = cardEl.getBoundingClientRect();
        
        // Calculate movement coordinates
        const moveX = centerX - cardRect.left - cardRect.width / 2;
        const moveY = centerY - cardRect.top - cardRect.height / 2;
        
        // Generate random rotation for natural movement
        const rotateAmount = (Math.random() * 40 - 20) + 'deg';
        
        // Set CSS variables for the animation
        cardEl.style.setProperty('--moveX', `${moveX}px`);
        cardEl.style.setProperty('--moveY', `${moveY}px`);
        cardEl.style.setProperty('--rotateAmount', rotateAmount);
        
        // Create a promise for this card's animation
        const promise = new Promise(resolve => {
            // Delay start slightly for each card for cascading effect
            setTimeout(() => {
                cardEl.classList.add('moving-to-winner');
                
                // When animation ends, resolve promise
                cardEl.addEventListener('animationend', () => {
                    resolve();
                }, {once: true});
            }, index * 100); // Stagger cards slightly
        });
        
        animationPromises.push(promise);
    });
    
    // After all cards have moved, award cards in the database
    Promise.all(animationPromises).then(() => {
        awardCardsToWinner(winnerId);
    });
}

// Handle War Mechanics
function handleWarPlayCard() {
    console.log('handleWarPlayCard called');
    
    // NEW: Skip the disabled check in war mode - force it
    if (currentGame.gameState?.warState && playCardBtn.disabled) {
        console.log('Emergency override: Ignoring disabled button state for war');
        // Continue execution even if button appears disabled
    }
    // Otherwise use regular check
    else if (!currentGame.gameState?.warState && (playCardBtn.disabled || currentGame.isPlayingCard)) {
        return;
    }
    
    // Set the playing state to true
    currentGame.isPlayingCard = true;
    disablePlayButton();

    if (!currentGame.myCards || currentGame.myCards.length === 0) {
        alert('You have no cards left');
        currentGame.isPlayingCard = false;
        enablePlayButton();
        return;
    }
    
    // Check if we've already played a war card
    if (currentGame.gameState.warCards && 
        currentGame.gameState.warCards[currentGame.playerId]) {
        console.log('Already played a war card');
        currentGame.isPlayingCard = false;
        return;
    }
    
    // Get the top card
    const topCard = currentGame.myCards[0];
    
    // Create a copy of the card
    const cardCopy = { ...topCard };
    
    // Debug mode: Force card to be a 10 of hearts for war testing
    if (currentGame.forceWarCards) {
        console.log('Debug mode: Forcing war card to 10♥');
        cardCopy.value = '10';
        cardCopy.suit = '♥';
        // Turn off debug mode after using it once in war
        currentGame.forceWarCards = false;
    }
    
    // Update local state first (optimistic update)
    const updatedCards = [...currentGame.myCards];
    updatedCards.shift();
    currentGame.myCards = updatedCards;
    
    console.log('Submitting war card to database', cardCopy);
    
    // Add to war cards in database
    const warCardRef = database.ref(`games/${currentGame.gameCode}/warCards/${currentGame.playerId}`);
    warCardRef.set(cardCopy)
        .then(() => {
            // Then update my cards in database
            console.log('Successfully set war card, updating player cards');
            return updatePlayerState(currentGame.gameCode, currentGame.playerId, {
                cards: updatedCards
            });
        })
        .catch(error => {
            // Revert local state if there was an error
            console.error('Error playing war card:', error);
            currentGame.myCards.unshift(cardCopy);
            enablePlayButton();
        })
        .finally(() => {
            // Reset playing state
            currentGame.isPlayingCard = false;
            // Keep button disabled as we've already played our war card
            disablePlayButton();
        });
}

// Resolve War Winner
function resolveWarWinner() {
    console.log('Resolving war winner...');
    
    if (!currentGame.gameState || !currentGame.gameState.warCards) {
        console.log('Cannot resolve war - no war cards in game state', currentGame.gameState);
        return;
    }
    
    // Get all war cards
    const warCards = currentGame.gameState.warCards;
    console.log('War cards:', warCards);
    
    // Map cards to their values
    const cardValues = {};
    Object.keys(warCards).forEach(playerId => {
        const card = warCards[playerId];
        const value = CARD_VALUES.indexOf(card.value);
        cardValues[playerId] = value;
    });
    console.log('Card values:', cardValues);
    
    // Find highest value
    const highestValue = Math.max(...Object.values(cardValues));
    
    // Find players with highest value
    const winningPlayers = Object.keys(cardValues).filter(
        playerId => cardValues[playerId] === highestValue
    );
    console.log('Players with highest cards:', winningPlayers);
    
    // If still tied, another war
    if (winningPlayers.length > 1) {
        console.log('Still tied - another war needed');
        
        // Check if players have enough cards for another war
        const haveEnoughCards = winningPlayers.every(playerId => {
            const player = currentGame.players[playerId];
            return player.cards && player.cards.length > 0;
        });
        
        if (!haveEnoughCards) {
            console.log('Some players don\'t have enough cards - selecting random winner');
            // If any player doesn't have enough cards, select random winner
            const randomWinner = winningPlayers[Math.floor(Math.random() * winningPlayers.length)];
            awardWarCardsToWinner(randomWinner);
        } else {
            console.log('All players have enough cards - continuing war');
            // Update war players and reset for another round of war
            updateGameState(currentGame.gameCode, {
                warPlayers: winningPlayers,
                warStage: 'war_declare',
                warCards: {},
                message: 'Another War!'
            });
            
            // Wait for animation and start another round
            setTimeout(() => {
                updateGameState(currentGame.gameCode, {
                    warStage: 'war_cards'
                })
                .catch(error => {
                    console.error('Error updating war stage:', error);
                });
            }, 3000);
        }
    } else {
        console.log('War has a clear winner:', winningPlayers[0]);
        // One clear winner from the war
        const winnerId = winningPlayers[0];
        
        // Get cards in the battle area
        const cardElements = battleArea.querySelectorAll('.war-card');
        if (cardElements.length >= 2) {
            animateBattleAndCollectCards(winnerId, cardElements, cardValues);
            
            // After animation is complete, this will call awardWarCardsToWinner
            setTimeout(() => {
                awardWarCardsToWinner(winnerId);
            }, 2500);
        } else {
            // If animation can't work, just award cards
            awardWarCardsToWinner(winnerId);
        }
    }
}

// Show War Animation
function showWarAnimation() {
    warAnimation.classList.remove('hidden');
    
    // Create blood splatter effect
    for (let i = 0; i < 15; i++) {
        createBloodDrop();
    }
    
    // Show war instructions
    const warInstructions = document.getElementById('war-instructions');
    if (warInstructions) {
        warInstructions.classList.remove('hidden');
    }
    
    // NEW: More aggressive button enabling - force DOM state directly
    setTimeout(() => {
        if (currentGame.gameState?.warState && 
            currentGame.gameState?.warStage === 'war_cards' &&
            currentGame.gameState?.warPlayers?.includes(currentGame.playerId) &&
            (!currentGame.gameState?.warCards || !currentGame.gameState?.warCards[currentGame.playerId])) {
            
            console.log('CRITICAL FIX: Direct DOM manipulation to enable play button');
            document.getElementById('play-card').disabled = false;
            document.getElementById('play-card').classList.remove('disabled-button');
            currentGame.isPlayingCard = false;
        }
    }, 3500); // Wait a bit longer than the animation
    
    // Automatically hide war animation after 3 seconds in case it gets stuck
    setTimeout(() => {
        if (!currentGame.gameState?.warState) {
            hideWarAnimation();
        }
        
        // Force enable play button if we're in war cards stage and eligible to play
        if (currentGame.gameState?.warState && 
            currentGame.gameState?.warStage === 'war_cards' &&
            currentGame.gameState?.warPlayers && 
            currentGame.gameState?.warPlayers.includes(currentGame.playerId) &&
            (!currentGame.gameState?.warCards || !currentGame.gameState?.warCards[currentGame.playerId]) &&
            currentGame.myCards && 
            currentGame.myCards.length > 0) {
            
            console.log('Emergency fix: Enabling play button during war');
            enablePlayButton();
            
            // NEW: Direct DOM manipulation as a failsafe
            document.getElementById('play-card').disabled = false;
            document.getElementById('play-card').classList.remove('disabled-button');
        }
    }, 3000);
}

// Hide War Animation
function hideWarAnimation() {
    warAnimation.classList.add('hidden');
    
    // Hide war instructions
    const warInstructions = document.getElementById('war-instructions');
    if (warInstructions) {
        warInstructions.classList.add('hidden');
    }
    
    // Remove blood drops
    document.querySelectorAll('.blood').forEach(drop => {
        drop.remove();
    });
}

// Create Blood Drop for Animation
function createBloodDrop() {
    const drop = document.createElement('div');
    drop.classList.add('blood');
    
    // Random position around center
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 150 + 50;
    
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    
    drop.style.left = x + 'px';
    drop.style.top = y + 'px';
    
    // Random size
    const size = Math.random() * 30 + 10;
    drop.style.width = size + 'px';
    drop.style.height = size + 'px';
    
    document.body.appendChild(drop);
    
    // Remove after animation
    setTimeout(() => {
        drop.remove();
    }, 1000);
}

// Reset game state
function resetGameState() {
    currentGame = {
        gameCode: null,
        playerId: currentGame.playerId, // Keep player ID
        isHost: false,
        playerName: null,
        players: {},
        gameState: null,
        deck: [],
        myCards: [],
        isPlayingCard: false,  // Track if a card play is in progress
        appCheckVerified: false, // Track if App Check verification passed
        isResolvingRound: false, // Flag to prevent multiple winner checks
        debugMode: false,  // Reset debug mode
        forceWarCards: false  // Reset force war flag
    };
    
    // Reset UI elements
    gameCodeInput.value = '';
    playerNameInput.value = '';
    playerNameInput.disabled = false;
    setNameBtn.disabled = false;
    startGameBtn.disabled = true;
    enablePlayButton();
    battleArea.innerHTML = '';
}

// Screen navigation functions
function showScreen(screenToShow) {
    // Hide all screens first
    [welcomeScreen, lobbyScreen, gameScreen].forEach(screen => {
        screen.classList.add('hidden');
    });
    
    // Show the target screen after a short delay for fade-out
    setTimeout(() => {
        screenToShow.classList.remove('hidden');
    }, 50); // Delay slightly less than transition duration
}

function showWelcomeScreen() {
    showScreen(welcomeScreen);
}

function showLobbyScreen() {
    showScreen(lobbyScreen);
}

function showGameScreen() {
    showScreen(gameScreen);
}

// Award War Cards to Winner
function awardWarCardsToWinner(winnerId) {
    console.log('Awarding war cards to winner:', winnerId);
    if (!currentGame.gameState) {
        console.log('No game state - cannot award war cards');
        return;
    }
    
    // Ensure war animation is hidden
    hideWarAnimation();
    
    // Combine all cards: initial battle cards + war cards
    const allCards = [
        ...(currentGame.gameState.warPot || []),
        ...Object.values(currentGame.gameState.warCards || {})
    ];
    console.log('Total cards to award:', allCards.length);
    
    // Get winner's current cards
    const winner = currentGame.players[winnerId];
    if (!winner) {
        console.log('Winner not found in players list:', winnerId);
        return;
    }
    
    let winnerCards = winner.cards || [];
    
    // Ensure it's an array
    if (!Array.isArray(winnerCards)) {
        winnerCards = [];
    }
    
    // Add all war cards to winner's pile
    winnerCards = [...winnerCards, ...allCards];
    
    // Update winner's cards in database
    updatePlayerState(currentGame.gameCode, winnerId, {
        cards: winnerCards
    });
    
    // Update my cards if I'm the winner
    if (winnerId === currentGame.playerId) {
        currentGame.myCards = winnerCards;
    }
    
    // Clear war state and update round
    updateGameState(currentGame.gameCode, {
        warPot: null,
        warCards: null,
        warState: false,
        warPlayers: null,
        warStage: null,
        battleCards: null, // Clear battle cards only after war is resolved
        currentRound: (currentGame.gameState.currentRound || 0) + 1
    });
    
    // Check for game end
    checkGameEnd();
    
    // Make sure the play button is enabled for the next round if player has cards
    setTimeout(() => {
        if (currentGame.myCards && currentGame.myCards.length > 0) {
            enablePlayButton();
        }
    }, 1000);
}

// Award Cards to Winner
function awardCardsToWinner(winnerId) {
    if (!currentGame.gameState || !currentGame.gameState.battleCards) return;
    
    // Ensure war animation is hidden
    hideWarAnimation();
    
    // Get all battle cards as an array
    const cardsWon = Object.values(currentGame.gameState.battleCards);
    
    // Get winner's current cards
    const winner = currentGame.players[winnerId];
    let winnerCards = winner.cards || [];
    
    // Ensure it's an array
    if (!Array.isArray(winnerCards)) {
        winnerCards = [];
    }
    
    // Add won cards to winner's pile
    winnerCards = [...winnerCards, ...cardsWon];
    
    // Update winner's cards in database
    updatePlayerState(currentGame.gameCode, winnerId, {
        cards: winnerCards
    });
    
    // Update my cards if I'm the winner
    if (winnerId === currentGame.playerId) {
        currentGame.myCards = winnerCards;
    }
    
    // Clear battle cards and update round
    updateGameState(currentGame.gameCode, {
        battleCards: null,
        warState: false,
        currentRound: (currentGame.gameState.currentRound || 0) + 1
    });
    
    // Check for game end
    checkGameEnd();
}

// Create a deck of cards
function createDeck() {
    const deck = [];
    
    for (const suit of CARD_SUITS) {
        for (const value of CARD_VALUES) {
            deck.push({
                suit,
                value
            });
        }
    }
    
    return deck;
}

// Shuffle the deck
function shuffleDeck(deck) {
    const shuffled = [...deck];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
}

// Deal cards to players
function dealCards(deck, playerIds) {
    const dealtCards = {};
    
    // Initialize empty arrays for each player
    playerIds.forEach(playerId => {
        dealtCards[playerId] = [];
    });
    
    // Deal cards one at a time to each player
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
    if (!currentGame.players) return;
    
    // Count players with cards
    let playersWithCards = 0;
    let lastPlayerWithCards = null;
    
    Object.keys(currentGame.players).forEach(playerId => {
        const player = currentGame.players[playerId];
        if (player.cards && player.cards.length > 0) {
            playersWithCards++;
            lastPlayerWithCards = playerId;
        }
    });
    
    // If only one player has cards, they win
    if (playersWithCards === 1) {
        const winnerName = currentGame.players[lastPlayerWithCards].name;
        alert(`Game Over! ${winnerName} wins!`);
        
        // End the game
        updateGameState(currentGame.gameCode, {
            status: 'ended',
            winner: lastPlayerWithCards
        });
    }
}

// Add this CSS directly in a <style> tag to the head of the document
document.head.insertAdjacentHTML('beforeend', `
<style>
.cards-section-label {
    font-size: 0.8rem;
    color: #ccc;
    margin: 5px 0;
    text-align: center;
}

.cards-container {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-bottom: 15px;
}

.initial-battle-cards {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px dashed #444;
}

.war-cards-section {
    margin-top: 20px;
}

.initial-war-card {
    position: relative;
}

.initial-war-card::after {
    content: '↓';
    position: absolute;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    color: #ff6b6b;
    font-size: 20px;
    text-shadow: 0 0 5px rgba(255, 0, 0, 0.7);
}

.war-card {
    box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
    animation: pulse-war 2s infinite;
}

@keyframes pulse-war {
    0% { box-shadow: 0 0 10px rgba(255, 0, 0, 0.5); }
    50% { box-shadow: 0 0 15px rgba(255, 0, 0, 0.8); }
    100% { box-shadow: 0 0 10px rgba(255, 0, 0, 0.5); }
}

#war-animation {
    z-index: 10;
}
</style>
`); 