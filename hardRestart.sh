cd ~/arbitrage-second-try

pwd

git pull


journalctl --rotate && journalctl --vacuum-time=1s

./enableService.sh "simpleArbitrage"
