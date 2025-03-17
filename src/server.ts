import express from 'express';
import { initializeDatabase, getDb } from './db/schema';
import { RefreshingAuthProvider, exchangeCode } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { ChatClient } from '@twurple/chat';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3005;

// Configure express
app.set('view engine', 'ejs');
app.set('views', './src/views');
app.use(express.json());

// Twitch Auth setup
const authProvider = new RefreshingAuthProvider({
  clientId: process.env.TWITCH_CLIENT_ID!,
  clientSecret: process.env.TWITCH_CLIENT_SECRET!
});

// Initialize auth and start app
const initAuth = async () => {
  // Start without tokens, wait for auth
  await startApp();
};

// Auth routes
app.get('/auth/twitch', (_, res) => {
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=${process.env.TWITCH_REDIRECT_URI}&response_type=code&scope=${process.env.TWITCH_SCOPES}`;
  res.redirect(authUrl);
});

app.get('/auth/twitch/callback', (async (
  req: express.Request<{}, any, any, { code?: string; error?: string; error_description?: string }>,
  res: express.Response
) => {
  const code = req.query.code;
  const error = req.query.error;
  
  if (error) {
    console.error('Auth Error:', error, req.query.error_description);
    return res.status(500).send(`Authentication failed: ${error}`);
  }

  try {
    const tokenData = await exchangeCode(
      process.env.TWITCH_CLIENT_ID!,
      process.env.TWITCH_CLIENT_SECRET!,
      code!,
      process.env.TWITCH_REDIRECT_URI!
    );
    await authProvider.addUserForToken(tokenData, ['chat']);
    await chatClient.connect();
    res.redirect('/');
  } catch (err) {
    console.error('Token Exchange Error:', err);
    res.status(500).send('Authentication failed');
  }
}) as express.RequestHandler);

// Initialize Twitch clients
const apiClient = new ApiClient({ authProvider });
const chatClient = new ChatClient({
  authProvider,
  channels: [process.env.TWITCH_CHANNEL!],
  // Add debug logging
  logger: {
    minLevel: 'debug'
  }
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

// Handle chat messages
chatClient.onMessage(async (channel, user, message) => {
  console.log('\n=== New Message ===');
  console.log(`Channel: ${channel}`);
  console.log(`User: ${user}`);
  console.log(`Message: ${message}`);

  if (!message.startsWith('!contrib')) {
    return;
  }

  console.log('\n=== Processing Contribution ===');
  const contribution = parseContribution(message);
  if (!contribution) {
    console.log('❌ Failed to parse contribution format');
    return;
  }
  console.log('✓ Parsed contribution:', contribution);

  const db = getDb();
  console.log('\n=== Database Operations ===');
  db.serialize(() => {
    // Create or get user
    db.run('INSERT OR IGNORE INTO users (username) VALUES (?)', [user], (err) => {
      if (err) console.error('❌ Error creating user:', err);
      else console.log('✓ User created/verified:', user);
    });
    
    db.get('SELECT id FROM users WHERE username = ?', [user], (err, row: any) => {
      if (err) {
        console.error('❌ Error getting user:', err);
        return;
      }
      console.log('✓ Found user ID:', row?.id);

      // Store contribution
      db.run(
        'INSERT INTO contributions (user_id, filename, line_number, character_number, code) VALUES (?, ?, ?, ?, ?)',
        [row.id, contribution.filename, contribution.lineNumber, contribution.characterNumber, contribution.code],
        (err) => {
          if (err) console.error('❌ Error storing contribution:', err);
          else console.log('✓ Contribution stored successfully');
        }
      );
    });
  });
});

// After connecting
chatClient.onConnect(() => {
  console.log('Connected to Twitch chat');
});

chatClient.onDisconnect((reason) => {
  console.error('Disconnected from chat:', reason);
});

// API routes
app.get('/', async (req, res) => {
  console.log('Fetching contributions');
  const db = getDb();
  db.all(`
    SELECT c.*, u.username 
    FROM contributions c 
    JOIN users u ON c.user_id = u.id 
    ORDER BY c.created_at DESC
  `, (err, contributions) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send(err);
    }
    console.log('Found contributions:', contributions);
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
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Please authenticate at http://localhost:${port}/auth/twitch`);
  });
  
  // Only connect chat after successful auth
  // chatClient.connect() will be called after we get tokens
};

initAuth().catch(console.error); 