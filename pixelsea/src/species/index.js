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
import * as kombu from "./seaweed/kombu.js";
import * as wakame from "./seaweed/wakame.js";
import * as hijiki from "./seaweed/hijiki.js";
import * as hondawara from "./seaweed/hondawara.js";
import * as aosa from "./seaweed/aosa.js";
import * as tengusa from "./seaweed/tengusa.js";
import * as giantKelp from "./seaweed/giant-kelp.js";
import * as nori from "./seaweed/nori.js";
import * as umibudo from "./seaweed/umibudo.js";
import * as kajime from "./seaweed/kajime.js";
import * as miru from "./seaweed/miru.js";
import * as tableCoral from "./coral/table.js";
import * as staghorn from "./coral/staghorn.js";
import * as porites from "./coral/porites.js";
import * as favia from "./coral/favia.js";
import * as hammer from "./coral/hammer.js";
import * as dendronephthya from "./coral/dendronephthya.js";
import * as seaFan from "./coral/sea-fan.js";
import * as isobana from "./coral/isobana.js";
import * as organPipe from "./coral/organ-pipe.js";
import * as redCoral from "./coral/red-coral.js";
import * as leather from "./coral/leather.js";
import * as goniopora from "./coral/goniopora.js";
import * as fungia from "./coral/fungia.js";
import * as aori from "./cephalopod/aori.js";
import * as madako from "./cephalopod/madako.js";
import * as surume from "./cephalopod/surume.js";
import * as hotaru from "./cephalopod/hotaru.js";
import * as daiou from "./cephalopod/daiou.js";
import * as kouika from "./cephalopod/kouika.js";
import * as hanaika from "./cephalopod/hanaika.js";
import * as mimiika from "./cephalopod/mimiika.js";
import * as humboldt from "./cephalopod/humboldt.js";
import * as mizudako from "./cephalopod/mizudako.js";
import * as hyoumon from "./cephalopod/hyoumon.js";
import * as mimic from "./cephalopod/mimic.js";
import * as mendako from "./cephalopod/mendako.js";
import * as kaidako from "./cephalopod/kaidako.js";
import * as koumoridako from "./cephalopod/koumoridako.js";
import * as mizukurage from "./jelly/mizukurage.js";
import * as gazami from "./crab/gazami.js";
import * as honyadokari from "./crab/honyadokari.js";
import * as akakurage from "./jelly/akakurage.js";
import * as echizen from "./jelly/echizen.js";
import * as katsuonoeboshi from "./jelly/katsuonoeboshi.js";
import * as andon from "./jelly/andon.js";
import * as benikurage from "./jelly/benikurage.js";
import * as takokurage from "./jelly/takokurage.js";
import * as sakasakurage from "./jelly/sakasakurage.js";
import * as owankurage from "./jelly/owankurage.js";
import * as hanagasa from "./jelly/hanagasa.js";
import * as lionsmane from "./jelly/lionsmane.js";
import * as urikurage from "./jelly/urikurage.js";
import * as takaashi from "./crab/takaashi.js";
import * as zuwai from "./crab/zuwai.js";
import * as taraba from "./crab/taraba.js";
import * as kegani from "./crab/kegani.js";
import * as shiomaneki from "./crab/shiomaneki.js";
import * as isogani from "./crab/isogani.js";
import * as kinchaku from "./crab/kinchaku.js";
import * as mokuzu from "./crab/mokuzu.js";
import * as yashigani from "./crab/yashigani.js";
import * as okayadokari from "./crab/okayadokari.js";
import * as yubiwa from "./crab/yubiwa.js";
import * as chouchin from "./deepsea/chouchin.js";
import * as demenigisu from "./deepsea/demenigisu.js";
import * as mitsukuri from "./deepsea/mitsukuri.js";
import * as rabuka from "./deepsea/rabuka.js";
import * as houraieso from "./deepsea/houraieso.js";
import * as onikinme from "./deepsea/onikinme.js";
import * as fukurounagi from "./deepsea/fukurounagi.js";
import * as hadakaiwashi from "./deepsea/hadakaiwashi.js";
import * as yokoeso from "./deepsea/yokoeso.js";
import * as sokodara from "./deepsea/sokodara.js";
import * as kusauo from "./deepsea/kusauo.js";
import * as blobfish from "./deepsea/blobfish.js";
import * as mizuuo from "./deepsea/mizuuo.js";
import * as hoshieso from "./deepsea/hoshieso.js";

