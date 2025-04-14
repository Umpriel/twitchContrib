import db from '../db';
import { CommandHandler, CommandContext } from './base';

export class IncompleteArgumentCommand implements CommandHandler {
  // Serious, professional messages
  private seriousStuff = {
    appendNoId: "Missing contribution ID and code. Use: !contrib -A contrib_id your_code_here",
    appendNoCode: "Missing code to append. Use: !contrib -A contrib_id your_code_here",
    prependNoId: "Missing contribution ID and code. Use: !contrib -0 contrib_id your_code_here",
    prependNoCode: "Missing code to prepend. Use: !contrib -0 contrib_id your_code_here",
    replaceNoId: "Missing contribution ID and code. Use: !contrib -C contrib_id new_code",
    replaceNoCode: "Missing code to replace with. Use: !contrib -C contrib_id new_code",
    deleteNoId: "Missing contribution ID. Use: !contrib -D contrib_id",
    statusNoId: "Missing contribution ID. Use: !contrib -status contrib_id",
    grepNoFile: "Missing filename. Use: !contrib -grep filename",
    lineNoNumber: "Missing line number. Use: !contrib filename -l line_number code",
    lineNoCode: "Missing code after line number. Use: !contrib filename -l line_number code"
  };

  // Humorous, casual messages
  private HUH = {
    appendNoId: "Append with no ID!! what do you want me to do, manifest it from stardust? Try: !contrib -A 123 console.log('this') Kreygasm",
  
    appendNoCode: "Appending nothing? Bro, you're out here coding with vibes and prayers. Feed me some actual logic: !contrib -A 123 your_code_goes_brrr NotLikeThis",
  
    prependNoId: "Prepending without an ID is like breathing in sand, can't do it can ya? SMOrc",
  
    prependNoCode: "Prepending nothing ha? bold move, Picasso. Toss me some code: !contrib -0 123 // Actually adding something HeyGuys",
  
    replaceNoId: "A change command with zero ID? That's not an operation, that's a cry for help. !contrib -C 123 better_code_goes_here LUL",
  
    replaceNoCode: "Changing with nothing? Bro, already your code's so minimalist it's just a lonely bracket FailFish NotLikeThis help me help you: !contrib -C 123 function(){ // fire }",
  
    deleteNoId: "Dude tryna rm -rf twitch! WutFace chill GoldPLZ try: !contrib -D contrib_id but i bet you forgot the id NotLikeThis use !contrib -ls",

    statusNoId: "Status check, no ID? You're nerding out big time!!, F5-ing a 404 page in your heart PewPewPew. look: !contrib -status 123 SeemsGood",
  
    grepNoFile: "Stop it! HeyGuys You're over-grepping JinxLUL. Seriously, try narrowing it down: !contrib -grep index.js",

    lineNoNumber: "No number for line? Bro, I'm not guessing your code's horoscope. Gimme digits: !contrib file.js -l 42 console.log('facts') 4Head PogChamp",
  
    lineNoCode: "You picked a line but sent no code. That's just a vibe. !contrib file.js -l 42 console.log('answer') PogChamp"
  };
  

  matches(message: string): boolean {
    // Only match commands with flags but missing required arguments
    
    // Check if it's one of the known commands with missing arguments
    if (
      message.match(/!contrib\s+-A$/i) ||                // Append missing ID and code
      message.match(/!contrib\s+-A\s+\d+$/i) ||          // Append with ID but missing code
      message.match(/!contrib\s+-0$/i) ||                // Prepend missing ID and code
      message.match(/!contrib\s+-0\s+\d+$/i) ||          // Prepend with ID but missing code
      message.match(/!contrib\s+-C$/i) ||                // Replace missing ID and code
      message.match(/!contrib\s+-C\s+\d+$/i) ||          // Replace with ID but missing code
      message.match(/!contrib\s+-D$/i) ||                // Delete missing ID
      message.match(/!contrib\s+-status$/i) ||           // Status missing ID
      message.match(/!contrib\s+-grep$/i) ||             // Grep missing filename
      message.match(/!contrib\s+-l$/i) ||                // Line option missing number
      message.match(/!contrib\s+-l\s+\d+$/i)             // Line with number but missing code
    ) {
      return true;
    }
    
    return false;
  }

  async execute(context: CommandContext): Promise<boolean> {
    const { channel, username, message, client } = context;
    
    // Get message style from settings with proper error handling
    let messages = this.seriousStuff; // Default to serious messages
    
    try {
      const settings = await db.getSettings();
      // Only switch to HUH mode if setting explicitly exists and is true
      if (settings && settings.useHuhMode === true) {
        messages = this.HUH;
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Continue with default messages
    }
    
    if (message.match(/!contrib\s+-A$/i)) {
      await client.say(channel, `@${username} ${messages.appendNoId}`);
    } 
    else if (message.match(/!contrib\s+-A\s+\d+$/i)) {
      await client.say(channel, `@${username} ${messages.appendNoCode}`);
    } 
    else if (message.match(/!contrib\s+-0$/i)) {
      await client.say(channel, `@${username} ${messages.prependNoId}`);
    } 
    else if (message.match(/!contrib\s+-0\s+\d+$/i)) {
      await client.say(channel, `@${username} ${messages.prependNoCode}`);
    } 
    else if (message.match(/!contrib\s+-C$/i)) {
      await client.say(channel, `@${username} ${messages.replaceNoId}`);
    } 
    else if (message.match(/!contrib\s+-C\s+\d+$/i)) {
      await client.say(channel, `@${username} ${messages.replaceNoCode}`);
    } 
    else if (message.match(/!contrib\s+-D$/i)) {
      await client.say(channel, `@${username} ${messages.deleteNoId}`);
    } 
    else if (message.match(/!contrib\s+-status$/i)) {
      await client.say(channel, `@${username} ${messages.statusNoId}`);
    } 
    else if (message.match(/!contrib\s+-grep$/i)) {
      await client.say(channel, `@${username} ${messages.grepNoFile}`);
    }
    else if (message.match(/!contrib\s+-l$/i)) {
      await client.say(channel, `@${username} ${messages.lineNoNumber}`);
    }
    else if (message.match(/!contrib\s+-l\s+\d+$/i)) {
      await client.say(channel, `@${username} ${messages.lineNoCode}`);
    }
    
    return true;
  }
} 