# Convenience targets for building and packaging the Tashkeel extension.
#
#   make            # build, then package an upload-ready dist.zip
#   make build      # just build dist/ (parcel + assets)
#   make zip        # build, then zip dist/ into dist.zip
#   make test       # unit tests
#   make demo       # regenerate store_assets/demo.{mp4,gif} (needs ffmpeg)
#   make clean      # remove dist/, dist.zip and the parcel cache
#
# `make zip` writes dist.zip with manifest.json at the ROOT of the archive
# (what the Chrome Web Store requires) and no macOS resource-fork cruft.

SHELL := /bin/bash
ZIP := dist.zip

.PHONY: package build zip test demo clean

package: zip

build:
	npm run build

# Always build first so the archive can never lag the source. Zip the CONTENTS
# of dist/ (so manifest.json lands at the archive root), stripping .DS_Store and
# the __MACOSX resource-fork entries that Finder/macOS zip would otherwise add.
zip: build
	rm -f $(ZIP)
	find dist -name .DS_Store -delete
	cd dist && COPYFILE_DISABLE=1 zip -rX ../$(ZIP) . -x '.DS_Store' -x '__MACOSX/*'
	@echo "Wrote $(ZIP) (manifest.json at archive root)"

test:
	npm test

# Rebuild the demo clip and promote it into store_assets/.
demo: build
	node store_assets/src/capture-demo.mjs
	cp store_assets/src/raw/demo.mp4 store_assets/src/raw/demo.gif store_assets/

clean:
	rm -rf dist $(ZIP) .parcel-cache
