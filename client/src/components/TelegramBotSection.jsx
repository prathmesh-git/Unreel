import { Bot, MessageCircle, ExternalLink } from 'lucide-react';

const TELEGRAM_BOT_URL = 'https://t.me/unreel_analyser_bot';

export default function TelegramBotSection() {
  return (
    <section className="telegram-bot-section" aria-labelledby="telegram-bot-title">
      <div className="telegram-bot-card">
        <div className="telegram-bot-left">
          <span className="telegram-bot-chip">
            <Bot className="icon-sm" />
            New: Telegram Bot
          </span>

          <h2 id="telegram-bot-title" className="section-title telegram-bot-title">
            Analyze Reels and Shorts Directly on Telegram
          </h2>

          <p className="telegram-bot-copy">
            Send your video link in chat and get structured fact-check and bias reports instantly.
            The bot supports public Telegram posts, Instagram Reels, and YouTube Shorts.
          </p>

          <div className="telegram-bot-actions">
            <a
              className="telegram-bot-cta"
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="icon-sm" />
              Open Telegram Bot
              <ExternalLink className="icon-sm" />
            </a>
          </div>
        </div>

        <div className="telegram-bot-right" aria-hidden="true">
          <div className="telegram-preview">
            <p className="preview-label">Quick flow</p>
            <ol>
              <li>Send /start</li>
              <li>Paste one public video link</li>
              <li>Receive your analysis report</li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
