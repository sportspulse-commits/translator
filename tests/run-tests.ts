import { config } from 'dotenv';
config({ path: '.env.local' });
import cases from './test-cases.json';
import { runPipeline } from '../lib/pipeline';
import * as fs from 'fs';

function fleschKincaidGrade(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(Boolean).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const syllables = countSyllables(text);
  if (sentences === 0 || words === 0) return 0;
  return 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
}

function countSyllables(text: string): number {
  return text.toLowerCase().split(/\s+/)
    .map(w => w.replace(/[^a-z]/g, ''))
    .filter(Boolean)
    .reduce((sum, w) => sum + Math.max(1, (w.match(/[aeiouy]+/g) || []).length), 0);
}

interface TestCase {
  id: string;
  input: string;
  expected_bucket: string;
  must_contain_verbatim?: string[];
  must_not_contain?: string[];
  must_contain_phrases?: string[];
  max_words: number;
  max_reading_level: number;
}

async function main() {
  const results: any[] = [];
  for (const tc of cases as TestCase[]) {
    process.stdout.write(`Running ${tc.id}... `);
    try {
      const out = await runPipeline(tc.input);
      const grade = fleschKincaidGrade(out.finalText);
      const wordCount = out.finalText.split(/\s+/).filter(Boolean).length;

      const checks = {
        bucket_correct: out.bucket === tc.expected_bucket,
        verbatim_preserved: (tc.must_contain_verbatim || [])
          .every(t => out.finalText.includes(t)),
        forbidden_absent: (tc.must_not_contain || [])
          .every(t => !out.finalText.includes(t)),
        required_phrases: (tc.must_contain_phrases || [])
          .every(p => out.finalText.toLowerCase().includes(p.toLowerCase())),
        length_ok: wordCount <= tc.max_words,
        reading_level_ok: grade <= tc.max_reading_level,
      };
      const passed = Object.values(checks).every(Boolean);
      results.push({ id: tc.id, passed, checks, grade: grade.toFixed(2), wordCount, latencyMs: out.latencyMs, output: out.finalText });
      console.log(passed ? '✓' : '✗', !passed ? JSON.stringify(checks) : '');
    } catch (e: any) {
      results.push({ id: tc.id, passed: false, error: e.message });
      console.log('✗ ERROR:', e.message);
    }
  }
  const passRate = results.filter(r => r.passed).length / results.length;
  console.log(`\nPass rate: ${(passRate * 100).toFixed(1)}% (${results.filter(r => r.passed).length}/${results.length})`);
  fs.writeFileSync('tests/last-run.json', JSON.stringify(results, null, 2));
  console.log('Detailed results: tests/last-run.json');
}

main().catch(e => { console.error(e); process.exit(1); });
