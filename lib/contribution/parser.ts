export interface Contribution {
  filename: string;
  lineNumber: number | null;
  code: string;
}

export function parseContribution(message: string): Contribution | null {
  // Remove the "!contrib" command and trim whitespace
  const cleanMessage = message.replace(/!contrib/g, '').trim();
  
  // Split by whitespace to process arguments
  const parts = cleanMessage.split(/\s+/);
  if (parts.length < 2) return null; // Need at least filename and code
  
  const filename = parts[0];
  let lineNumber = null;
  let codeStartIndex = 1;

  // Look for -l flag followed by a number
  for (let i = 1; i < parts.length - 1; i++) {
    if (parts[i] === '-l') {
      // Line number is the next part
      lineNumber = parseInt(parts[i + 1]);
      if (isNaN(lineNumber) || lineNumber <= 0) {
        // Invalid line number - return null to trigger error message
        return null;
      }
      // If valid line number, code starts after line number
      codeStartIndex = i + 2;
      break;
    }
  }

  // Join the remaining parts as code
  let code = parts.slice(codeStartIndex).join(' ');
  code = code.replace(/\\n/g, '\n');
  
  return { filename, lineNumber, code };
} 