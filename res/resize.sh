#!/bin/sh
cd `dirname $0`
pwd
cp icon512x512.png ../src/img/icon.png
cp icon512x512.png ../src/img/128.png
cp icon512x512.png ../src/img/48.png
cp icon512x512.png ../src/img/16.png
cp icon512x512-disabled.png ../src/img/icon-disabled.png
cp icon512x512-disabled.png ../src/img/128-disabled.png
cp icon512x512-disabled.png ../src/img/48-disabled.png
cp icon512x512-disabled.png ../src/img/16-disabled.png
pushd ../src/img
sips -Z 128 128.png
sips -Z 48 48.png
sips -Z 16 16.png
sips -Z 128 128-disabled.png
sips -Z 48 48-disabled.png
sips -Z 16 16-disabled.png
popd