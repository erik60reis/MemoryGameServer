const { Room } = require("colyseus");
const { Schema, MapSchema, ArraySchema, defineTypes } = require("@colyseus/schema");
const { registerRoom, releaseRoom } = require("../roomCodes");

const cardSymbols = [
  "A", "B", "B", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "y", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x"
];

function duplicateAndShuffle(array) {
  const duplicated = [];
  for (const item of array) {
    duplicated.push(item, item);
  }

  for (let i = duplicated.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [duplicated[i], duplicated[j]] = [duplicated[j], duplicated[i]];
  }

  return duplicated;
}

class Player extends Schema {
  constructor() {
    super();
    this.nickname = "";
    this.score = 0;
  }
}

defineTypes(Player, {
  nickname: "string",
  score: "number"
});

class MemoryGameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.board = new ArraySchema();
    this.removedCards = new ArraySchema();
    this.turnOrder = new ArraySchema();
    this.turnIndex = 0;
    this.choosedCardIndex = -1;
    this.isInCardAnimation = false;
  }
}

defineTypes(MemoryGameState, {
  players: { map: Player },
  board: ["string"],
  removedCards: ["number"],
  turnOrder: ["string"],
  turnIndex: "number",
  choosedCardIndex: "number",
  isInCardAnimation: "boolean"
});

class MemoryRoom extends Room {
  constructor() {
    super();
    this.removedCardSet = new Set();
    this.roomCode = null;
  }

  onCreate(options) {
    this.setState(new MemoryGameState());
    this.maxClients = 10;
    this.resetBoard();

    this.roomCode = registerRoom(this.roomId);
    this.setMetadata({ roomCode: this.roomCode });

    this.onMessage("setNickname", (client, nickname) => this.handleNickname(client, nickname));
    this.onMessage("chooseCard", (client, payload) => this.handleChooseCard(client, payload));
  }

  async onDispose() {
    releaseRoom(this.roomId);
  }

  onJoin(client, options) {
    const player = new Player();
    if (options && options.nickname) {
      player.nickname = this.sanitizeNickname(options.nickname);
    }

    this.state.players.set(client.sessionId, player);
    this.state.turnOrder.push(client.sessionId);

    if (this.state.turnOrder.length === 1) {
      this.state.turnIndex = 0;
    }

    client.send("updateSymbolList", cardSymbols);
    client.send("updateRemovedCardList", Array.from(this.state.removedCards));
    client.send("updateTurnIndex", this.state.turnIndex.toString());
    if (this.roomCode) {
      client.send("roomCode", this.roomCode);
    }

    this.broadcastPlayerList();
  }

  onLeave(client, consented) {
    const index = this.state.turnOrder.indexOf(client.sessionId);
    if (index !== -1) {
      this.state.turnOrder.splice(index, 1);
      if (this.state.turnOrder.length === 0) {
        this.state.turnIndex = 0;
        this.clearSelection();
      } else if (index <= this.state.turnIndex) {
        this.state.turnIndex = (this.state.turnIndex - 1 + this.state.turnOrder.length) % this.state.turnOrder.length;
      }
    }

    this.state.players.delete(client.sessionId);
    this.broadcastTurnIndex();
    this.broadcastPlayerList();
  }

