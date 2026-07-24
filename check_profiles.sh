#!/bin/sh
for d in /data/profiles/*/; do
  name=$(basename "$d")
  has_db="N"
  has_log="N"
  [ -f "$d/state.db" ] && has_db="Y"
  [ -f "$d/sessions.log" ] && has_log="Y"
  echo "$name: db=$has_db log=$has_log"
done
echo "---"
# Check for default profile
echo "default: db=$(test -f /data/profiles/default/state.db && echo Y || echo N)"
# Check for any sessions.log at root
echo "root sessions.log: $(test -f /data/sessions.log && echo Y || echo N)"
echo "root state.db: $(test -f /data/state.db && echo Y || echo N)"
