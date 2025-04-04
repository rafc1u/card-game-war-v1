// game.js

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
  playerId: 'player_' + Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
  isHost: false,
  playerName: null,
  players: {},
  gameState: null,
  deck: [],
  myCards: [],
  isPlayingCard: false,
  appCheckVerified: false,
  isResolvingRound: false,
  debugMode: false,
  forceWarCards: false
};

// Card constants
const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const CARD_SUITS = ['♠', '♥', '♦', '♣'];
const CARD_COLORS = {
  '♠': 'black',
  '♥': 'red',
  '♦': 'red',
  '♣': 'black'
};

// -------------------- Event Listeners --------------------

createGameBtn.addEventListener('click', handleCreateGame);
joinGameBtn.addEventListener('click', handleJoinGame);
setNameBtn.addEventListener('click', handleSetName);
startGameBtn.addEventListener('click', handleStartGame);
playCardBtn.addEventListener('click', handlePlayCard);
exitGameBtn.addEventListener('click', handleExitGame);
copyUrlBtn.addEventListener('click', handleCopyUrl);

document.addEventListener('keydown', function(event) {
  if (event.key.toLowerCase() === 'w') {
    currentGame.forceWarCards = true;
    console.log('WAR MODE ACTIVATED: Next cards will be identical!');
    alert('WAR MODE ACTIVATED: Next cards will be identical!');
  }
  // Space or Enter to play war card
  if (event.key === ' ' || event.key === 'Enter') {
    if (
      currentGame.gameState?.warState &&
      currentGame.gameState?.warStage &&
      (currentGame.gameState.warStage === 'war_cards1' || currentGame.gameState.warStage === 'war_cards2') &&
      currentGame.gameState.warPlayers?.includes(currentGame.playerId) &&
      (!currentGame.gameState.warCards || !currentGame.gameState.warCards[currentGame.playerId])
    ) {
      console.log('Emergency: Playing war card via keyboard shortcut');
      handleWarPlayCard();
    }
  }
  // F key to force enable play button
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

// -------------------- App Check & Initialization --------------------

function setupAppCheck() {
  if (typeof firebase !== 'undefined' && firebase.app && firebase.appCheck) {
    try {
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
      currentGame.appCheckVerified = true;
    }
  } else {
    console.warn('Firebase App Check not available, proceeding without verification');
    currentGame.appCheckVerified = true;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    setupAppCheck();
    setTimeout(() => {
      checkUrlForGameCode();
    }, 200);
  }, 1000);
});

// -------------------- Core Game Functions --------------------

// Create Game Handler
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
    await checkAppCheckBeforeOperation(() => joinGame(gameCode), () => Promise.reject(new Error('App Check verification required')));
    currentGame.gameCode = gameCode;
    showLobbyScreen();
    gameCodeDisplay.textContent = gameCode;
    listenForGameChanges(gameCode, handleGameStateChange);
    listenForPlayerChanges(gameCode, updatePlayersList);
  } catch (error) {
    alert('Error joining game: ' + error.message);
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
    await checkAppCheckBeforeOperation(() => setPlayerName(currentGame.gameCode, currentGame.playerId, name), () => Promise.reject(new Error('App Check verification required')));
    currentGame.playerName = name;
    setNameBtn.disabled = true;
    playerNameInput.disabled = true;
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
      const deck = createDeck();
      const shuffledDeck = shuffleDeck(deck);
      const dealtCards = dealCards(shuffledDeck, Object.keys(currentGame.players));
      const updates = {};
      Object.keys(dealtCards).forEach(playerId => {
        updates[`games/${currentGame.gameCode}/players/${playerId}/cards`] = dealtCards[playerId];
      });
      await firebase.database().ref().update(updates);
      await startGame(currentGame.gameCode);
    }, () => Promise.reject(new Error('App Check verification required')));
  } catch (error) {
    alert('Error starting game: ' + error.message);
  }
}

