import { resolveAny } from 'node:dns/promises';
import type { Check, CheckResult, Evidence } from '../types';
import { makeResult } from './_shared';

const META = {
  id: 'dns-aid',
  category: 'discoverability' as const,
  title: 'DNS for AI Discovery (DNS-AID draft)',
  spec: { url: 'https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/', asOf: '2026-08-04' },
};

const dnsAid: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,

  async run(target): Promise<CheckResult> {
    const name = `_index._agents.${target.origin.hostname}`;
    const evidence: Evidence = {
      request: { method: 'DNS SVCB/HTTPS', url: name },
      note: 'Experimental draft check. The runtime resolver does not expose the DNSSEC AD bit, so DNSSEC validation is reported as unavailable.',
    };
    if (target.isLocal) return makeResult(META, 'skip', 'DNS-AID is not applicable to local/private targets', evidence);
    try {
      const records = await resolveAny(name);
      const serviceRecords = (records as Array<{ type: string }>).filter((record) => record.type === 'SVCB' || record.type === 'HTTPS');
      if (serviceRecords.length === 0) return makeResult(META, 'warn', `No SVCB/HTTPS records at ${name}`, evidence);
      evidence.note += ` Found ${serviceRecords.length} service record(s).`;
      return makeResult(META, 'pass', `${serviceRecords.length} DNS-AID index record(s) at ${name}; DNSSEC unknown`, evidence);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : 'lookup error';
      return makeResult(META, 'warn', `No DNS-AID index at ${name} (${code}); DNSSEC unknown`, evidence);
    }
  },
};

export default dnsAid;
