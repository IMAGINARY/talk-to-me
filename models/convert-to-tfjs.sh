#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"

LANGUAGE=$1
KERAS_MODEL="$LANGUAGE.h5"

if [ ! -f "$KERAS_MODEL" ]; then
  echo "Model file $KERAS_MODEL not found."
  exit -1
fi

mkdir -p "$LANGUAGE"
tensorflowjs_converter --input_format=keras "$KERAS_MODEL" "$LANGUAGE"
