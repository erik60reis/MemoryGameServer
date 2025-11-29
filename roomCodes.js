const CODE_LENGTH = 4;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid ambiguous chars

const codeToRoomId = new Map();
const roomIdToCode = new Map();

function generateCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = Math.floor(Math.random() * ALPHABET.length);
    code += ALPHABET[index];
  }
  return code;
}

function allocateCode(roomId) {
  // Attempt to find unused code (retry capped to avoid infinite loop)
  for (let attempts = 0; attempts < 100; attempts++) {
    const candidate = generateCode();
    if (!codeToRoomId.has(candidate)) {
      codeToRoomId.set(candidate, roomId);
      roomIdToCode.set(roomId, candidate);
      return candidate;
    }
  }

  throw new Error("Unable to allocate unique room code");
}

function registerRoom(roomId) {
  if (roomIdToCode.has(roomId)) {
    return roomIdToCode.get(roomId);
  }
  return allocateCode(roomId);
}

function releaseRoom(roomId) {
  const code = roomIdToCode.get(roomId);
  if (!code) {
    return;
  }
  roomIdToCode.delete(roomId);
  codeToRoomId.delete(code);
}

function getRoomIdFromCode(rawCode) {
  if (!rawCode) {
    return null;
  }
  const normalized = rawCode.toString().trim().toUpperCase();
  return codeToRoomId.get(normalized) || null;
}

function getCodeFromRoomId(roomId) {
  return roomIdToCode.get(roomId) || null;
}

module.exports = {
  registerRoom,
  releaseRoom,
  getRoomIdFromCode,
  getCodeFromRoomId
};
