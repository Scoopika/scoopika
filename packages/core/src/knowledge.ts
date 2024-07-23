import { Scoopika } from "./scoopika";

export class Knowledge {
  scoopika: Scoopika;
  id: string;

  constructor(scoopika: Scoopika, id: string) {
    this.scoopika = scoopika;
    this.id = id;
  }
}
