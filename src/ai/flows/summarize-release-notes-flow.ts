'use server';
/**
 * @fileOverview A flow to summarize release note content.
 *
 * - summarizeReleaseNote - A function that takes HTML content and returns a list of key points.
 * - SummarizeReleaseNoteInput - The input type for the summarizeReleaseNote function.
 * - SummarizeReleaseNoteOutput - The return type for the summarizeReleaseNote function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeReleaseNoteInputSchema = z.object({
  htmlContent: z.string().describe('The HTML content of a single release note item.'),
});
export type SummarizeReleaseNoteInput = z.infer<typeof SummarizeReleaseNoteInputSchema>;

const SummarizeReleaseNoteOutputSchema = z.object({
  summary: z.array(z.string()).describe('A list of key points from the release note.'),
});
export type SummarizeReleaseNoteOutput = z.infer<typeof SummarizeReleaseNoteOutputSchema>;

export async function summarizeReleaseNote(input: SummarizeReleaseNoteInput): Promise<SummarizeReleaseNoteOutput> {
  return summarizeReleaseNoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeReleaseNotePrompt',
  input: {schema: SummarizeReleaseNoteInputSchema},
  output: {schema: SummarizeReleaseNoteOutputSchema},
  prompt: `You are an expert at parsing HTML release notes to create a bulleted summary.
From the provided HTML content, find every \`<h3>\` tag.
For each \`<h3>\` tag you find:
1. Get the text inside the \`<h3>\` tag (like "Feature" or "Fixed").
2. Get the text from ONLY the first \`<p>\` tag that comes immediately after the \`<h3>\`. Ignore any images or subsequent paragraphs.
3. Create a summary string in the format: "[UPPERCASE_HEADING] Text_from_the_paragraph."
Collect all these summary strings into a list.

Example Input HTML:
<h3>Feature</h3>
<p>This is the new feature description.</p>
<p>This is extra marketing text that should be ignored.</p>
<h3>Fixed</h3>
<p>A bug was fixed.</p>

Example Output JSON:
{
  "summary": [
    "[FEATURE] This is the new feature description.",
    "[FIXED] A bug was fixed."
  ]
}

HTML Content to process:
{{{htmlContent}}}
`,
});

const summarizeReleaseNoteFlow = ai.defineFlow(
  {
    name: 'summarizeReleaseNoteFlow',
    inputSchema: SummarizeReleaseNoteInputSchema,
    outputSchema: SummarizeReleaseNoteOutputSchema,
  },
  async input => {
    // If content is very short or doesn't seem to contain HTML, just return it as is.
    const strippedText = input.htmlContent.replace(/<[^>]*>?/gm, '').trim();
    if (strippedText.length < 50) {
        return { summary: [strippedText] };
    }
    
    const {output} = await prompt(input);
    return output!;
  }
);
