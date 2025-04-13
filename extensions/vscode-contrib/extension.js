const vscode = require('vscode');
const http = require('http');
const path = require('path');
const fs = require('fs');

let repositoryRootPath = null;

let manualPathOverride = null;

function activate(context) {
  console.log("TRACE: Extension activating");
  const savedRootPath = context.globalState.get('repositoryRootPath');
  if (savedRootPath) {
    repositoryRootPath = vscode.Uri.file(savedRootPath);
    console.log(`TRACE: Loaded saved repository root: ${repositoryRootPath.fsPath}`);
  } else {
    // Auto-detect  folder as repository root when extension activates
    autoSetRepositoryRoot(context);
  }
  
  // Load manual path override from storage
  const savedManualPath = context.globalState.get('manualPathOverride');
  if (savedManualPath) {
    manualPathOverride = savedManualPath;
    console.log(`TRACE: Loaded manual path override: ${manualPathOverride}`);
  }

  // Create a local server to listen for commands
  const server = http.createServer(async (req, res) => {
    console.log(`TRACE: Server received ${req.method} request`);
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
        console.log(`TRACE: Received chunk of data: ${chunk.length} bytes`);
      });
      
      req.on('end', async () => {
        console.log(`TRACE: Request body complete: ${body.substring(0, 100)}...`);
        let result = { success: true, message: 'Request processed' };
        
        try {
          const parsedBody = JSON.parse(body);
          console.log(`TRACE: Parsed request body successfully:`, parsedBody);
          
          const { filename, code, lineNumber, filePath } = parsedBody;
          console.log(`TRACE: Extracted request data: filename=${filename}, lineNumber=${lineNumber}, filePath=${filePath}, code length=${code?.length || 0}`);
          
          // Use manual path override if it exists
          let effectiveRepositoryRoot = null;
          if (manualPathOverride) {
            effectiveRepositoryRoot = { fsPath: manualPathOverride };
            console.log(`TRACE: Using manual path override: ${manualPathOverride}`);
          } else if (repositoryRootPath) {
            effectiveRepositoryRoot = repositoryRootPath;
            console.log(`TRACE: Using saved repository root: ${repositoryRootPath.fsPath}`);
          } else {
            // Auto-detect workspace folder as repository root without prompting
            console.log(`TRACE: Repository root not set, auto-detecting workspace folder`);
            if (autoSetRepositoryRoot(context)) {
              effectiveRepositoryRoot = repositoryRootPath;
            } else {
              // Only prompt if auto-detection fails
              console.log(`TRACE: Auto-detection failed, prompting user`);
              try {
                await selectRepositoryRoot(context);
                effectiveRepositoryRoot = repositoryRootPath;
              } catch (error) {
                console.log(`TRACE: User cancelled repository selection`);
                // We already tried workspace folders in autoSetRepositoryRoot, no fallback here
              }
            }
          }
          
          // Determine the full path to write the file
          const targetFilename = filename || path.basename(filePath || 'unknown.txt');
          let targetPath = '';
          
          if (filePath) {
            // Check if filePath is absolute
            if (path.isAbsolute(filePath)) {
              targetPath = filePath;
              console.log(`TRACE: Using absolute file path: ${targetPath}`);
            } else if (effectiveRepositoryRoot) {
              // Treat filePath as relative to effective repository root
              targetPath = path.join(effectiveRepositoryRoot.fsPath, filePath);
              console.log(`TRACE: Using file path relative to effective repository root: ${targetPath}`);
            } else {
              // If we still don't have a repository root, prompt the user for a save location
              targetPath = await promptForFileLocation(filePath);
              console.log(`TRACE: User selected file location: ${targetPath}`);
            }
          } else if (effectiveRepositoryRoot) {
            // Use effective repository root + filename
            targetPath = path.join(effectiveRepositoryRoot.fsPath, targetFilename);
            console.log(`TRACE: Using filename with effective repository root: ${targetPath}`);
          } else {
            // We couldn't determine a proper path, prompt the user
            targetPath = await promptForFileLocation(targetFilename);
            console.log(`TRACE: User selected file location: ${targetPath}`);
          }
          
          console.log(`TRACE: Final target file path: ${targetPath}`);
          
          // Check if file exists
          const fileExists = fs.existsSync(targetPath);
          console.log(`TRACE: File exists: ${fileExists}`);
          
          // Create directory if needed
          const dirPath = path.dirname(targetPath);
          if (!fs.existsSync(dirPath)) {
            console.log(`TRACE: Creating directory: ${dirPath}`);
            fs.mkdirSync(dirPath, { recursive: true });
          }
          
          let finalContent = '';
          let operation = '';
          
          if (fileExists && lineNumber) {
            // Read existing file content
            const existingContent = fs.readFileSync(targetPath, 'utf8');
            const lines = existingContent.split('\n');
            
            // Insert code at the specified line number
            const actualLineNumber = Math.min(Math.max(1, lineNumber), lines.length + 1);
            console.log(`TRACE: Inserting at line ${actualLineNumber}`);
            
            // Add the new code at the specified line
            lines.splice(actualLineNumber - 1, 0, ...code.split('\n'));
            finalContent = lines.join('\n');
            operation = 'updated (inserted at line ' + actualLineNumber + ')';
          } else if (fileExists) {
            // Append the code to the end of the file
            const existingContent = fs.readFileSync(targetPath, 'utf8');
            finalContent = existingContent + '\n\n' + code;
            operation = 'updated (content appended)';
          } else {
            // Create new file with the provided code
            finalContent = code;
            operation = 'created';
          }
          
          // Write the file
          fs.writeFileSync(targetPath, finalContent);
          console.log(`TRACE: File ${operation}: ${targetPath}`);
          
          // Open the file in the editor
          const document = await vscode.workspace.openTextDocument(targetPath);
          const editor = await vscode.window.showTextDocument(document);
          
          // Position cursor at the insertion point if inserting at a line
          if (fileExists && lineNumber) {
            const position = new vscode.Position(lineNumber - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
              new vscode.Range(position, position),
              vscode.TextEditorRevealType.InCenter
            );
          }
          
          // Set message based on operation
          result.message = `File ${operation}: ${targetPath}`;
          vscode.window.showInformationMessage(result.message);
          
          console.log(`TRACE: Sending success response`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          
        } catch (error) {
          console.error('ERROR: Error in request handler:', error);
          console.error('ERROR: Stack trace:', error.stack);
          
          // Try fallback to untitled document for any unexpected error
          try {
            console.log(`TRACE: Attempting fallback to untitled document`);
            const document = await vscode.workspace.openTextDocument({ 
              language: getLanguageFromFilename(filename || 'unknown.txt'),
              content: code || '// Error occurred, but content was recovered'
            });
            
            await vscode.window.showTextDocument(document);
            console.log(`TRACE: Fallback untitled document shown`);
            
            vscode.window.showWarningMessage(
              `Error writing to file. Content has been recovered in this untitled document.`
            );
          } catch (fallbackError) {
            console.error('ERROR: Fallback also failed:', fallbackError);
            vscode.window.showErrorMessage(`Failed to process your code: ${error.message}`);
          }
          
          // Always return success
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            message: 'Error occurred but returning success anyway' 
          }));
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'Method not allowed but returning success anyway' 
      }));
    }
  });
  
  // Listen on a specific port
  const PORT = 54321;
  server.listen(PORT, () => {
    console.log(`TRACE: TwitchContrib extension server running on port ${PORT}`);
  });
  
  // Register commands
  console.log(`TRACE: Registering extension commands`);
  let testCmd = vscode.commands.registerCommand('twitchcontrib.test', () => {
    console.log(`TRACE: Test command executed`);
    vscode.window.showInformationMessage('TwitchContrib extension is active!');
  });
  
  let selectRootCmd = vscode.commands.registerCommand('twitchcontrib.selectRoot', async () => {
    console.log(`TRACE: Select root command executed`);
    await selectRepositoryRoot(context);
  });
  
  // New command to set manual path override
  let setManualPathCmd = vscode.commands.registerCommand('twitchcontrib.setManualPath', async () => {
    console.log(`TRACE: Set manual path command executed`);
    const inputPath = await vscode.window.showInputBox({
      prompt: 'Enter absolute path to repository root',
      placeHolder: 'C:\\Projects\\MyRepo or /home/user/projects/myrepo',
      value: manualPathOverride || ''
    });
    
    if (inputPath === undefined) {
      console.log(`TRACE: Manual path input cancelled`);
      return;
    }
    
    if (inputPath === '') {
      // Clear the override
      manualPathOverride = null;
      context.globalState.update('manualPathOverride', null);
      console.log(`TRACE: Manual path override cleared`);
      vscode.window.showInformationMessage('Manual path override cleared');
      return;
    }
    
    // Validate the path exists
    if (!fs.existsSync(inputPath)) {
      console.log(`TRACE: Manual path does not exist: ${inputPath}`);
      const createDir = await vscode.window.showWarningMessage(
        `Path does not exist: ${inputPath}. Create it?`, 
        'Yes', 'No'
      );
      
      if (createDir === 'Yes') {
        try {
          fs.mkdirSync(inputPath, { recursive: true });
          console.log(`TRACE: Created directory: ${inputPath}`);
        } catch (error) {
          console.error(`ERROR: Failed to create directory: ${error.message}`);
          vscode.window.showErrorMessage(`Failed to create directory: ${error.message}`);
          return;
        }
      } else {
        return;
      }
    }
    
    // Set the manual path override
    manualPathOverride = inputPath;
    context.globalState.update('manualPathOverride', manualPathOverride);
    console.log(`TRACE: Manual path override set to: ${manualPathOverride}`);
    vscode.window.showInformationMessage(`Manual path override set to: ${manualPathOverride}`);
  });
  
  // Command to show current paths (for debugging)
  let showPathsCmd = vscode.commands.registerCommand('twitchcontrib.showPaths', () => {
    console.log(`TRACE: Show paths command executed`);
    const manualMsg = manualPathOverride ? 
      `Manual path override: ${manualPathOverride}` : 
      'No manual path override set';
    
    const repoMsg = repositoryRootPath ? 
      `Repository root: ${repositoryRootPath.fsPath}` : 
      'No repository root selected';
    
    const effectiveMsg = manualPathOverride ? 
      `Effective path: ${manualPathOverride} (manual override)` : 
      (repositoryRootPath ? 
        `Effective path: ${repositoryRootPath.fsPath} (repository root)` : 
        'No effective path set');
    
    vscode.window.showInformationMessage(`${manualMsg}\n${repoMsg}\n${effectiveMsg}`);
  });
  
  let createFileCmd = vscode.commands.registerCommand('twitchcontrib.createFile', async () => {
    console.log(`TRACE: Create file command executed`);
    const fileName = await vscode.window.showInputBox({
      prompt: 'Enter file name or path',
      placeHolder: 'components/Button.tsx'
    });
    
    console.log(`TRACE: User entered filename: ${fileName}`);
    if (!fileName) {
      console.log(`TRACE: No filename provided, returning`);
      return;
    }
    
    try {
      let targetPath;
      
      // Determine the correct path - use manual override first if available
      if (path.isAbsolute(fileName)) {
        targetPath = fileName;
      } else if (manualPathOverride) {
        targetPath = path.join(manualPathOverride, fileName);
      } else if (repositoryRootPath) {
        targetPath = path.join(repositoryRootPath.fsPath, fileName);
      } else {
        // Prompt for repository root or specific location
        targetPath = await promptForFileLocation(fileName);
      }
      
      // Create directory if needed
      const dirPath = path.dirname(targetPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Create empty file if doesn't exist
      if (!fs.existsSync(targetPath)) {
        fs.writeFileSync(targetPath, '');
      }
      
      // Open in editor
      const document = await vscode.workspace.openTextDocument(targetPath);
      await vscode.window.showTextDocument(document);
      
      console.log(`TRACE: Opened file: ${targetPath}`);
      vscode.window.showInformationMessage(`Opened file: ${targetPath}`);
    } catch (error) {
      console.error('ERROR: Failed to create file:', error);
      vscode.window.showErrorMessage(`Failed to create file: ${error.message}`);
    }
  });
  
  context.subscriptions.push(testCmd, selectRootCmd, setManualPathCmd, showPathsCmd, createFileCmd);
  
  // Clean up when deactivated
  context.subscriptions.push({
    dispose: () => {
      console.log(`TRACE: Extension disposing, closing server`);
      server.close();
    }
  });
  
  console.log(`TRACE: Extension activated successfully`);
}

