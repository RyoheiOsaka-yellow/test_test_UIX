import sys
from fontTools.ttLib import TTFont, newTable
from fontTools.subset import Subsetter, Options
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
src, dst = sys.argv[1], sys.argv[2]
def _jis(cp):
    try: chr(cp).encode('shift_jis'); return True
    except Exception: return False
f = TTFont(src)
# 文字集合: ASCII/Latin-1, 記号, かな, JIS X 0208 全漢字(第1・第2水準) + 全角英数 + 罫線/矢印/単位記号
cps = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100)) | set(range(0x2000, 0x2070)) | set(range(0x2100, 0x2200)) | set(range(0x2200, 0x2300)) | set(range(0x2460, 0x2500)) | set(range(0x2500, 0x2600)) | set(range(0x25A0, 0x2700)) | set(range(0x3000, 0x3100)) | set(range(0x30A0, 0x3100)) | set(range(0xFF00, 0xFFF0)) | {cp for cp in range(0x4E00, 0x9FFF) if _jis(cp)} | {0x00D7, 0x00F7, 0x00B2, 0x00B3, 0x03C6, 0x0394, 0x2103, 0x2127}
cmap = f.getBestCmap(); cps = {c for c in cps if c in cmap}
opt = Options(); opt.layout_features = ['*']; opt.notdef_outline = True; opt.name_IDs = ['*']; opt.hinting = False; opt.desubroutinize = True
sub = Subsetter(options=opt); sub.populate(unicodes=cps); sub.subset(f)
# CFF → TrueType（cu2qu で 3 次→2 次ベジエ）
gs = f.getGlyphSet(); order = f.getGlyphOrder(); glyf = newTable('glyf'); glyf.glyphs = {}; glyf.glyphOrder = order
for name in order:
    pen = TTGlyphPen(gs); cpen = Cu2QuPen(pen, 1.0, reverse_direction=True)
    try: gs[name].draw(cpen)
    except Exception: pass
    glyf.glyphs[name] = pen.glyph()
f['glyf'] = glyf; f['loca'] = newTable('loca'); del f['CFF ']
if 'VORG' in f: del f['VORG']
maxp = newTable('maxp'); maxp.tableVersion = 0x00010000; maxp.numGlyphs = len(order); maxp.maxZones = 1; maxp.maxTwilightPoints = 0; maxp.maxStorage = 0; maxp.maxFunctionDefs = 0; maxp.maxInstructionDefs = 0; maxp.maxStackElements = 0; maxp.maxSizeOfInstructions = 0; maxp.maxComponentElements = 0; maxp.maxComponentDepth = 0; maxp.maxPoints = 0; maxp.maxContours = 0; maxp.maxCompositePoints = 0; maxp.maxCompositeContours = 0
f['maxp'] = maxp; f.sfntVersion = '\x00\x01\x00\x00'
f['post'].formatType = 3.0; f['post'].extraNames = []; f['post'].mapping = {}
f['head'].indexToLocFormat = 1
f.save(dst); print('saved', dst, 'glyphs', len(order), 'cps', len(cps))
