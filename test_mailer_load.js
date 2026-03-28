require('dotenv').config();
try {
  const mailer = require('./modules/mailer');
  console.log('✔ mailer.js loaded successfully');
  const diags = mailer.getMailDiagnostics();
  console.log('Diagnostics:', JSON.stringify(diags, null, 2));
} catch (err) {
  console.error('✘ Failed to load mailer.js:');
  console.error(err);
  process.exit(1);
}