// Play Card Handler (regular play)
function handlePlayCard() {
  if (playCardBtn.disabled || currentGame.isPlayingCard) return;
  currentGame.isPlayingCard = true;
  disablePlayButton();
  if (
    currentGame.gameState &&
    currentGame.gameState.warState &&
    currentGame.gameState.warStage &&
    (currentGame.gameState.warStage === 'war_cards1' || currentGame.gameState.warStage === 'war_cards2') &&
    currentGame.gameState.warPlayers &&
    currentGame.gameState.warPlayers.includes(currentGame.playerId)
  ) {
    handleWarPlayCard();
    return;
  }
  if (!currentGame.myCards || currentGame.myCards.length === 0) {
    alert('You have no cards left');
    enablePlayButton();
    return;
  }
  if (currentGame.gameState.battleCards && currentGame.gameState.battleCards[currentGame.playerId]) {
    console.log('Already played a card this round');
    currentGame.isPlayingCard = false;
    return;
  }
  const topCard = currentGame.myCards[0];
  const cardCopy = { ...topCard };
  if (currentGame.forceWarCards) {
    cardCopy.value = '10';
    cardCopy.suit = '♥';
  }
  const updatedCards = [...currentGame.myCards];
  updatedCards.shift();
  currentGame.myCards = updatedCards;
  const battleCardRef = database.ref(`games/${currentGame.gameCode}/battleCards/${currentGame.playerId}`);
  battleCardRef.set(cardCopy)
    .then(() => updatePlayerState(currentGame.gameCode, currentGame.playerId, { cards: updatedCards }))
    .catch(error => {
      console.error('Error playing card:', error);
      currentGame.myCards.unshift(cardCopy);
      enablePlayButton();
    })
    .finally(() => {
      currentGame.isPlayingCard = false;
    });
}

// War Card Handler (modified for two-card war)
function handleWarPlayCard() {
  console.log('handleWarPlayCard called');
  if (!currentGame.gameState?.warState) return;
  currentGame.isPlayingCard = true;
  disablePlayButton();
  if (!currentGame.myCards || currentGame.myCards.length === 0) {
    alert('You have no cards left');
    currentGame.isPlayingCard = false;
    enablePlayButton();
    return;
  }
  // Check if player already has war cards; if so, prevent extra plays
  if (currentGame.gameState.warCards && currentGame.gameState.warCards[currentGame.playerId]) {
    const existingCards = currentGame.gameState.warCards[currentGame.playerId];
    if (Array.isArray(existingCards) && existingCards.length >= 2) {
      console.log('Already played two war cards');
      currentGame.isPlayingCard = false;
      return;
    }
  }
  const topCard = currentGame.myCards[0];
  const cardCopy = { ...topCard };
  if (currentGame.forceWarCards) {
    cardCopy.value = '10';
    cardCopy.suit = '♥';
    currentGame.forceWarCards = false;
  }
  const updatedCards = [...currentGame.myCards];
  updatedCards.shift();
  currentGame.myCards = updatedCards;
  const warCardRef = database.ref(`games/${currentGame.gameCode}/warCards/${currentGame.playerId}`);
  warCardRef.once('value').then(snapshot => {
    let newWarCards = [];
    const existing = snapshot.val();
    if (existing) {
      newWarCards = Array.isArray(existing) ? existing : [existing];
    }
    if (currentGame.gameState.warStage === 'war_cards1' && newWarCards.length === 0) {
      // Save first war card (face down)
      newWarCards.push(cardCopy);
    } else if (currentGame.gameState.warStage === 'war_cards2' && newWarCards.length === 1) {
      // Save second war card (face up)
      newWarCards.push(cardCopy);
    } else {
      console.log('Invalid war card play state.');
      currentGame.isPlayingCard = false;
      return;
    }
    warCardRef.set(newWarCards)
      .then(() => updatePlayerState(currentGame.gameCode, currentGame.playerId, { cards: updatedCards }))
      .catch(error => {
        console.error('Error playing war card:', error);
        currentGame.myCards.unshift(cardCopy);
        enablePlayButton();
      })
      .finally(() => {
        currentGame.isPlayingCard = false;
        disablePlayButton();
        checkWarStageProgression();
      });
  });
}

