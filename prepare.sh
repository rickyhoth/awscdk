#!/bin/bash

node -v 
npm -v

rm -rf lib/provisioning/config/
cp prepare/env/env.txt .
cp -a prepare/config/ lib/provisioning/config/
