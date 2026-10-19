/** Sequential: each collector extends and stamps the same corpus. */
import { execFileSync } from 'node:child_process';

for (const entry of [1, 10001, 50001, 60001, 70001, 80001, 90001]) {
  execFileSync(process.execPath, [
    '--experimental-strip-types', 'scripts/collect_remaining_localization.mjs', String(entry),
  ], { stdio: 'inherit' });
}
