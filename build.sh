  #!/bin/bash
  # build.sh chrome  OR  build.sh firefox
  TARGET=$1

  if [ -z "$TARGET" ]; then
    echo "Usage: ./build.sh [chrome|firefox]"
    exit 1
  fi

  if [ "$TARGET" != "chrome" ] && [ "$TARGET" != "firefox" ]; then
    echo "Target must be 'chrome' or 'firefox'"
    exit 1
  fi

  mkdir -p dist
  cp manifest.$TARGET.json manifest.json
  zip -r dist/argos-in-stock-filter-$TARGET.zip . -x "*.git*" "manifest.*.json" "build.sh" "dist/*"