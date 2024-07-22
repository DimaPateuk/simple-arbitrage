cd ~/simple-arbitrage

pwd

git pull

serviceName=$1

systemctl stop $serviceName

rm /lib/systemd/system/$serviceName.service

cp ./$serviceName.service /lib/systemd/system/$serviceName.service

cat /lib/systemd/system/$serviceName.service

systemctl daemon-reload

systemctl enable $serviceName
echo $serviceName

echo "-------------"