async function selectRepositoryRoot(context) {
  console.log(`TRACE: Selecting repository root`);
  const options = {
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select Repository Root Folder'
  };
  
  console.log(`TRACE: Showing folder selection dialog`);
  const folderUri = await vscode.window.showOpenDialog(options);
  console.log(`TRACE: Folder selection result:`, folderUri);
  
  if (!folderUri || folderUri.length === 0) {
    console.log(`TRACE: Repository root selection cancelled`);
    throw new Error('Repository root selection cancelled');
  }
  
  repositoryRootPath = folderUri[0];
  console.log(`TRACE: Repository root set to: ${repositoryRootPath.toString()}`);
  
  // Save the repository root path for future sessions
  context.globalState.update('repositoryRootPath', repositoryRootPath.fsPath);
  console.log(`TRACE: Saved repository root path to extension storage`);
  
  vscode.window.showInformationMessage(`Repository root set to: ${repositoryRootPath.fsPath}`);
  return repositoryRootPath;
}

// New helper function to prompt for file location
async function promptForFileLocation(suggestedName) {
  console.log(`TRACE: Prompting for file location: ${suggestedName}`);
  
  // Create a save dialog
  const options = {
    defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
    saveLabel: 'Save',
    filters: {},
    title: 'Select Where to Save File'
  };
  
  // Add the filename to the default URI if provided
  if (suggestedName && options.defaultUri) {
    options.defaultUri = vscode.Uri.file(
      path.join(options.defaultUri.fsPath, suggestedName)
    );
  }
  
  // Show the save dialog
  const fileUri = await vscode.window.showSaveDialog(options);
  
  if (!fileUri) {
    console.log(`TRACE: File location selection cancelled`);
    throw new Error('File location selection cancelled');
  }
  
  console.log(`TRACE: User selected file location: ${fileUri.fsPath}`);
  return fileUri.fsPath;
}

