// import axios, { Method } from "axios";
// import { load } from "cheerio";
// import TurndownService from "turndown";
//
// interface ScrapeOptions {
//   url: string;
//   method?: Method;
//   headers?: Record<string, string>;
//   body?: any;
//   selector?: string;
// }
//
// export default async function scrapeWebsite(options: ScrapeOptions) {
//   const { url, method = "GET", headers = {}, body, selector } = options;
//
//   try {
//     const response = await axios.request({
//       url,
//       method,
//       headers,
//       data: body,
//     });
//
//     const $ = load(response.data);
//     $("script").remove();
//     let content = $(selector || "body").html();
//     const content_lower = content?.toLowerCase();
//
//     if (content_lower?.includes("skip to main content")) {
//       const index = content_lower.lastIndexOf("skip to main content");
//       content = content?.substring(index) || content;
//     }
//
//     if (!content) {
//       throw new Error("No content found for the specified selector");
//     }
//
//     const turndownService = new TurndownService();
//     const markdownContent = turndownService.turndown(content);
//
//     return markdownContent;
//   } catch (error: any) {
//     throw new Error(`Error scraping website: ${error.message}`);
//   }
// }
