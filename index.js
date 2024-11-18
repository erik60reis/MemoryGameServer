const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

let universalPlayerInfo = {};

const cardsymbols = ["A","B","B","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","a","b","c","d","e","f","g","h","i","j","k","y","m","n","o","p","q","r","s","t","u","v","w","x"];

let usedRoomIds = {};

// Serve a simple test endpoint
app.get('/', (req, res) => {
  res.send('Hello World');
});

app.get('/test', (req, res) => {
    res.send('Hello World');
});

// Function to remove usedRoomIds with no players
function removeUnusedusedRoomIds() {
  for (const roomId in usedRoomIds) {
    if (Object.keys(usedRoomIds[roomId].players).length === 0) {
      delete usedRoomIds[roomId];
      console.log(`Room ${roomId} removed`);
    }
  }
  //console.log(usedRoomIds);
}
function duplicateAndShuffle(array) {
    // Step 1: Duplicate each item
    let duplicatedArray = array.flatMap(item => [item, item]);

    // Step 2: Shuffle the duplicated array
    for (let i = duplicatedArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [duplicatedArray[i], duplicatedArray[j]] = [duplicatedArray[j], duplicatedArray[i]];
    }

    return duplicatedArray;
}

function generateBoard() {
  return duplicateAndShuffle(cardsymbols);
}

// Function to create a room with a unique ID
function createRoom() {
  const roomId = reserveRoomId();
  usedRoomIds[roomId] = { players: {}, turn: 0, choosedCardIndex: -1, board: generateBoard(), isInCardAnimation: false};  // Placeholder for room structure
  console.log(`Room ${roomId} created`);
  return roomId.toString();
}

// Function to reserve a unique room ID
function reserveRoomId() {
  let reservedRoomId = 1;
  while (usedRoomIds[reservedRoomId]) {
    reservedRoomId++;
  }
  return reservedRoomId;
}

function getRoomIdBySocketId(socketId) {
  for (let roomId in usedRoomIds) {
    if (usedRoomIds[roomId] && usedRoomIds[roomId].players) {
        if (usedRoomIds[roomId].players[socketId]) {
            return roomId;
        }
    }
  }
  return null;
}

function removeSocketKeys(obj) {
    for (let key in obj) {
        if (obj[key] && typeof obj[key] === 'object') {
            delete obj[key].socket; // Delete the 'socket' key if it exists in the nested object
        }
    }
    return obj;
}

function getNullIndexes(array) {
    return array.reduce((indexes, element, index) => {
        if (element === null) indexes.push(index);
        return indexes;
    }, []);
}

// Set interval to periodically check and remove unused usedRoomIds
setInterval(removeUnusedusedRoomIds, 5000);

