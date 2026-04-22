  #!/bin/bash
  # build.sh chrome  OR  build.sh firefox
  TARGET=$1
  mkdir -p dist
  cp manifest.$TARGET.json manifest.json
  zip -r dist/argos-in-stock-filter-$TARGET.zip . -x "*.git*" "manifest.*.json" "build.sh" "dist/*"