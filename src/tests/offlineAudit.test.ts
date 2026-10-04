import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function getAllSourceFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllSourceFiles(fullPath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      // Exclude tests and type files
      if (!fullPath.includes('src/tests/') && !fullPath.includes('src\\tests\\')) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

describe('Zero-Network Offline Audit (Section 10 Acceptance Test #1)', () => {
  it('confirms no external API endpoints or fetch calls exist in source code', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const sourceFiles = getAllSourceFiles(srcDir);

    expect(sourceFiles.length).toBeGreaterThan(5);

    const violations: { file: string; match: string }[] = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');

      // Check for fetch calls
      if (/\bfetch\s*\(/.test(content)) {
        violations.push({ file, match: 'fetch()' });
      }

      // Check for external http/https calls (allow XML namespaces and schema strings)
      const urlMatches = content.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (urlMatches) {
        for (const url of urlMatches) {
          // Allow internal documentation comments or W3C XML schemas
          if (
            !url.includes('w3.org') &&
            !url.includes('github.com') &&
            !url.includes('capacitorjs.com')
          ) {
            violations.push({ file, match: url });
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
