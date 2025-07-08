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
  product: z.string().describe('The name of the product being updated, e.g., "Gemini" or "VS Code".'),
  subcomponent: z.string().optional().describe('The specific part of the product being updated, e.g., "Code Assist" or "IntelliJ".'),
  title: z.string().describe('The main title of the release note.'),
  pubDate: z.string().describe('The publication date of the release note in ISO 8601 format (YYYY-MM-DD).'),
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
  prompt: 'You are an expert at parsing HTML release notes to create a bulleted summary.\n' +
    'Your task is to extract the product name, sub-component (if any), title, publication date, and a summary of the changes.\n\n' +
    'Instructions:\n' +
    '1. **Product**: Identify the main product from the content (e.g., "Gemini", "VS Code").\n' +
    '2. **Sub-component**: Identify the sub-component if specified (e.g., "Code Assist", "IntelliJ").\n' +
    '3. **Title**: Extract the primary title of the release note.\n' +
    '4. **Publication Date**: Find the publication date and format it as YYYY-MM-DD.\n' +
    "5. **Summary**: Find the `<h2>What's Changed</h2>` heading, then find the `<ul>` list that immediately follows it. Extract the full text content of each `<li>` item within that list.\n\n" +
    "Example Input HTML:\n" +
    "<h1>Gemini Code Assist for IntelliJ: Release on 2024-07-15</h1>\n" +
    "<h2>What's Changed</h2>\n" +
    "<ul>\n" +
    "  <li>Feature: This is a new feature.</li>\n" +
    "  <li>Fixed: A bug was fixed.</li>\n" +
    "  <li>Docs: Updated documentation.</li>\n" +
    "</ul>\n" +
    "<h3>Other Section</h3>\n" +
    "<p>Some other content.</p>\n\n" +
    "Example Output JSON:\n" +
    "{\n" +
    '  "product": "Gemini",\n' +
    '  "subcomponent": "IntelliJ",\n' +
    '  "title": "Gemini Code Assist for IntelliJ: Release on 2024-07-15",\n' +
    '  "pubDate": "2024-07-15",\n' +
    '  "summary": [\n' +
    '    "Feature: This is a new feature.",\n' +
    '    "Fixed: A bug was fixed.",\n' +
    '    "Docs: Updated documentation."\n' +
    "  ]\n" +
    "}\n\n" +
    "HTML Content to process:\n" +
    "{{{htmlContent}}}\n",
});

const summarizeReleaseNoteFlow = ai.defineFlow(
  {
    name: 'summarizeReleaseNoteFlow',
    inputSchema: SummarizeReleaseNoteInputSchema,
    outputSchema: SummarizeReleaseNoteOutputSchema,
  },
  async (input): Promise<SummarizeReleaseNoteOutput> => {
    const strippedText = input.htmlContent.replace(/<[^>]*>?/gm, '').trim();
    // If content is very short or doesn't seem to contain HTML, just return it as is.
    if (strippedText.length < 50) {
      return {
        product: 'Unknown',
        title: 'Summary unavailable',
        pubDate: new Date().toISOString().split('T')[0],
        summary: [strippedText]
      };
    }

    try {
      const { output } = await prompt(input, {model: 'googleai/gemini-2.0-flash'});
      // Ensure output and summary are valid before returning
      if (output) {
        return {
          product: output.product || 'Unknown',
          subcomponent: output.subcomponent,
          title: output.title || 'Title unavailable',
          pubDate: output.pubDate || new Date().toISOString().split('T')[0],
          summary: output.summary && output.summary.length > 0 ? output.summary : [strippedText],
        };
      }
    } catch (e) {
      console.error("Error calling summarize prompt, falling back to stripped text.", e);
    }

    // Fallback to a simple summary if the prompt fails or returns empty/invalid data
    const fallbackSummary = strippedText.length > 250 ? strippedText.substring(0, 250) + '...' : strippedText;
    return {
      product: 'Unknown',
      title: 'Summary unavailable',
      pubDate: new Date().toISOString().split('T')[0], // Today's date
      summary: [fallbackSummary],
    };
  }
);
