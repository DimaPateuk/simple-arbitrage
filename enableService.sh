cd ~/arbitrage-second-try

pwd

git pull

folderName=$1
serviceName=$2

systemctl stop $serviceName

rm /lib/systemd/system/$serviceName.service

cp ./src/$folderName/$serviceName.service /lib/systemd/system/$serviceName.service

cat /lib/systemd/system/$serviceName.service

systemctl daemon-reload

systemctl enable $serviceName
# systemctl status $serviceName
#
echo $folderName
echo $serviceName

echo "-------------"
