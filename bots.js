/*const io = require("socket.io-client");

const serverUrl = "http://localhost:3000"; // URL of your server
const min_active_players = 3; // Minimum active players required; bots will fill in if fewer players are online

let botSockets = [];

// Function to create a bot and make it join a random room
function createBot() {
    const socket = io(serverUrl);
    let leaveTimeout = setTimeout(() => {
        socket.disconnect();
    }, 3000);

    const randomNickname = `Bot${Math.floor(Math.random() * 1000)}`;
    socket.emit("setNickname", randomNickname);

    socket.on("welcome", () => {
        console.log(`${randomNickname} connected to server`);
        socket.emit("joinRoom", "randomRoom"); // Try to create or join a room
    });

    // Listen for the roomJoined event to start playing
    socket.on("roomJoined", (roomId) => {
        console.log(`${randomNickname} joined room ${roomId}`);
        isInRoom = true;
        clearTimeout(leaveTimeout);
    });


    socket.on('updateTurnIndex', (turnIndex) => {
        playRandomly(socket);
    });

    // Listen for the updated player list to count players in the room
    socket.on("updatePlayerList", (data) => {
        const players = JSON.parse(data).players;

        if (players.length > min_active_players) {
            socket.disconnect();
        }
        // If the room is empty or the player count is too low, add more bots
        if (players.length < min_active_players) {
            spawnBots(min_active_players - players.length);
        }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
        console.log(`${randomNickname} disconnected`);
        botSockets = botSockets.filter((s) => s !== socket);
    });

    botSockets.push(socket);
}

// Function for the bot to play randomly
function playRandomly(socket) {
    const playTimeout = setTimeout(() => {
        // Randomly select a card to "flip"
        const cardIndex = Math.floor(Math.random() * 100);
        socket.emit("chooseCard", cardIndex.toString());

        console.log(`Bot played card at index ${cardIndex}`);

        // Optional: Stop playing randomly after some rounds to simulate a "leaving" bot
        if (Math.random() < 0.02) {
            clearTimeout(playTimeout);
            socket.disconnect();
        }
    }, 1000 + Math.random() * 5000); // Random delay between moves for a more human-like pace
}

// Function to spawn a set number of bots
function spawnBots(count) {
    for (let i = 0; i < count; i++) {
        createBot();
    }
}

// Start monitoring and adding bots if necessary
function monitorAndAddBots() {
    if (botSockets.length < min_active_players) {
        spawnBots(min_active_players - botSockets.length);
    }
    setTimeout(monitorAndAddBots, 5000); // Re-check every 5 seconds
}

module.exports = monitorAndAddBots;*/