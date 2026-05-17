/**
 * GameManager.js
 * Manages mini-games. Handles token cost, launch, and result application.
 */

export const GAMES = {
  throwBall: {
    id: 'throwBall',
    name: 'Throw the Ball',
    emoji: '🎾',
    cost: 5,
    description: 'Toss a ball for your pet to chase!',
    stageRequired: 1,
    statEffects: {
      boredom: -25,
      happiness: +15,
    },
    evolutionBonus: 3,
  },
  twentyQuestions: {
    id: 'twentyQuestions',
    name: '20 Questions',
    emoji: '🤔',
    cost: 15,
    description: 'Your pet thinks of something. Can you guess it in 20 questions?',
    stageRequired: 2, // needs personality to be set
    winEffects: {
      happiness: +30,
      intelligenceBonus: 5,
      tokenRefund: 10,
    },
    loseEffects: {
      happiness: +10, // still fun even if you lose
    },
    evolutionBonus: 8,
  },
};

export class GameManager {
  constructor({ engine, evo, memory, onGameStart, onGameEnd }) {
    this.engine      = engine;
    this.evo         = evo;
    this.memory      = memory;
    this.onGameStart = onGameStart;
    this.onGameEnd   = onGameEnd;
    this.activeGame  = null;
  }

  canAfford(gameId) {
    const game = GAMES[gameId];
    if (!game) return false;
    return this.engine.tokens >= game.cost;
  }

  canPlay(gameId, currentStage) {
    const game = GAMES[gameId];
    if (!game) return false;
    return currentStage >= game.stageRequired && this.canAfford(gameId);
  }

  startGame(gameId) {
    const game = GAMES[gameId];
    if (!game || !this.canAfford(gameId)) return false;

    // Deduct tokens
    this.engine.tokens -= game.cost;
    this.activeGame = gameId;
    this.evo?.recordToyUse();

    // Apply base stat effects
    if (game.statEffects) {
      this.engine.applyStatDelta(game.statEffects);
    }

    this.onGameStart?.(gameId);
    this.memory?.logEvent(`Played ${game.name}`);
    return true;
  }

  endGame(gameId, { won } = {}) {
    const game = GAMES[gameId];
    if (!game) return;

    // Apply result effects
    const effects = won ? game.winEffects : game.loseEffects;
    if (effects) {
      if (effects.happiness)       this.engine.applyStatDelta({ happiness: effects.happiness });
      if (effects.tokenRefund)     this.engine.tokens += effects.tokenRefund;
      if (effects.intelligenceBonus) {
        // Handled by IntelligenceEngine externally
      }
    }

    // Evolution bonus
    if (game.evolutionBonus && this.evo) {
      this.evo.evolutionScore += game.evolutionBonus;
    }

    this.activeGame = null;
    this.onGameEnd?.(gameId, { won });
  }
}
