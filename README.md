# worship-support

## web

api · uwi · MySQL, in docker.

##### to run
- VS Code: `Dev Containers: Reopen in Container`

##### to stop
```sh
sh script/develop/docker-compose-down.sh
```

| service | address |
|---|---|
| api | `localhost:28300` |
| uwi | `localhost:28301` |
| MySQL | `localhost:23306` (test `23307`) |

## native

uni, on mac. scan the QR with Expo Go.

##### to run
```sh
sh script/develop/expo-start.sh
```

##### to stop
```sh
sh script/develop/expo-stop.sh
```
