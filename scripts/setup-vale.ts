import { createWriteStream, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { glossaryTerms } from '../src/data/glossary';
import { pipeline } from 'stream/promises';

// Update glossary terms
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT = resolve(ROOT, '.styles/config/ignore/glossary.txt');
const OUTPUT_DIR = dirname(OUTPUT);

if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Collect all terms for the ignore list
const allTerms = new Set<string>();

for (const { term, variants } of glossaryTerms) {
    const allForms = [term, ...(variants ?? [])];

    // Add full phrase variants with pipe syntax
    allTerms.add(allForms.join('|'));

    // For multi-word terms, also add individual word variants
    // This handles Vale's tokenization which splits on spaces
    for (const form of allForms) {
        const words = form.split(' ');
        if (words.length > 1) {
            const lastWord = words[words.length - 1];
            // Add the last word (which might be pluralized/possessivized)
            allTerms.add(lastWord);
            // Also add the base last word without suffixes
            const baseLastWord = term.split(' ').pop() || '';
            if (baseLastWord !== lastWord) {
                allTerms.add(baseLastWord);
            }
        }
    }
}

const lines = [...allTerms].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
);

const content = lines.join('\n') + '\n';
writeFileSync(OUTPUT, content);

console.log(`Wrote ${lines.length} glossary terms to ${OUTPUT}.`);

// If not already present, download dictionary
async function downloadFile(url: string, path: string) {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(
            `Error downloading dictionaries: HTTP error! status: ${response.status}`,
        );

    if (!response.body)
        throw new Error(
            `Error downloading dictionaries: No body in response for ${url}`,
        );
    const fileStream = createWriteStream(path);
    await pipeline(response.body, fileStream);
}

const dictsToDownload = [
    {
        path: resolve(ROOT, '.styles/config/dictionaries/en_US.dic'),
        url: 'https://raw.githubusercontent.com/LibreOffice/dictionaries/refs/tags/libreoffice-26.2.5.1/en/en_US.dic',
    },
    {
        path: resolve(ROOT, '.styles/config/dictionaries/en_US.aff'),
        url: 'https://raw.githubusercontent.com/LibreOffice/dictionaries/refs/tags/libreoffice-26.2.5.1/en/en_US.aff',
    },
];

dictsToDownload.forEach((dict) => {
    if (!existsSync(dict.path)) {
        mkdirSync(dirname(dict.path), { recursive: true });
        downloadFile(dict.url, dict.path);
    }
});
