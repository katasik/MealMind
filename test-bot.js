// Quick bot diagnostic test
require('dotenv').config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

console.log('Bot Configuration Check:');
console.log('========================');
console.log('Bot Token:', botToken ? `${botToken.slice(0, 10)}...` : 'MISSING');
console.log('Bot Username:', botUsername || 'MISSING');
console.log('');

if (!botToken) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in .env file');
  process.exit(1);
}

console.log('Testing Telegram API connection...');

const https = require('https');

const url = `https://api.telegram.org/bot${botToken}/getMe`;

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);

      if (result.ok) {
        console.log('✓ Bot is valid and reachable!');
        console.log('  Bot ID:', result.result.id);
        console.log('  Bot Name:', result.result.first_name);
        console.log('  Bot Username: @' + result.result.username);
        console.log('');
        console.log('Deep Link:', `https://t.me/${result.result.username}?start=demo`);
      } else {
        console.error('✗ Telegram API Error:', result.description);
      }
    } catch (e) {
      console.error('✗ Failed to parse response:', data);
    }
  });
}).on('error', (err) => {
  console.error('✗ Connection error:', err.message);
});
