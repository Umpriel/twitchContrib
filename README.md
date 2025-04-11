# TwitchContrib

A Twitch bot that allows viewers to suggest code contributions through chat commands. The bot stores these suggestions in a database and provides a web interface for reviewing and managing contributions.

## Features

- Twitch chat command (!contrib) for submitting code suggestions with syntax highlighting
- Real-time code formatting with proper indentation
- Duplicate submission prevention
- Web interface for reviewing pending contributions
- Accept/reject workflow for managing submissions
- SQLite database for local development
- Postgres database for production deployment on Vercel -- Tested with neon
- Syntax highlighting for multiple languages
- User contribution tracking and cooldown system

## Todo
- Add apply on vscode Feature
- Add apply on neovim Feature


## Setup

### Local Development
1. Clone the repository:
```bash
git clone https://github.com/Umpriel/twitchContrib.git
cd twitch-contrib
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
  Local Development:
   - Copy `.env.example` to `.env.local` or `.env`
   - Fill in your Twitch credentials:
     - `TWITCH_CLIENT_ID`: Your bot's client ID
     - `TWITCH_CLIENT_SECRET`: Your bot secret from https://dev.twitch.tv/console
     - `TWITCH_CHANNEL`: Your channel name
     - `TWITCH_BOT_USERNAME`: Your bot's username - from the console
     - `TWITCH_OAUTH_TOKEN`: OAuth token for bot authentication (from https://twitchapps.com/tmi/)

4. Start the development server:
```bash
npm run dev
```

### Vercel Deployment
1. Fork the repository
2. Create a twitch app in https://dev.twitch.tv/console (make it confidential)
3. Create a new Vercel project and connect it to this repository.
4. Deploy the project.
5. If you already made .env file for local just drag and drop the `.env` file into the Vercel settings > environment variables
   If not then use the same steps to get the vars then add them to the Vercel environment variables
6. Go to Storage > create a new database > Neon > It will be automatically added to the environment variables
7. Redeploy the project from the Vercel dashboard > Deployments > New > Redeploy
8. Go to https://dev.twitch.tv/console edit your app and setup the redirect uri to your vercel url (e.g. https://{your-vercel-app-url}/api/auth/callback )
9. You should be all set! if you have any issues create an issue on the github.

## Usage

### Twitch Chat Commands

Submit code with automatic formatting:
```
!contrib filename.ext function example() { \n console.log("hello"); \n }
```

Submit code with line number:
```
!contrib filename.ext line:123 function example() { \n console.log("hello"); \n }
```

The code will be automatically formatted with proper indentation and syntax highlighting.

### Web Interface

Access the web interface at `http://localhost:3005` to:
- View pending contributions with syntax highlighting
- Accept or reject submissions
- View contribution history
- Refresh contributions in real-time

## Development

- Development server: `npm run dev`
- Build: `npm run build`
- Production start: `npm start`

## Technologies

- Next.js 13
- TypeScript
- TMI.js (Twitch chat integration)
- SQLite3 with better-sqlite3
- Tailwind CSS
- Prism.js for syntax highlighting
- Heroicons