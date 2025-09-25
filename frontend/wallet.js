let userPubkey = null;
let pollInterval = null;
let targetPipes = 0;

document.getElementById('connect-wallet').onclick = async () => {
  if ('solana' in window && window.solana.isPhantom) {
    try {
      const resp = await window.solana.connect();
      userPubkey = resp.publicKey.toString();
      document.getElementById('connect-wallet').textContent = `Connected: ${userPubkey.slice(0, 4)}...${userPubkey.slice(-4)}`;
      document.getElementById('connect-wallet').disabled = true;
      document.getElementById('deposit-form').style.display = 'block';
      console.log('Wallet connected:', userPubkey);
    } catch (err) {
      alert('Connection failed: ' + err.message);
      console.error('Wallet connection error:', err);
    }
  } else {
    alert('Install Phantom Wallet!');
    console.error('Phantom wallet not detected');
  }
};

async function startDeposit() {
  const amount = document.getElementById('amount').value;
  const multiplier = document.getElementById('multiplier').value;
  const pipes = document.getElementById('pipes').value;
  if (!amount || !multiplier || !pipes || !userPubkey) {
    alert('Fill all fields and connect wallet!');
    console.error('Missing fields:', { amount, multiplier, pipes, userPubkey });
    return;
  }
  targetPipes = parseInt(pipes);
  document.getElementById('deposit-form').style.display = 'none';
  document.getElementById('qr-section').style.display = 'block';
  const address = 'AXDddm4GDjKefAqScFc12Qg3DHk65ZkVRamx9j5vsxU6';
  const uri = `solana:${address}?amount=${amount}`;
  console.log('Generating QR for URI:', uri);
  const qrCanvas = document.getElementById('qr-canvas');
  if (!qrCanvas) {
    console.error('QR canvas element not found');
    alert('Error: QR canvas not found. Check console.');
    return;
  }
  qrCanvas.width = 200;
  qrCanvas.height = 200;
  if (typeof QRCode === 'undefined') {
    console.error('QRCode library not loaded');
    alert('QRCode library not loaded. Please refresh and try again.');
    return;
  }
  try {
    QRCode.toCanvas(qrCanvas, uri, { width: 200, errorCorrectionLevel: 'H' }, (err) => {
      if (err) {
        console.error('QRCode generation error:', err);
        alert('Failed to generate QR code. Check console.');
      } else {
        console.log('QR code rendered successfully');
      }
    });
  } catch (err) {
    console.error('QRCode try-catch error:', err);
    alert('QR code generation failed. Check console.');
  }
  console.log('Sending deposit check for user:', userPubkey, 'amount:', amount);
  try {
    const response = await fetch(`/check-deposit/${userPubkey}/${amount}`, { method: 'GET' });
    const data = await response.json();
    console.log('Initial deposit check response:', data);
  } catch (err) {
    console.error('Initial deposit check fetch error:', err);
    alert('Failed to check deposit. Check console.');
  }
  clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    try {
      const resp = await fetch(`/check-deposit/${userPubkey}/${amount}`);
      if (!resp.ok) {
        console.error('Poll fetch error: HTTP', resp.status, resp.statusText);
        return;
      }
      const data = await resp.json();
      console.log('Poll response:', data);
      if (data.confirmed) {
        clearInterval(pollInterval);
        pollInterval = null;
        document.getElementById('qr-section').style.display = 'none';
        document.getElementById('game-section').style.display = 'block';
        console.log('Starting game with multiplier:', multiplier, 'pipes:', pipes);
        if (typeof startGame === 'undefined') {
          console.error('startGame function not defined');
          alert('Game failed to start. Check console.');
          return;
        }
        startGame(multiplier, pipes);
      }
    } catch (err) {
      console.error('Poll fetch error:', err);
    }
  }, 5000);
}