// Helper function to determine language ID from filename
function getLanguageFromFilename(filename) {
  console.log(`TRACE: Getting language for filename: ${filename}`);
  const ext = path.extname(filename).toLowerCase();
  console.log(`TRACE: File extension: ${ext}`);
  
  const langMap = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'javascriptreact',
    '.tsx': 'typescriptreact',
    '.html': 'html',
    '.css': 'css',
    '.json': 'json',
    '.md': 'markdown',
    '.py': 'python',
    '.rb': 'ruby',
    '.go': 'go',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.php': 'php'
  };
  
  const language = langMap[ext] || 'plaintext';
  console.log(`TRACE: Detected language: ${language}`);
  return language;
}

function deactivate() {
  console.log(`TRACE: Extension deactivated`);
}

// Auto-detect and set repository root from workspace folders
function autoSetRepositoryRoot(context) {
  console.log(`TRACE: Auto-detecting repository root`);
  const workspaceFolders = vscode.workspace.workspaceFolders;
  
  if (workspaceFolders && workspaceFolders.length > 0) {
    repositoryRootPath = workspaceFolders[0].uri;
    console.log(`TRACE: Auto-set repository root to workspace folder: ${repositoryRootPath.fsPath}`);
    
    // Save the repository root path for future sessions
    context.globalState.update('repositoryRootPath', repositoryRootPath.fsPath);
    console.log(`TRACE: Saved auto-detected repository root path to extension storage`);
    
    // Optionally show a notification (can be removed if too intrusive)
    vscode.window.showInformationMessage(`Repository root automatically set to: ${repositoryRootPath.fsPath}`);
    return true;
  }
  
  console.log(`TRACE: Could not auto-detect repository root (no workspace folders)`);
  return false;
}

module.exports = {
  activate,
  deactivate,
  // Expose the path variables for external access
  getPathInfo: () => ({
    manualPathOverride,
    repositoryRootPath: repositoryRootPath ? repositoryRootPath.fsPath : null,
    effectivePath: manualPathOverride || (repositoryRootPath ? repositoryRootPath.fsPath : null)
  })
}; 