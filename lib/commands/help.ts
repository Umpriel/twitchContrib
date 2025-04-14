import { CommandHandler, CommandContext } from './base';

export class HelpCommand implements CommandHandler {
  matches(message: string): boolean {
    const cleanMessage = message.trim().toLowerCase();
    return cleanMessage === '!contrib --help' || 
           cleanMessage === '!contrib -h' || 
           cleanMessage === '!contrib help';
  }

  async execute(context: CommandContext): Promise<boolean> {
    const { channel, username, client } = context;
    
    try {
      await client.say(channel, `@${username} 📝 HOW TO USE !CONTRIB:

1️⃣ For specific line: !contrib filename -l line_number code
2️⃣ Without line: !contrib filename code
3️⃣ Append to existing: !contrib -A contrib_id additional_code
4️⃣ Use \\n for line breaks: !contrib file.js function() {\\n  console.log("new line");\\n}

📌 EXAMPLES:
• !contrib main.js -l 10 console.log("Hello World");
• !contrib style.css body { margin: 0; }
• !contrib -A 42 .then(data => console.log(data));
• !contrib -A 42 \\nreturn result; // Adds code on a new line`);
      
      return true; // Command handled successfully
    } catch (error) {
      console.error('Error sending help message:', error);
      return false;
    }
  }
} 