// Helper to advance war stage automatically
function checkWarStageProgression() {
  if (!currentGame.gameState?.warState || !currentGame.gameState.warPlayers) return;
  const warPlayers = currentGame.gameState.warPlayers;
  const warCards = currentGame.gameState.warCards || {};
  // If in war_cards1 and all war players have played one card, move to war_cards2
  if (currentGame.gameState.warStage === 'war_cards1') {
    const allPlayedOne = warPlayers.every(pid => {
      const cards = warCards[pid];
      return Array.isArray(cards) && cards.length >= 1;
    });
    if (allPlayedOne) {
      updateGameState(currentGame.gameCode, {
        warStage: 'war_cards2',
        message: 'Play your second war card (face up)!'
      });
    }
  }
  // If in war_cards2 and all war players have played two cards, resolve the war
  if (currentGame.gameState.warStage === 'war_cards2') {
    const allPlayedTwo = warPlayers.every(pid => {
      const cards = warCards[pid];
      return Array.isArray(cards) && cards.length === 2;
    });
    if (allPlayedTwo) {
      setTimeout(() => {
        resolveWarWinner();
      }, 1000);
    }
  }
}

// Modified function to resolve the war using the second (face up) war cards
function resolveWarWinner() {
  console.log('Resolving war winner...');
  if (!currentGame.gameState || !currentGame.gameState.warCards) {
    console.log('No war cards to resolve.');
    return;
  }
  const warCards = currentGame.gameState.warCards;
  const cardValues = {};
  Object.keys(warCards).forEach(playerId => {
    const warArray = warCards[playerId];
    if (Array.isArray(warArray) && warArray.length === 2) {
      // Use the second card (face up) for comparison
      const card = warArray[1];
      cardValues[playerId] = CARD_VALUES.indexOf(card.value);
    } else {
      console.log(`Player ${playerId} has incomplete war cards.`);
    }
  });
  const highestValue = Math.max(...Object.values(cardValues));
  const winningPlayers = Object.keys(cardValues).filter(playerId => cardValues[playerId] === highestValue);
  if (winningPlayers.length > 1) {
    console.log('Tie in war cards, initiating another war...');
    updateGameState(currentGame.gameCode, {
      warPlayers: winningPlayers,
      warStage: 'war_cards1',
      warCards: {},
      message: 'Another War! Play your first war card (face down)!'
    });
    setTimeout(() => {
      updateGameState(currentGame.gameCode, { warStage: 'war_cards1' });
    }, 3000);
  } else {
    const winnerId = winningPlayers[0];
    // Animate and award all cards (initial battle cards plus both war card sets)
    const cardElements = battleArea.querySelectorAll('.war-card');
    if (cardElements.length >= 2) {
      animateBattleAndCollectCards(winnerId, cardElements, cardValues);
      setTimeout(() => {
        awardWarCardsToWinner(winnerId);
      }, 2500);
    } else {
      awardWarCardsToWinner(winnerId);
    }
  }
}

