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
import * as hamaguri from "./shell/hamaguri.js";
import * as sazae from "./shell/sazae.js";
import * as asari from "./shell/asari.js";
import * as hotate from "./shell/hotate.js";
import * as shako from "./shell/shako.js";
import * as mussel from "./shell/mussel.js";
import * as oyster from "./shell/oyster.js";
import * as akoya from "./shell/akoya.js";
import * as geoduck from "./shell/geoduck.js";
import * as awabi from "./shell/awabi.js";
import * as horagai from "./shell/horagai.js";
import * as takaragai from "./shell/takaragai.js";
import * as conch from "./shell/conch.js";
import * as imogai from "./shell/imogai.js";
import * as nautilus from "./shell/nautilus.js";
import * as orca from "./giants/orca.js";
import * as tuna from "./giants/tuna.js";
import * as blueWhale from "./giants/blue-whale.js";
import * as humpback from "./giants/humpback.js";
import * as spermWhale from "./giants/sperm-whale.js";
import * as narwhal from "./giants/narwhal.js";
import * as whaleShark from "./giants/whale-shark.js";
import * as greatWhite from "./giants/great-white.js";
import * as hammerhead from "./giants/hammerhead.js";
import * as manta from "./giants/manta.js";
import * as mola from "./giants/mola.js";
import * as sailfish from "./giants/sailfish.js";
import * as oarfish from "./giants/oarfish.js";
import * as coelacanth from "./giants/coelacanth.js";
import * as arapaima from "./giants/arapaima.js";

export const categories = [
  { id: "shrimp", name: "Shrimp", ja: "エビ", blurb: "Reef cleaners, snappers, dancers and the ones on your plate, from every ocean." },
  { id: "nudibranch", name: "Nudibranch", ja: "ウミウシ", blurb: "Sea slugs in every color they can find, from tide pools to the open sea." },
  { id: "shell", name: "Shellfish", ja: "貝", blurb: "Clams, scallops, oysters, snails and a nautilus: the ones that carry their house." },
  { id: "giants", name: "Whales & big fish", ja: "鯨・大型魚", blurb: "Whales, sharks, tunas, rays and the biggest bony fish: the ones you measure in metres." },
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
  "shell/hamaguri": hamaguri,
  "shell/asari": asari,
  "shell/hotate": hotate,
  "shell/shako": shako,
  "shell/mussel": mussel,
  "shell/oyster": oyster,
  "shell/akoya": akoya,
  "shell/geoduck": geoduck,
  "shell/sazae": sazae,
  "shell/awabi": awabi,
  "shell/horagai": horagai,
  "shell/takaragai": takaragai,
  "shell/conch": conch,
  "shell/imogai": imogai,
  "shell/nautilus": nautilus,
  "giants/blue-whale": blueWhale,
  "giants/humpback": humpback,
  "giants/sperm-whale": spermWhale,
  "giants/orca": orca,
  "giants/narwhal": narwhal,
  "giants/whale-shark": whaleShark,
  "giants/great-white": greatWhite,
  "giants/hammerhead": hammerhead,
  "giants/manta": manta,
  "giants/mola": mola,
  "giants/tuna": tuna,
  "giants/sailfish": sailfish,
  "giants/oarfish": oarfish,
  "giants/coelacanth": coelacanth,
  "giants/arapaima": arapaima,
};
