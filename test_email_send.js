require('dotenv').config();
const mailer = require('./modules/mailer');

async function test() {
  console.log('--- Email Test Script ---');
  try {
    const result = await mailer.sendWelcomeEmail({
      name: 'Testy Tester',
      email: 'test@example.com' // Resend's onboarding@resend.dev only delivers to yourself anyway
    });
    console.log('Result:', result);
  } catch (err) {
    console.error('Email send failed!');
    console.error(err);
  }
}

test();
