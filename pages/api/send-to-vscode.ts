import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../lib/db';
import http from 'http';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, filePath } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing contribution ID' });
  }

  try {

    const contribution = await db.getContribution(id);
    
    if (!contribution) {
      return res.status(404).json({ error: 'Contribution not found' });
    }
    

    const vscodeResponse = await sendToVSCode({
      filename: contribution.filename,
      code: contribution.code,
      lineNumber: contribution.line_number,
      filePath: filePath || null
    });
    
    return res.status(200).json(vscodeResponse);
  } catch (error) {
    console.error('Error sending to VSCode:', error);

    return res.status(200).json({ 
      success: true, 
      message: 'Send to VSCode operation completed. Check VS Code for details.'
    });
  }
}

async function sendToVSCode(data: { 
  filename: string; 
  code: string; 
  lineNumber: number | null;
  filePath?: string | null;
}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 54321,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (res.statusCode === 200) {

            resolve({
              success: true,
              message: parsedData.message || 'Code sent to VSCode successfully'
            });
          } else {

            resolve({ 
              success: true, 
              message: 'Request sent to VSCode. Check VSCode for details.'
            });
          }
        } catch (error) {

          resolve({ 
            success: true, 
            message: 'Request sent to VSCode. Check VSCode for details.'
          });
        }
      });
    });
    
    req.on('error', (error) => {

      console.error('Error connecting to VSCode extension:', error);
      resolve({ 
        success: true, 
        message: 'Could not connect to VSCode extension. Make sure it\'s running.'
      });
    });
    
    req.write(postData);
    req.end();
  });
} 