export default function streamMessages(stream: string) {
  const messages: string[] = [];
  const streamRegex = /<SCOOPSTREAM>(.*?)<\/SCOOPSTREAM>/gs;
  let match: any;

  while ((match = streamRegex.exec(stream)) !== null) {
    messages.push(match[1]);
  }

  return messages;
}
