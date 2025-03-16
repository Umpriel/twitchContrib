import express from 'express';
import tmi from 'tmi.js';
import { initializeDatabase, getDb } from './db/schema';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Configure express
app.set('view engine', 'ejs');
app.set('views', './src/views');
app.use(express.json());

// Configure Twitch client
const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: process.env.TWITCH_BOT_USERNAME,
    password: process.env.TWITCH_BOT_TOKEN
  },
  channels: [process.env.TWITCH_CHANNEL || '']
});

// Parse contribution command
const parseContribution = (message: string) => {
  const regex = /!contrib\s+(\S+)\s+line:\s*(\d+)(?:\s+char:\s*(\d+))?\s+(.+)/;
  const match = message.match(regex);
  if (!match) return null;

  return {
    filename: match[1],
    lineNumber: parseInt(match[2]),
    characterNumber: match[3] ? parseInt(match[3]) : null,
    code: match[4]
  };
};

// Handle Twitch messages
client.on('message', async (channel, tags, message, self) => {
  if (self || !message.startsWith('!contrib')) return;

  const contribution = parseContribution(message);
  if (!contribution) return;

  const db = getDb();
  const username = tags['display-name'] || tags.username;

  db.serialize(() => {
    // Create or get user
    db.run('INSERT OR IGNORE INTO users (username) VALUES (?)', [username]);
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row: any) => {
      if (err) return console.error(err);

      // Store contribution
      db.run(
        'INSERT INTO contributions (user_id, filename, line_number, character_number, code) VALUES (?, ?, ?, ?, ?)',
        [row.id, contribution.filename, contribution.lineNumber, contribution.characterNumber, contribution.code]
      );
    });
  });
});

// API routes
app.get('/', async (req, res) => {
  const db = getDb();
  db.all(`
    SELECT c.*, u.username 
    FROM contributions c 
    JOIN users u ON c.user_id = u.id 
    ORDER BY c.created_at DESC
  `, (err, contributions) => {
    if (err) return res.status(500).send(err);
    res.render('index', { contributions });
  });
});

interface StatusUpdateParams {
  id: string;
}

interface StatusUpdateBody {
  status: 'accepted' | 'rejected';
}

interface StatusUpdateResponse {
  success: boolean;
}

app.post('/contributions/:id/status', (async (
  req: express.Request<StatusUpdateParams, StatusUpdateResponse, StatusUpdateBody>,
  res: express.Response<StatusUpdateResponse>
) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== 'accepted' && status !== 'rejected') {
    return res.status(400).json({ success: false });
  }

  const db = getDb();
  db.run(
    'UPDATE contributions SET status = ? WHERE id = ?',
    [status, id],
    (err) => {
      if (err) return res.status(500).json({ success: false });
      
      // Update user statistics
      const updateField = status === 'accepted' ? 'accepted_contributions' : 'rejected_contributions';
      db.run(
        `UPDATE users SET ${updateField} = ${updateField} + 1 
         WHERE id = (SELECT user_id FROM contributions WHERE id = ?)`,
        [id]
      );
      
      res.json({ success: true });
    }
  );
}) as express.RequestHandler<StatusUpdateParams, StatusUpdateResponse, StatusUpdateBody>);

// Start the application
const startApp = async () => {
  await initializeDatabase();
  client.connect();
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
};

startApp().catch(console.error); 