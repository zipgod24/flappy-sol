const express = require('express');
const cors = require('cors');
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/node_modules', express.static(path.join(__dirname, '../frontend/node_modules'))); // Add this

(async () => {
  const adapter = new JSONFile('db.json');
  const defaultData = { deposits: [], games: [] };
  const db = new Low(adapter, defaultData);
  await db.read();
  db.data ||= defaultData;
  await db.write();

  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const GAME_ADDRESS = new PublicKey('AXDddm4GDjKefAqScFc12Qg3DHk65ZkVRamx9j5vsxU6');

  app.get('/check-deposit/:userPubkey/:amount', async (req, res) => {
    const { userPubkey, amount } = req.params;
    console.log(`Received check-deposit: user=${userPubkey}, amount=${amount}`); // Debug
    try {
      await db.read();
      const deposit = db.data.deposits.find(
        d => d.userPubkey === userPubkey && d.amount === amount && (d.status === 'confirmed' || d.status === 'handled')
      );
      if (deposit) {
        console.log('Found confirmed/handled deposit:', deposit);
        return res.json({ confirmed: true, signature: deposit.signature || 'manual' });
      }

      const userPk = new PublicKey(userPubkey);
      const expectedLamports = parseFloat(amount) * LAMPORTS_PER_SOL;
      const sigs = await connection.getSignaturesForAddress(userPk, { limit: 10 });
      for (const sigInfo of sigs) {
        if (sigInfo.confirmationStatus !== 'confirmed') continue;
        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0
        });
        if (!tx || !tx.meta) continue;
        const transferIx = tx.transaction.message.instructions.find(ix => 
          ix.programId.equals(new PublicKey('11111111111111111111111111111111')) && 
          ix.parsed && ix.parsed.type === 'transfer'
        );
        if (transferIx && transferIx.parsed.info.destination === GAME_ADDRESS.toString() &&
            Math.abs(transferIx.parsed.info.lamports - expectedLamports) < 1e6) {
          await db.read();
          const existing = db.data.deposits.find(d => d.userPubkey === userPubkey && d.amount === amount && d.status === 'pending');
          if (existing) {
            existing.status = 'confirmed';
            existing.signature = sigInfo.signature;
            await db.write();
            console.log('Updated deposit to confirmed:', existing);
          } else {
            db.data.deposits.push({ userPubkey, amount, status: 'confirmed', signature: sigInfo.signature, timestamp: Date.now() });
            await db.write();
            console.log('Added confirmed deposit:', { userPubkey, amount });
          }
          return res.json({ confirmed: true, signature: sigInfo.signature });
        }
      }

      await db.read();
      if (!db.data.deposits.some(d => d.userPubkey === userPubkey && d.amount === amount && d.status === 'pending')) {
        db.data.deposits.push({ userPubkey, amount, status: 'pending', timestamp: Date.now() });
        await db.write();
        console.log('Stored pending deposit:', { userPubkey, amount });
      }
      res.json({ confirmed: false });
    } catch (e) {
      console.error('check-deposit error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/game-result', async (req, res) => {
    const data = req.body;
    await db.read();
    db.data.games.push({ ...data, status: 'pending_payout', timestamp: Date.now() });
    await db.write();
    console.log('Stored game result:', data);
    res.json({ success: true });
  });

  app.get('/admin', async (req, res) => {
    await db.read();
    console.log('Admin data:', db.data);
    res.json({ deposits: db.data.deposits, games: db.data.games });
  });

  app.post('/admin/confirm/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    await db.read();
    const list = type === 'deposit' ? db.data.deposits : db.data.games;
    if (list[id]) {
      list[id].status = 'handled';
      await db.write();
      console.log(`Marked ${type} ${id} as handled`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });

  app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();