export const categories = [
  { id: "shrimp", name: "Shrimp", ja: "エビ", blurb: "Reef cleaners, snappers, dancers and the ones on your plate, from every ocean." },
  { id: "nudibranch", name: "Nudibranch", ja: "ウミウシ", blurb: "Sea slugs in every color they can find, from tide pools to the open sea." },
  { id: "shell", name: "Shellfish", ja: "貝", blurb: "Clams, scallops, oysters, snails and a nautilus: the ones that carry their house." },
  { id: "giants", name: "Whales & big fish", ja: "鯨・大型魚", blurb: "Whales, sharks, tunas, rays and the biggest bony fish: the ones you measure in metres." },
  { id: "seaweed", name: "Seaweed", ja: "海藻", blurb: "Kelp forests, nori and sea grapes: the weeds that sway, feed and shelter the rest." },
  { id: "coral", name: "Coral", ja: "サンゴ", blurb: "Tables, antlers, boulders, fans and flowers: the animals that build the reef." },
  { id: "cephalopod", name: "Squid & octopus", ja: "イカ・タコ", blurb: "Jet-propelled, colour-shifting and far too clever: squids, cuttlefish and octopuses." },
  { id: "jelly", name: "Jellyfish", ja: "クラゲ", blurb: "Bells that pulse and trail: moon jellies, sea nettles, box jellies and the ones that glow." },
  { id: "crab", name: "Crabs & hermits", ja: "カニ・ヤドカリ", blurb: "Scuttlers in armour, from tide-pool hermits to the giant spider crab." },
  { id: "deepsea", name: "Deep-sea fish", ja: "深海魚", blurb: "Lanterns, fangs and see-through heads: the fish of the dark below a thousand metres." },
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
  "seaweed/kombu": kombu,
  "seaweed/wakame": wakame,
  "seaweed/hijiki": hijiki,
  "seaweed/hondawara": hondawara,
  "seaweed/aosa": aosa,
  "seaweed/tengusa": tengusa,
  "seaweed/giant-kelp": giantKelp,
  "seaweed/nori": nori,
  "seaweed/umibudo": umibudo,
  "seaweed/kajime": kajime,
  "seaweed/miru": miru,
  "coral/table": tableCoral,
  "coral/staghorn": staghorn,
  "coral/porites": porites,
  "coral/favia": favia,
  "coral/hammer": hammer,
  "coral/dendronephthya": dendronephthya,
  "coral/sea-fan": seaFan,
  "coral/isobana": isobana,
  "coral/organ-pipe": organPipe,
  "coral/red-coral": redCoral,
  "coral/leather": leather,
  "coral/goniopora": goniopora,
  "coral/fungia": fungia,
  "cephalopod/aori": aori,
  "cephalopod/surume": surume,
  "cephalopod/hotaru": hotaru,
  "cephalopod/daiou": daiou,
  "cephalopod/humboldt": humboldt,
  "cephalopod/kouika": kouika,
  "cephalopod/hanaika": hanaika,
  "cephalopod/mimiika": mimiika,
  "cephalopod/madako": madako,
  "cephalopod/mizudako": mizudako,
  "cephalopod/hyoumon": hyoumon,
  "cephalopod/mimic": mimic,
  "cephalopod/mendako": mendako,
  "cephalopod/kaidako": kaidako,
  "cephalopod/koumoridako": koumoridako,
  "jelly/mizukurage": mizukurage,
  "jelly/akakurage": akakurage,
  "jelly/echizen": echizen,
  "jelly/lionsmane": lionsmane,
  "jelly/katsuonoeboshi": katsuonoeboshi,
  "jelly/andon": andon,
  "jelly/benikurage": benikurage,
  "jelly/takokurage": takokurage,
  "jelly/sakasakurage": sakasakurage,
  "jelly/owankurage": owankurage,
  "jelly/hanagasa": hanagasa,
  "jelly/urikurage": urikurage,
  "crab/takaashi": takaashi,
  "crab/zuwai": zuwai,
  "crab/taraba": taraba,
  "crab/kegani": kegani,
  "crab/gazami": gazami,
  "crab/shiomaneki": shiomaneki,
  "crab/isogani": isogani,
  "crab/kinchaku": kinchaku,
  "crab/mokuzu": mokuzu,
  "crab/yashigani": yashigani,
  "crab/honyadokari": honyadokari,
  "crab/okayadokari": okayadokari,
  "crab/yubiwa": yubiwa,
  "deepsea/chouchin": chouchin,
  "deepsea/demenigisu": demenigisu,
  "deepsea/mitsukuri": mitsukuri,
  "deepsea/rabuka": rabuka,
  "deepsea/houraieso": houraieso,
  "deepsea/onikinme": onikinme,
  "deepsea/fukurounagi": fukurounagi,
  "deepsea/hadakaiwashi": hadakaiwashi,
  "deepsea/yokoeso": yokoeso,
  "deepsea/sokodara": sokodara,
  "deepsea/kusauo": kusauo,
  "deepsea/blobfish": blobfish,
  "deepsea/mizuuo": mizuuo,
  "deepsea/hoshieso": hoshieso,
};