// Update the game board UI (includes war cards display)
function updateGameBoard() {
  // Update round count
  if (currentGame.gameState) {
    roundCount.textContent = currentGame.gameState.currentRound || 0;
  }
  // Update each player's card count
  Object.keys(currentGame.players).forEach(playerId => {
    const player = currentGame.players[playerId];
    const playerBox = document.getElementById(`player-${playerId}`);
    if (playerBox) {
      const playerCards = playerBox.querySelector('.player-cards');
      const cardCount = player.cards ? (Array.isArray(player.cards) ? player.cards.length : 0) : 0;
      playerCards.textContent = `Cards: ${cardCount}`;
      if (cardCount === 0) {
        playerBox.classList.add('disabled');
      } else {
        playerBox.classList.remove('disabled');
      }
    }
  });
  
  // Render battle cards (initial played cards)
  battleArea.innerHTML = '';
  if (currentGame.gameState.battleCards) {
    const initialCardsSection = document.createElement('div');
    initialCardsSection.classList.add('initial-battle-cards');
    const initialLabel = document.createElement('div');
    initialLabel.classList.add('cards-section-label');
    initialLabel.textContent = 'Initial Tied Cards:';
    initialCardsSection.appendChild(initialLabel);
    const initialCards = document.createElement('div');
    initialCards.classList.add('cards-container');
    Object.keys(currentGame.gameState.battleCards).forEach(playerId => {
      const card = currentGame.gameState.battleCards[playerId];
      const player = currentGame.players[playerId];
      if (card && player) {
        const cardElement = document.createElement('div');
        cardElement.classList.add('player-card');
        if (CARD_COLORS[card.suit] === 'red') cardElement.classList.add('red');
        cardElement.textContent = `${card.value}${card.suit}`;
        cardElement.dataset.playerId = playerId;
        cardElement.dataset.cardValue = CARD_VALUES.indexOf(card.value);
        initialCards.appendChild(cardElement);
      }
    });
    initialCardsSection.appendChild(initialCards);
    battleArea.appendChild(initialCardsSection);
  }
  // Render war cards if in war state
  if (currentGame.gameState.warState && currentGame.gameState.warCards) {
    const warCardsSection = document.createElement('div');
    warCardsSection.classList.add('war-cards-section');
    const warLabel = document.createElement('div');
    warLabel.classList.add('cards-section-label');
    warLabel.textContent = 'War Cards:';
    warCardsSection.appendChild(warLabel);
    const warCardsContainer = document.createElement('div');
    warCardsContainer.classList.add('cards-container');
    Object.keys(currentGame.gameState.warCards).forEach(playerId => {
      const warArray = currentGame.gameState.warCards[playerId];
      const player = currentGame.players[playerId];
      const cardElement = document.createElement('div');
      cardElement.classList.add('player-card');
      if (currentGame.gameState.warStage === 'war_cards1') {
        // Show face-down card (card back)
        cardElement.classList.add('card-back');
        cardElement.textContent = '??';
      } else if (currentGame.gameState.warStage === 'war_cards2' && Array.isArray(warArray) && warArray.length === 2) {
        // Show second war card (face up)
        const card = warArray[1];
        if (CARD_COLORS[card.suit] === 'red') cardElement.classList.add('red');
        cardElement.textContent = `${card.value}${card.suit}`;
      }
      warCardsContainer.appendChild(cardElement);
    });
    warCardsSection.appendChild(warCardsContainer);
    battleArea.appendChild(warCardsSection);
  }
  
  // Enable/disable the play card button based on state
  if (currentGame.myCards && currentGame.myCards.length > 0) {
    if (currentGame.gameState.warState) {
      const isWarPlayer = currentGame.gameState.warPlayers && currentGame.gameState.warPlayers.includes(currentGame.playerId);
      const isWarStage = currentGame.gameState.warStage === 'war_cards1' || currentGame.gameState.warStage === 'war_cards2';
      const hasNotPlayedWarCard = !currentGame.gameState.warCards || !currentGame.gameState.warCards[currentGame.playerId] ||
        (Array.isArray(currentGame.gameState.warCards[currentGame.playerId]) &&
         ((currentGame.gameState.warStage === 'war_cards1' && currentGame.gameState.warCards[currentGame.playerId].length === 0) ||
          (currentGame.gameState.warStage === 'war_cards2' && currentGame.gameState.warCards[currentGame.playerId].length === 1)));
      if (isWarPlayer && isWarStage && hasNotPlayedWarCard) {
        enablePlayButton();
      } else {
        disablePlayButton();
      }
    } else {
      if (!currentGame.gameState.battleCards || !currentGame.gameState.battleCards[currentGame.playerId]) {
        enablePlayButton();
      } else {
        disablePlayButton();
      }
    }
  } else {
    disablePlayButton();
  }
  
  // Emergency fix: ensure play button is enabled if eligible in war state
  if (
    currentGame.gameState?.warState &&
    currentGame.gameState?.warStage &&
    currentGame.gameState.warPlayers?.includes(currentGame.playerId) &&
    currentGame.myCards && currentGame.myCards.length > 0 &&
    playCardBtn.disabled
  ) {
    enablePlayButton();
  }
}

// -------------------- Other Helper Functions --------------------

// These include: createDeck, shuffleDeck, dealCards, createGame, joinGame, setPlayerName,
// listenForGameChanges, listenForPlayerChanges, startGame, updateGameState, updatePlayerState,
// removeListeners, animateAttack, animateBattleAndCollectCards, animateCardsToWinner,
// awardCardsToWinner, awardWarCardsToWinner, showWarAnimation, hideWarAnimation, createBloodDrop,
// resetGameState, showScreen, showWelcomeScreen, showLobbyScreen, showGameScreen, copyToClipboard,
// showCopyConfirmation, checkUrlForGameCode, showAppCheckError, and checkAppCheckBeforeOperation.
// (Keep these functions as in your original file.)

// For example:
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

// Screen navigation functions
function showScreen(screenToShow) {
  [welcomeScreen, lobbyScreen, gameScreen].forEach(screen => screen.classList.add('hidden'));
  setTimeout(() => {
    screenToShow.classList.remove('hidden');
  }, 50);
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

// -------------------- End of game.js --------------------
