// ANGLEX の DSTV NC 書出しを、第三者のパーサー（crates.io の dstv）で読み直す。1 ファイル 1 行の JSON を標準出力へ。
// 使い方: cargo run --release -- <dir>   （dir 内の *.nc1 をすべて読む）
use dstv::prelude::*;
use std::{env, fs};

fn face(f: &PartFace) -> &'static str {
    match f {
        PartFace::Front => "v",
        PartFace::Top => "o",
        PartFace::Bottom => "u",
        PartFace::Behind => "h",
    }
}

fn main() {
    let dir = env::args().nth(1).expect("dir");
    let mut names: Vec<_> = fs::read_dir(&dir).expect("read dir").filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.extension().map(|x| x == "nc1").unwrap_or(false)).collect();
    names.sort();
    for p in names {
        let name = p.file_name().unwrap().to_string_lossy().to_string();
        match Dstv::from_file(&p) {
            Err(e) => println!("{{\"file\":\"{}\",\"error\":\"{:?}\"}}", name, e),
            Ok(mut d) => {
                let mut holes = Vec::new();
                let mut borders = 0;
                for el in &d.elements {
                    match el {
                        DstvElementType::Hole(h) => holes.push(format!("{{\"face\":\"{}\",\"x\":{},\"y\":{},\"d\":{}}}", face(&h.fl_code), h.x_coord, h.y_coord, h.diameter)),
                        DstvElementType::Slot(s) => holes.push(format!("{{\"face\":\"{}\",\"x\":{},\"y\":{},\"d\":{},\"slot\":{},\"angle\":{}}}", face(&s.fl_code), s.x_coord, s.y_coord, s.diameter, s.slot_length, s.angle)),
                        DstvElementType::OuterBorder(_) => borders += 1,
                        _ => {}
                    }
                }
                let h = &d.header;
                let head = format!("\"piece\":\"{}\",\"quality\":\"{}\",\"qty\":{},\"profile\":\"{}\",\"code\":\"{:?}\",\"length\":{},\"height\":{},\"width\":{},\"tf\":{},\"tw\":{},\"kgm\":{}", h.piece_identification, h.steel_quality, h.quantity_of_pieces, h.profile, h.code_profile, h.length, h.profile_height, h.flange_width, h.flange_thickness, h.web_thickness, h.weight_by_meter);
                let svg = d.to_svg();
                println!("{{\"file\":\"{}\",{},\"borders\":{},\"holes\":[{}],\"svg_len\":{}}}", name, head, borders, holes.join(","), svg.len());
            }
        }
    }
}