  handleNickname(client, nickname) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return;
    }

    player.nickname = this.sanitizeNickname(nickname);
    this.broadcastPlayerList();
  }

  handleChooseCard(client, payload) {
    const cardIndex = this.normalizeCardIndex(payload);
    if (!Number.isInteger(cardIndex)) {
      return;
    }

    if (!this.canSelectCard(client.sessionId, cardIndex)) {
      return;
    }

    if (this.state.choosedCardIndex === -1) {
      this.handleFirstSelection(cardIndex);
    } else if (cardIndex !== this.state.choosedCardIndex) {
      this.handleSecondSelection(client.sessionId, cardIndex);
    }
  }

  handleFirstSelection(cardIndex) {
    this.state.isInCardAnimation = true;
    this.state.choosedCardIndex = cardIndex;

    this.broadcast("flipCardUp", JSON.stringify({ cardIndex, symbol: this.state.board[cardIndex] }));

    this.clock.setTimeout(() => {
      this.state.isInCardAnimation = false;
    }, 1000);
  }

  handleSecondSelection(sessionId, cardIndex) {
    this.state.isInCardAnimation = true;
    this.broadcast("flipCardUp", JSON.stringify({ cardIndex, symbol: this.state.board[cardIndex] }));

    this.clock.setTimeout(() => {
      const previousIndex = this.state.choosedCardIndex;
      let switchTurn = true;

      if (this.state.board[cardIndex] === this.state.board[previousIndex]) {
        this.removeCardFromBoard(cardIndex);
        this.removeCardFromBoard(previousIndex);
        switchTurn = false;

        const player = this.state.players.get(sessionId);
        if (player) {
          player.score += 1;
        }

        this.broadcast("removeCard", cardIndex.toString());
        this.broadcast("removeCard", previousIndex.toString());
        this.broadcast("updateRemovedCardList", Array.from(this.state.removedCards));
      } else {
        this.broadcast("flipCardDown", cardIndex.toString());
        this.broadcast("flipCardDown", previousIndex.toString());
      }

      this.clock.setTimeout(() => {
        if (switchTurn) {
          this.advanceTurn();
        }
        this.state.isInCardAnimation = false;
        this.state.choosedCardIndex = -1;

        this.broadcastTurnIndex();
        this.broadcastPlayerList();
      }, 1000);
    }, 1000);
  }

  canSelectCard(sessionId, cardIndex) {
    if (!this.state.players.has(sessionId)) {
      return false;
    }

    if (cardIndex < 0 || cardIndex >= this.state.board.length) {
      return false;
    }

    if (this.removedCardSet.has(cardIndex)) {
      return false;
    }

    if (!this.isPlayersTurn(sessionId)) {
      return false;
    }

    return !this.state.isInCardAnimation;
  }

  isPlayersTurn(sessionId) {
    if (this.state.turnOrder.length === 0) {
      return false;
    }
    return this.state.turnOrder[this.state.turnIndex] === sessionId;
  }

  normalizeCardIndex(payload) {
    if (payload && typeof payload === "object" && payload.cardIndex !== undefined) {
      payload = payload.cardIndex;
    }

    const parsed = parseInt(payload, 10);
    return Number.isNaN(parsed) ? NaN : parsed;
  }

  removeCardFromBoard(index) {
    if (this.removedCardSet.has(index)) {
      return;
    }

    this.removedCardSet.add(index);
    this.state.removedCards.push(index);
    this.state.board[index] = "";
  }

  advanceTurn() {
    if (this.state.turnOrder.length === 0) {
      this.state.turnIndex = 0;
      return;
    }

    this.state.turnIndex = (this.state.turnIndex + 1) % this.state.turnOrder.length;
  }

  resetBoard() {
    const board = duplicateAndShuffle(cardSymbols);
    this.state.board.splice(0, this.state.board.length);
    board.forEach((symbol, index) => {
      if (this.state.board[index] === undefined) {
        this.state.board.push(symbol);
      } else {
        this.state.board[index] = symbol;
      }
    });

    this.state.removedCards.splice(0, this.state.removedCards.length);
    this.removedCardSet.clear();
    this.state.choosedCardIndex = -1;
    this.state.isInCardAnimation = false;
  }

  clearSelection() {
    this.state.choosedCardIndex = -1;
    this.state.isInCardAnimation = false;
  }

  broadcastPlayerList() {
    const players = this.state.turnOrder
      .map((sessionId) => {
        const player = this.state.players.get(sessionId);
        if (!player) {
          return null;
        }
        return {
          score: player.score,
          nickname: player.nickname || ""
        };
      })
      .filter(Boolean);

    this.broadcast("updatePlayerList", JSON.stringify({ players }));
  }

  broadcastTurnIndex() {
    this.broadcast("updateTurnIndex", this.state.turnIndex.toString());
  }

  sanitizeNickname(nickname) {
    if (nickname === undefined || nickname === null) {
      return "";
    }
    return nickname.toString().trim().substring(0, 24);
  }
}

module.exports = MemoryRoom;
