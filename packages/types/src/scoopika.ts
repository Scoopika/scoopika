import { SavedProvider } from "./llms";

export interface ScoopikaClass {
  url: string;
  token: string;

  getUrl(): string;

  loadProvider(name: string): Promise<SavedProvider>;
}
