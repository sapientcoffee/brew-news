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
  prompt: `You are an expert at parsing HTML release notes and extracting the key updates.
From the following HTML, extract the main features, fixes, or announcements.
For each point, prepend it with [FEATURE], [FIXED], [ANNOUNCEMENT], or [CHANGED] based on the heading in the HTML.
If there's a main point in a <p> tag right after a <h3> tag, use that.
Focus on the most important, user-facing changes. Omit any extra marketing language.

HTML Content:
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