// Listen for client connections
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    universalPlayerInfo[socket.id] = {nickname: "", socket: socket};

    socket.emit("welcome", "");
    
    socket.on('createRoom', () => {try{
        const roomId = createRoom();
        usedRoomIds[roomId].players[socket.id] = {score: 0, nickname: universalPlayerInfo[socket.id].nickname};
        console.log(usedRoomIds[roomId]);
        socket.emit('roomJoined', roomId.toString());
        setTimeout(() => {
            socket.emit('updatePlayerList', JSON.stringify({players: Object.values(removeSocketKeys(usedRoomIds[roomId].players))}));
        }, 3000);
    }catch(err){console.log(err);}});

    socket.on('setNickname', (nickname) => {try{
        universalPlayerInfo[socket.id].nickname = nickname;
    }catch(err){console.log(err);}});

    socket.on('joinRoom', (roomId) => {try{
        if (roomId === 'randomRoom') {
            let possibleRoomIds = [];
            for (const tempRoomId in usedRoomIds) {
                if (Object.keys(usedRoomIds[tempRoomId.toString()].players).length <= 3) {
                    possibleRoomIds.push(tempRoomId.toString());
                }
            }
            if (possibleRoomIds.length > 0) {
                roomId = possibleRoomIds[Math.floor(Math.random() * possibleRoomIds.length)];
            }
        }
        if (!usedRoomIds[roomId]) {
            socket.emit('roomNotFound', roomId.toString());
            return;
        }
        if (Object.keys(usedRoomIds[roomId].players).length >= 10)
        {
            socket.emit('roomFull', roomId.toString());
            return;
        }
        usedRoomIds[roomId].players[socket.id] = {score: 0, nickname: universalPlayerInfo[socket.id].nickname};
        socket.emit('roomJoined', roomId.toString());
        setTimeout(() => {
            for (const playerSocketId in usedRoomIds[roomId].players) {
                universalPlayerInfo[playerSocketId].socket.emit('updatePlayerList', JSON.stringify({players: Object.values(removeSocketKeys(usedRoomIds[roomId].players))}));
            }
            socket.emit('updateRemovedCardList', JSON.stringify(getNullIndexes(usedRoomIds[roomId].board)));
            socket.emit('updateTurnIndex', usedRoomIds[roomId].turn.toString());
            socket.emit('updateSymbolList', JSON.stringify(cardsymbols));
        }, 3000);
    }catch(err){console.log(err);}});

    socket.on('disconnect', () => {try{
            console.log(`Client disconnected: ${socket.id}`);
            delete universalPlayerInfo[socket.id];
            for (const roomId in usedRoomIds) {
                const index = Object.keys(usedRoomIds[roomId].players).indexOf(socket.id);
                if (index !== -1) {
                    delete usedRoomIds[roomId].players[socket.id];
                    for (const playerSocketId in usedRoomIds[roomId].players) {
                        universalPlayerInfo[playerSocketId].socket.emit('updatePlayerList', JSON.stringify({players: Object.values(removeSocketKeys(usedRoomIds[roomId].players))}));
                    }
                    break;
                }
            }
    }catch(err){console.log(err);}});

    socket.on('chooseCard', (cardindex) => {try{
        cardindex = parseInt(cardindex);
        let roomId = getRoomIdBySocketId(socket.id);
        if (!roomId) return;
        if (usedRoomIds[roomId].isInCardAnimation) return;
        if (cardindex < 0 || cardindex >= usedRoomIds[roomId].board.length) return;
        if (Object.keys(usedRoomIds[roomId].players).indexOf(socket.id) !== usedRoomIds[roomId].turn) return;
        if (usedRoomIds[roomId].choosedCardIndex === -1) {
            usedRoomIds[roomId].isInCardAnimation = true;
            usedRoomIds[roomId].choosedCardIndex = cardindex;
            for (const playerSocketId in usedRoomIds[roomId].players) {
                universalPlayerInfo[playerSocketId].socket.emit('flipCardUp', JSON.stringify({cardIndex: cardindex, symbol: usedRoomIds[roomId].board[cardindex]}));
            }
            setTimeout(() => {
                usedRoomIds[roomId].isInCardAnimation = false;
            }, 1000);
        } else if (cardindex != choosedCardIndex) {
            usedRoomIds[roomId].isInCardAnimation = true;
            for (const playerSocketId in usedRoomIds[roomId].players) {
                universalPlayerInfo[playerSocketId].socket.emit('flipCardUp', JSON.stringify({cardIndex: cardindex, symbol: usedRoomIds[roomId].board[cardindex]}));
            }
            setTimeout(() => {
                let switchTurn = true;
                //check if selected card is equals choosed card
                if (usedRoomIds[roomId].board[cardindex] === usedRoomIds[roomId].board[usedRoomIds[roomId].choosedCardIndex]) {
                    for (const playerSocketId in usedRoomIds[roomId].players) {
                        universalPlayerInfo[playerSocketId].socket.emit('removeCard', cardindex.toString());
                        universalPlayerInfo[playerSocketId].socket.emit('removeCard', usedRoomIds[roomId].choosedCardIndex.toString());
                    }
                    switchTurn = false;
                    usedRoomIds[roomId].players[socket.id].score++;
                }else {
                    for (const playerSocketId in usedRoomIds[roomId].players) {
                        universalPlayerInfo[playerSocketId].socket.emit('flipCardDown', cardindex.toString());
                        universalPlayerInfo[playerSocketId].socket.emit('flipCardDown', usedRoomIds[roomId].choosedCardIndex.toString());
                    }
                }
                setTimeout(() => {
                    if (switchTurn) {
                        usedRoomIds[roomId].turn++;
                        if (usedRoomIds[roomId].turn >= Object.keys(usedRoomIds[roomId].players).length) {
                            usedRoomIds[roomId].turn = 0;
                        }
                    }
                    for (const playerSocketId in usedRoomIds[roomId].players) {
                        universalPlayerInfo[playerSocketId].socket.emit('updateTurnIndex', usedRoomIds[roomId].turn.toString());
                        universalPlayerInfo[playerSocketId].socket.emit('updatePlayerList', JSON.stringify({players: Object.values(removeSocketKeys(usedRoomIds[roomId].players))}));
                    }
                    usedRoomIds[roomId].isInCardAnimation = false;
                    usedRoomIds[roomId].choosedCardIndex = -1;
                }, 1000);
            }, 1000);
        }
    }catch(err){console.log(err);}});
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);

  //require('./bots')();
});