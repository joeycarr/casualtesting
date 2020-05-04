#!/usr/bin/env bash

function endsubprocs() {
    kill 0
}
trap endsubprocs EXIT

python3 -m http.server 8080 &

browse http://localhost:8080 &

wait
