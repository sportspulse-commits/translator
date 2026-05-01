import fs from 'fs';
import path from 'path';

function loadPrompt(filename: string): string {
  const p = path.join(process.cwd(), 'prompts', filename);
  return fs.readFileSync(p, 'utf-8');
}

export const CLASSIFIER_OPTIMIZER_PROMPT = loadPrompt('classifier-and-optimizer.md');
