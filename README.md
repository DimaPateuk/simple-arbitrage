npm run build && git add . && git commit -m "try to fix service script" && git push my && ssh root@165.22.199.183 './simple-arbitrage/hardRestart.sh simpleArbitragev


ssh root@165.22.199.183 journalctl -u simpleArbitrage.service > log


ssh root@165.22.199.183 './simple-arbitrage/hardRestart.sh simpleArbitrage'