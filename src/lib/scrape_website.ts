import axios, { Method } from "axios";
import cheerio from "cheerio";
import TurndownService from "turndown";

interface ScrapeOptions {
  url: string;
  method?: Method;
  headers?: Record<string, string>;
  body?: any;
  selector?: string;
}

export default async function scrapeWebsite(options: ScrapeOptions) {
  const {
    url,
    method = "GET",
    headers = {},
    body,
    selector = "body",
  } = options;

  try {
    const response = await axios.request({
      url,
      method,
      headers,
      data: body,
    });

    const $ = cheerio.load(response.data);
    const content = $(selector).html();

    if (!content) {
      throw new Error("No content found for the specified selector");
    }

    const turndownService = new TurndownService();
    const markdownContent = turndownService.turndown(content);

    return markdownContent;
  } catch (error: any) {
    throw new Error(`Error scraping website: ${error.message}`);
  }
}

scrapeWebsite({
  url: "https://cheerio.js.org/docs/intro",
  method: "get",
}).then((markdown) => {
  console.log(markdown);
});
