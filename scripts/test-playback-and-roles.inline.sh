set -e
BASE="http://localhost:26814"
A=$(node -e "const j=JSON.parse(require('fs').readFileSync('.bot-test-accounts.json','utf8'));process.stdout.write(j.password)")
echo "admin $A"
