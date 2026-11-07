#!/usr/bin/env bash
# Assemble product studios from the shared core. Usage: ./build.sh
set -e
cd "$(dirname "$0")"
build(){ cat 1_head.html 2_body.html 3_common.js "$1" 4a_core.js 4b_panels.js 4c_ui.js | sed "s#<title>VolaTrap Assembly Studio</title>#<title>$3</title>#" > "$2"; echo "built $2"; }
build 3_volatrap.js   ../volatrap-studio/index.html   "VolaTrap Assembly Studio"
buildwc(){ cat 1_head.html 2_body.html 3_common.js 3_wheelchair_cadmodel.js 3_wheelchair.js 4a_core.js 4b_panels.js 4c_ui.js | sed "s#<title>VolaTrap Assembly Studio</title>#<title>Wheelchair Assembly Studio</title>#" > ../wheelchair-studio/index.html; echo "built ../wheelchair-studio/index.html (CAD + ライブ統合)"; }
buildwc
