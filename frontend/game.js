let birdY = 300, velocity = 0, gravity = 0.6, jump = -10;
let pipes = [], score = 0, gameOver = false, canvas, ctx, gameMultiplier;

function startGame(multiplier, pipesTarget) {
  gameMultiplier = parseFloat(multiplier);
  birdY = 300;
  velocity = 0;
  pipes = [{ x: 400, gapY: 200 + Math.random() * 200, gapSize: 150, passed: false }];
  score = 0;
  gameOver = false;
  gameLoop();
}

function update() {
  if (gameOver) return;
  velocity += gravity;
  birdY += velocity;
  if (birdY > canvas.height - 30 || birdY < 0) { gameOver = true; endGame(); return; }
  pipes.forEach((pipe, i) => {
    pipe.x -= 3;
    if (pipe.x + 60 < 0) { pipes.splice(i, 1); addPipe(); return; }
    if (pipe.x + 60 === 50 && !pipe.passed) { score++; pipe.passed = true; }
    if (pipe.x < 50 && pipe.x > -10) {
      if (birdY < pipe.gapY || birdY > pipe.gapY + pipe.gapSize) { gameOver = true; endGame(); }
    }
  });
  if (pipes[pipes.length - 1].x < 200) addPipe();
}

function addPipe() {
  const gapY = 100 + Math.random() * 300;
  pipes.push({ x: 400, gapY, gapSize: 150, passed: false });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'yellow'; ctx.fillRect(30, birdY, 30, 30); // Bird
  ctx.fillStyle = 'green';
  pipes.forEach(pipe => {
    ctx.fillRect(pipe.x, 0, 60, pipe.gapY); // Top pipe
    ctx.fillRect(pipe.x, pipe.gapY + pipe.gapSize, 60, canvas.height - pipe.gapY - pipe.gapSize); // Bottom
  });
  ctx.fillStyle = 'black'; ctx.font = '20px Arial';
  ctx.fillText(`Score: ${score}/${targetPipes}`, 10, 30);
}

function gameLoop() {
  update(); draw();
  if (!gameOver) requestAnimationFrame(gameLoop);
}

function endGame() {
  const won = score >= targetPipes;
  const betAmount = parseFloat(document.getElementById('amount').value);
  const payout = won ? (betAmount * gameMultiplier).toFixed(4) : 0;
  alert(`Game Over! Score: ${score}/${targetPipes}\n${won ? `WIN! Payout: ${payout} SOL (manual from admin)` : 'Lost :('}`);
  fetch('/game-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userPubkey: userPubkey, score, won, payout, amount: betAmount, multiplier: gameMultiplier, targetPipes })
  });
}

document.addEventListener('keydown', e => { if (e.code === 'Space' && !gameOver) velocity = jump; });
canvas = document.getElementById('game-canvas'); ctx = canvas.getContext('2d');