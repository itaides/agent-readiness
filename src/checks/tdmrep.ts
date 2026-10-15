import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';
import { fetchContentPage } from './_page';

const META = {
  id: 'tdmrep',
  category: 'bot-access' as const,
  title: 'TDMRep / ai.txt policy signal',
  spec: { url: 'https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240510/', asOf: '2026-10-13' },
};

const tdmrep: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const found: string[] = [];

    try {
      const page = await fetchContentPage(target, http);
      const tdmHeader = page.headers.get('tdm-reservation');
      if (tdmHeader) found.push(`TDM-Reservation: ${tdmHeader}`);
      if (/<meta[^>]*name\s*=\s*["']tdm-reservation["']/i.test(page.bodyText)) found.push('<meta tdm-reservation>');
    } catch { /* best-effort */ }

    const wkUrl = new URL('/.well-known/tdmrep.json', target.origin).toString();
    const wkRes = await http.fetch(wkUrl);
    const wkEvidence: Evidence = {
      request: { method: 'GET', url: wkUrl },
      response: { status: wkRes.status, contentType: wkRes.contentType, bytes: wkRes.body.length },
    };
    if (wkRes.status === 200 && /json/i.test(wkRes.contentType)) {
      found.push('/.well-known/tdmrep.json');
    }

    const aiUrl = new URL('/ai.txt', target.origin).toString();
    const aiRes = await http.fetch(aiUrl);
    if (aiRes.status === 200 && decodeBody(aiRes.body).trim().length > 0 && /text\/plain/i.test(aiRes.contentType)) {
      found.push('/ai.txt');
    }

    if (found.length) return makeResult(META, 'pass', `TDM policy signals: ${found.join(', ')}`, wkEvidence);
    return makeResult(META, 'warn', 'No TDMRep or ai.txt policy signal — purpose-based AI control absent', wkEvidence);
  },
};

export default tdmrep;
