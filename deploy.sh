#!/bin/bash
set -e

IMAGE="sogestsson/purch_sys_demo:latest"
SSH_USER="siggi"
SSH_HOST="100.108.73.62"
SSH_PASS="Superman"
CONTAINER="purch-sys"

echo "==> 1. Byggi Docker image…"
docker build -t "$IMAGE" .

echo "==> 2. Pushi á Docker Hub…"
docker push "$IMAGE"

echo "==> 3–6. Uppfæri container á Raspberry Pi…"

REMOTE_CMD="
  echo '--- Pull nýtt image ---' &&
  docker pull $IMAGE &&
  echo '--- Stoppa gamla container ---' &&
  (docker stop $CONTAINER || true) &&
  (docker rm $CONTAINER || true) &&
  echo '--- Keyra nýjan container ---' &&
  docker run -d --name $CONTAINER --restart unless-stopped -p 8080:80 $IMAGE &&
  echo '--- Staða ---' &&
  docker ps --filter name=$CONTAINER
"

if command -v sshpass &> /dev/null; then
  sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$REMOTE_CMD"
else
  expect -c "
    spawn ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST \"$REMOTE_CMD\"
    expect \"password:\"
    send \"$SSH_PASS\r\"
    expect eof
  "
fi

echo "==> Lokið! App er aðgengilegt á http://$SSH_HOST:8080"
