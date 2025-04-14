export function formatCode(code: string, normalize = false): string {
  if (normalize) {
    // For normalization (used in duplicate detection), strip all whitespace
    return code.toLowerCase().replace(/\s+/g, '').replace(/[\r\n]/g, '');
  }
  
  // For regular formatting, preserve line breaks but normalize indentation
  const lines = code.split('\n');
  
  // Find the minimum indentation level (excluding empty lines)
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    
    const indent = line.length - line.trimStart().length;
    if (indent < minIndent) {
      minIndent = indent;
    }
  }
  
  // Adjust the indentation of all lines
  if (minIndent < Infinity && minIndent > 0) {
    return lines.map(line => {
      if (line.trimStart().length === 0) return '';
      return line.substring(Math.min(minIndent, line.length - line.trimStart().length));
    }).join('\n');
  }
  
  return code;
} 