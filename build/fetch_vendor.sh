#!/usr/bin/env bash
# Downloads the pinned third-party libraries into .vendor/ (needs Node/npm). Run once before build.py.
set -euo pipefail
cd "$(dirname "$0")/.."
T=$(mktemp -d); V=.vendor
mkdir -p $V/jspdf $V/mathjax $V/mathlive/fonts $V/sortable $V/pdfjs $V/ocr/lang
get(){ (cd "$T" && npm pack "$1" --silent >/dev/null && mkdir -p "x-$2" && tar xzf "$(ls -t *.tgz | head -1)" -C "x-$2"); }
get jspdf@4.2.1 jspdf;                cp $T/x-jspdf/package/dist/jspdf.umd.min.js $V/jspdf/
get mathjax@3.2.2 mathjax;         cp $T/x-mathjax/package/es5/tex-svg-full.js $V/mathjax/
get mathlive@0.111.4 mathlive;     cp $T/x-mathlive/package/mathlive.min.js $T/x-mathlive/package/mathlive-fonts.css $V/mathlive/; cp $T/x-mathlive/package/fonts/* $V/mathlive/fonts/
get sortablejs@1.15.7 sortable;        cp $T/x-sortable/package/Sortable.min.js $V/sortable/
mkdir -p $V/smiles; get smiles-drawer@2.4.1 smiles; cp $T/x-smiles/package/dist/smiles-drawer.min.js $V/smiles/
get pdfjs-dist@3.11.174 pdfjs;     cp $T/x-pdfjs/package/build/pdf.min.js $T/x-pdfjs/package/build/pdf.worker.min.js $V/pdfjs/
get tesseract.js@7.0.0 tess;          cp $T/x-tess/package/dist/tesseract.min.js $T/x-tess/package/dist/worker.min.js $V/ocr/
get tesseract.js-core@7.0.0 tcore;    cp $T/x-tcore/package/tesseract-core-simd-lstm.wasm.js $V/ocr/
get @tesseract.js-data/eng@1.0.0 eng; cp $T/x-eng/package/4.0.0_best_int/eng.traineddata.gz $V/ocr/lang/
# reading-friendly fonts for the student computer version (latin, regular + bold)
mkdir -p $V/sfonts
get @fontsource/opendyslexic@5.3.0 odys; cp $T/x-odys/package/files/opendyslexic-latin-400-normal.woff2 $T/x-odys/package/files/opendyslexic-latin-700-normal.woff2 $V/sfonts/
get @fontsource/atkinson-hyperlegible@5.3.0 atk; cp $T/x-atk/package/files/atkinson-hyperlegible-latin-400-normal.woff2 $T/x-atk/package/files/atkinson-hyperlegible-latin-700-normal.woff2 $V/sfonts/
rm -rf "$T"; echo "vendor ready in $V"
