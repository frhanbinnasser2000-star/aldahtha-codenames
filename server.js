const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// حزمة كلمات مخصصة (يمكنك تعديلها وإضافة كلمات خاصة بالسيرفر)
const defaultWords = [
  "الدعثه", "الوزارة", "بوت", "صوت", "روم", "أدمن", "بان", "تكت", 
  "سيرفر", "قوانين", "رتبة", "صلاحية", "تنبيه", "سجل", "صورة", "بأنر",
  "مشرف", "عضو", "تفاعل", "فعالية", "صوتية", "كود", "لوحة", "مراقبة", "قناة"
];

const rooms = {};

function createNewGame() {
  // اختيار 25 كلمة عشوائية
  const shuffledWords = [...defaultWords].sort(() => 0.5 - Math.random()).slice(0, 25);
  
  // توزيع البطاقات: 9 أحمر، 8 أزرق، 1 أسود (قاتل)، والباقي محايد (أبيض)
  const types = ['red', 'red', 'red', 'red', 'red', 'red', 'red', 'red', 'red',
                 'blue', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue',
                 'black',
                 ...Array(7).fill('neutral')].sort(() => 0.5 - Math.random());

  const board = shuffledWords.map((word, index) => ({
    word,
    type: types[index],
    revealed: false
  }));

  return {
    board,
    turn: 'red', // يبدأ الفريق الأحمر
    scores: { red: 9, blue: 8 },
    gameOver: false,
    winner: null
  };
}

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ room, username, team, role }) => {
    socket.join(room);
    
    if (!rooms[room]) {
      rooms[room] = createNewGame();
    }

    socket.data = { username, team, role, room };
    io.to(room).emit('gameState', rooms[room]);
  });

  socket.on('selectCard', (index) => {
    const room = socket.data.room;
    const game = rooms[room];

    if (!game || game.gameOver) return;
    // منع عملاء الفريق المتاحة أو السماح بالضغط حسب الدور
    if (game.board[index].revealed) return;

    game.board[index].revealed = true;
    const cardType = game.board[index].type;

    // فحص الخسارة بسبب البطاقة السوداء
    if (cardType === 'black') {
      game.gameOver = true;
      game.winner = socket.data.team === 'red' ? 'blue (بسبب الكلمة القاتلة)' : 'red (بسبب الكلمة القاتلة)';
    } else if (cardType === 'red') {
      // إذا كشف الأحمر بطاقته
      if (socket.data.team === 'red') {
        game.scores.red--;
        if (game.scores.red === 0) { game.gameOver = true; game.winner = 'red'; }
      }
    } else if (cardType === 'blue') {
      if (socket.data.team === 'blue') {
        game.scores.blue--;
        if (game.scores.blue === 0) { game.gameOver = true; game.winner = 'blue'; }
      }
    }

    io.to(room).emit('gameState', game);
  });

  socket.on('resetGame', () => {
    const room = socket.data.room;
    if (room) {
      rooms[room] = createNewGame();
      io.to(room).emit('gameState', rooms[room]);
    }
  });
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
