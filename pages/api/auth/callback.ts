import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, scope, error } = req.query;
  
  if (error) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>Authorization Failed</h1>
          <p>Error: ${error}</p>
          <script>window.close();</script>
        </body>
      </html>
    `);
  }
  
  if (!code) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>Missing Authorization Code</h1>
          <script>window.close();</script>
        </body>
      </html>
    `);
  }
  
  // Send code to our API endpoint and redirect to homepage
  return res.status(200).send(`
    <html>
      <body>
        <h1>Authorization Successful!</h1>
        <p>Redirecting you to the homepage...</p>
        <script>
          fetch('/api/auth/twitch?code=${code}')
            .then(response => response.json())
            .then(data => {
              console.log(data);
              if (window.opener && !window.opener.closed) {
                window.opener.location.href = '/';
                setTimeout(() => window.close(), 1000);
              } else {
                window.location.href = '/';
              }
            })
            .catch(error => {
              console.error('Authentication error:', error);
              document.body.innerHTML += '<p style="color:red">Error during authentication. Please try again.</p>';
            });
        </script>
      </body>
    </html>
  `);
} 