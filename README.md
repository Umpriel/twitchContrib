# TwitchContrib

A Twitch bot that allows viewers to suggest code contributions through chat commands. The bot stores these suggestions in a database and provides a web interface for reviewing and managing contributions.

## Features

- Twitch chat command (!contrib) for submitting code suggestions
- Web interface for reviewing pending contributions
- Accept/reject workflow for managing submissions
- SQLite database for storing contributions and user statistics
- User contribution tracking

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd twitch-contrib
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your Twitch credentials:
     - `TWITCH_BOT_USERNAME`: Your bot's username
     - `TWITCH_BOT_TOKEN`: OAuth token (get from https://twitchapps.com/tmi/)
     - `TWITCH_CHANNEL`: Your channel name
     - `PORT`: Web server port (default: 3000)

4. Start the application:
```bash
npm start
```

## Usage

### Twitch Chat Commands

- Submit a contribution:
```
!contrib filename line:123 your code here
```
- With character position:
```
!contrib filename line:123 char:45 your code here
```

### Web Interface

Access the web interface at `http://localhost:3000` to:
- View all contributions
- Accept or reject pending contributions
- See contribution status (pending/accepted/rejected)

## Development

- Build: `npm run build`
- Serve production build: `npm run serve`
- Development with hot reload: `npm start`

## Technologies

- TypeScript
- Express.js
- TMI.js (Twitch chat integration)
- SQLite3
- EJS (templating)