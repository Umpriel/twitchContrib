# TwitchContrib

A Twitch bot that allows viewers to suggest code contributions through chat commands. The bot stores these suggestions in a database and provides a web interface for reviewing and managing contributions.

<details>
<summary><strong>Features</strong> (click to expand)</summary>

- Twitch chat command (!contrib) for submitting code suggestions with syntax highlighting
- Real-time code formatting with proper indentation
- Duplicate submission prevention
- Web interface for reviewing pending contributions
- Accept/reject workflow for managing submissions
- SQLite database for local development
- Postgres database for production deployment on Vercel -- Tested with neon
- Syntax highlighting for multiple languages
- User contribution tracking and cooldown system
</details>

<details>
<summary><strong>Todo</strong> (click to expand)</summary>

- Add apply on vscode Feature -- completed for local. need to do for vercel
- Add apply on neovim Feature
</details>

<details>
<summary><strong>Setup</strong> (click to expand)</summary>

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
   - Create a twitch app (bot) in [console](https://dev.twitch.tv/console) (make it confidential)
   - Copy `.env.example` to `.env.local` or `.env`
   - Fill in your Twitch credentials:
     - `TWITCH_CLIENT_ID`: Your bot's client ID - from the console
     - `TWITCH_CLIENT_SECRET`: Your bot secret - from the console
     - `TWITCH_CHANNEL`: Your channel name
     - `TWITCH_BOT_USERNAME`: Your bot's username - from the console
     - `TWITCH_OAUTH_TOKEN`: visit > [twitchtokengenerator](https://twitchtokengenerator.com/) > select Bot Chat Token > Authorize > scroll down a little and make sure `chat:read` and `chat:edit` are toggled on, if they are then copy the `ACCESS TOKEN` if not, toggle them > Click Generate Token > Authorize again then copy the `ACCESS TOKEN` and paste it as your `TWITCH_OAUTH_TOKEN`

5. Start the development server:
```bash
npm run dev
```

### Vercel Deployment
1. Fork the repository
2. Create a twitch app in [console](https://dev.twitch.tv/console) (make it confidential)
3. Create a new Vercel project and connect it to this repository.
4. Deploy the project.
5. If you already made .env file for local just drag and drop the `.env` file into the Vercel settings > environment variables
   If not then use the same steps in local development to get the vars then add them to the Vercel environment variables
6. Go to Storage > create a new database > Neon > It will be automatically added to the environment variables
7. Redeploy the project from the Vercel dashboard > Deployments > New > Redeploy
8. Go to https://dev.twitch.tv/console edit your app and setup the redirect uri to your vercel url (e.g. https://{your-vercel-app-url}/api/auth/callback )
9. You should be all set! if you have any issues create an issue on the github.
</details>

<details>
<summary><strong>Usage</strong> (click to expand)</summary>

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
</details>

<details>
<summary><strong>Development</strong> (click to expand)</summary>

- Development server: `npm run dev`
- Build: `npm run build`
- Production start: `npm start`
</details>

<details>
<summary><strong>Technologies</strong> (click to expand)</summary>

- Next.js 15.2.4
- React 18.2.0
- TypeScript 5.4.2
- TMI.js 1.8.5
- SQLite3 with better-sqlite3 11.9.1
- Tailwind CSS 3.3.3
- Prism.js 1.30.0
- Heroicons 2.2.0
- @twurple/api, @twurple/auth, @twurple/chat 7.2.1
- @vercel/postgres 0.10.0
</details>

<details>
<summary><strong>VSCode Integration</strong> (click to expand)</summary>

The TwitchContrib VSCode extension allows you to receive code contributions directly into your editor, with files created in the correct location and code inserted at specific line numbers.

### Installation

1. Install the TwitchContrib VSCode extension:
   - Navigate to the `extensions/vscode-contrib` directory
   - Run `npm install` (if needed)
   - Install the VSCE tool: `npm install -g @vscode/vsce` (or `npm install -g @vscode/vsce`)
   - Package the extension: `vsce package` (or use `npx @vscode/vsce package`)
   - Install the extension in VSCode: `code --install-extension twitchcontrib-0.1.0.vsix`

2. Once installed, the extension will automatically start a local server on port 54321.

### Usage

1. **Project Root Detection**: The extension automatically detects your workspace folder as the repository root when:
   - VSCode first starts with the extension active
   - When you receive your first contribution (if no root was set before)

2. **Sending Contributions**:
   - In the TwitchContrib web interface, accepted contributions will have a "Send to VSCode" button
   - When clicked, you can optionally specify a relative path for the file
   - The file will be created/updated in your project, and opened in the editor

3. **Available Commands** (Access via Command Palette - Ctrl+Shift+P):
   - `TwitchContrib: Select Repository Root` - Manually choose your project root folder
   - `TwitchContrib: Set Manual Path Override` - Specify an absolute path to use instead of workspace folder
   - `TwitchContrib: Show Current Paths` - Display which paths are currently configured
   - `TwitchContrib: Create New File` - Create a new file in your project

4. **Path Priority**:
   - Manual path override (if set)
   - Repository root path
   - Current workspace folder
   - User prompt as fallback

### Troubleshooting

- If files are created in the wrong location, use the `TwitchContrib: Show Current Paths` command to check your current configuration
- Use `TwitchContrib: Set Manual Path Override` to explicitly set the base path for all contributions
- To reset the manual path override, run the command and leave the input field empty
</details>
