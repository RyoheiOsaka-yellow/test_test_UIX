// Every species, by id. Add a file and list it here; the gallery and tools read this.
import * as harlequin from "./shrimp/harlequin.js";
import * as cleaner from "./shrimp/cleaner.js";
import * as bandedCoral from "./shrimp/banded-coral.js";
import * as sexy from "./shrimp/sexy.js";
import * as pistol from "./shrimp/pistol.js";
import * as emperor from "./shrimp/emperor.js";
import * as glass from "./shrimp/glass.js";
import * as kuruma from "./shrimp/kuruma.js";
import * as amaebi from "./shrimp/amaebi.js";
import * as sakura from "./shrimp/sakura.js";
import * as cherry from "./shrimp/cherry.js";
import * as crystalRed from "./shrimp/crystal-red.js";
import * as amano from "./shrimp/amano.js";
import * as anna from "./nudibranch/anna.js";
import * as festiva from "./nudibranch/festiva.js";
import * as felimare from "./nudibranch/felimare.js";
import * as nembrotha from "./nudibranch/nembrotha.js";
import * as pikachu from "./nudibranch/pikachu.js";
import * as seaBunny from "./nudibranch/sea-bunny.js";
import * as spanishDancer from "./nudibranch/spanish-dancer.js";
import * as phyllidia from "./nudibranch/phyllidia.js";
import * as spanishShawl from "./nudibranch/spanish-shawl.js";
import * as sakuraeolis from "./nudibranch/sakuraeolis.js";
import * as leafSheep from "./nudibranch/leaf-sheep.js";
import * as blueDragon from "./nudibranch/blue-dragon.js";

export const categories = [
  { id: "shrimp", name: "Shrimp", ja: "エビ", blurb: "Reef cleaners, snappers, dancers and the ones on your plate, from every ocean." },
  { id: "nudibranch", name: "Nudibranch", ja: "ウミウシ", blurb: "Sea slugs in every color they can find, from tide pools to the open sea." },
];
export const species = {
  "shrimp/harlequin": harlequin,
  "shrimp/cleaner": cleaner,
  "shrimp/banded-coral": bandedCoral,
  "shrimp/sexy": sexy,
  "shrimp/pistol": pistol,
  "shrimp/emperor": emperor,
  "shrimp/glass": glass,
  "shrimp/kuruma": kuruma,
  "shrimp/amaebi": amaebi,
  "shrimp/sakura": sakura,
  "shrimp/cherry": cherry,
  "shrimp/crystal-red": crystalRed,
  "shrimp/amano": amano,
  "nudibranch/anna": anna,
  "nudibranch/festiva": festiva,
  "nudibranch/felimare": felimare,
  "nudibranch/nembrotha": nembrotha,
  "nudibranch/pikachu": pikachu,
  "nudibranch/sea-bunny": seaBunny,
  "nudibranch/spanish-dancer": spanishDancer,
  "nudibranch/phyllidia": phyllidia,
  "nudibranch/spanish-shawl": spanishShawl,
  "nudibranch/sakuraeolis": sakuraeolis,
  "nudibranch/leaf-sheep": leafSheep,
  "nudibranch/blue-dragon": blueDragon,
};
