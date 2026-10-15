import type { Check, CheckResult, Evidence } from '../types';
import { makeResult } from './_shared';
import { fetchPage } from './_page';

const META = {
  id: 'bot-ua-differential',
  category: 'bot-access' as const,
  title: 'AI-bot vs browser UA differential',
  spec: { url: 'https://developers.cloudflare.com/bots/concepts/bot/verified-bots/', asOf: '2026-10-13' },
};

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
const BOT_UAS = ['GPTBot/1.0 (+https://openai.com/gptbot)', 'ClaudeBot/1.0 (+claudebot@anthropic.com)'];
/** A Markdown version shorter than this is too thin to stand in for the page. */
const MIN_MARKDOWN_CHARS = 200;

/** The bot got a real Markdown version of an HTML page: smaller by nature, so not a degraded response. */
function isMarkdownVersion(contentType: string, body: string): boolean {
  return /^text\/(markdown|plain)/i.test(contentType)
    && body.trim().length >= MIN_MARKDOWN_CHARS
    && !/^\s*<(!doctype|html)/i.test(body);
}

const botUaDifferential: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const url = target.contentUrl.toString();
    const browser = await fetchPage(http, url, { 'User-Agent': BROWSER_UA });
    const evidence: Evidence = { ...browser.evidence };
    if (browser.status !== 200) {
      return makeResult(META, 'warn', `Browser UA got HTTP ${browser.status} — cannot compare agent treatment`, evidence);
    }

    const blocked: string[] = [];
    const degraded: string[] = [];
    const markdown: string[] = [];
    for (const ua of BOT_UAS) {
      const bot = await fetchPage(http, url, { 'User-Agent': ua });
      const name = ua.split('/')[0];
      if (bot.status === 401 || bot.status === 403 || bot.status === 429) {
        blocked.push(`${name} → HTTP ${bot.status}`);
      } else if (bot.status !== 200) {
        degraded.push(`${name} → HTTP ${bot.status}`);
      } else if (/html/i.test(browser.contentType) && isMarkdownVersion(bot.contentType, bot.bodyText)) {
        markdown.push(`${name} (${(bot.bodyText.length / 1024).toFixed(1)} KB)`);
      } else if (browser.bodyText.length > 0 && bot.bodyText.length / browser.bodyText.length < 0.5) {
        degraded.push(`${name} → 200 but ${Math.round((bot.bodyText.length / browser.bodyText.length) * 100)}% of browser body size`);
      }
    }

    if (blocked.length) {
      return makeResult(META, 'fail', `Agents blocked while browsers pass: ${blocked.join(', ')}`, evidence);
    }
    if (degraded.length) {
      return makeResult(META, 'warn', `Agent UAs get degraded responses: ${degraded.join(', ')}`, evidence);
    }
    if (markdown.length) {
      return makeResult(META, 'pass', `AI bots get a Markdown version instead of HTML: ${markdown.join(', ')}; browsers get HTML. Not blocked or degraded`, evidence);
    }
    return makeResult(META, 'pass', 'GPTBot and ClaudeBot receive the same 200 response as a browser UA', evidence);
  },
};

export default botUaDifferential;
