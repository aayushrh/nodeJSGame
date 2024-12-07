const express = require('express');
const app = express();

const { readFile } = require('fs');

const http = require('http');
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server);

app.use(express.static('public'));

const { Engine, Bodies, Body, Composite, Vector, Collision} = require('matter-js');


app.get('/', (request, response) => {

    readFile('./public/index.html', 'utf8', (err, html) => {

        if (err) {
            response.status(500).send('Goddamit');
        }
        response.send(html);
    });

});

var gameServers = []
var currentId = 0
class GameServer {
    constructor(id, firstPlayer, firstPlayerName, firstPlayerColor, currentMap) {
        this.id = id;
        this.players = [new StoredPlayer(firstPlayer, firstPlayerName, firstPlayerColor)];
        this.map = currentMap;
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.mapBodies = [];
        this.alivePlayers = {};
        this.mapRotation = 0;
    }

    isFull() {
        return this.players.length >= 4;
    }

    isPlayable() {
        return this.players.length > 1;
    }

    numPlayersAlive() {
        var len = 0
        for (const id in this.alivePlayers) {
            len += 1
        }
        return len
    }

    disconnect(socketID){
        let index = -1;
        for(let i = 0; i < this.players.length; i++){
            if(this.players[i].socketID == socketID){
                index = i;
            }
        }
        if(index != -1){
            delete this.alivePlayers[this.players[index].socketID]
            this.players.splice(index, 1);
        }

        if(this.players.length <= 0){
            gameServers.splice(gameServers.indexOf(this), 1);
        }
    }

    kill(player){
        Composite.remove(this.engine.world, player.body);
        delete this.alivePlayers[player.socketID]
    }

    addPlayer(socketID, name, color){
        this.players.push(new StoredPlayer(socketID, name, color));
    }

    playerWin() {
        let index = -1;
        if (this.numPlayersAlive() == 1) {
            var socketID = 0;
            for (const id in this.alivePlayers) {
                socketID = id;
            }
            for (let i = 0; i < this.players.length; i++) {
                if (this.players[i].socketID == socketID) {
                    index = i;
                }
            }
            if (index != -1) {
                this.players[index].points += 1;
            }
        }
    }

    respawn(){
        for(const id in this.alivePlayers){
            Composite.remove(this.engine.world, this.alivePlayers[id].body);
        }
        this.alivePlayers = {};
        this.map.reset();
        for(let i = 0; i < this.players.length; i++){
            const spawnPoint = this.map.takeSpawn()
            if(spawnPoint != null){
                const player = new Player(this.players[i].socketID, spawnPoint.x, spawnPoint.y, this.map.playerRad, this.players[i].name, this.players[i].color);
                player.addToWorld(this.engine);
                this.alivePlayers[player.socketID] = player;
            }
        }
    }

    jumpPlayer(id){
        if(this.alivePlayers[id] != null){
            Body.applyForce(this.alivePlayers[id].body, this.alivePlayers[id].body.position, Vector.create(0, -0.05))
        }
    }

    setPlayerAccX(ax, id){
        if(this.alivePlayers[id] != null){
            this.alivePlayers[id].ax = ax;
        }
    }

    setPlayerAccY(ay, id){
        if(this.alivePlayers[id] != null){
            this.alivePlayers[id].ay = ay;
        }
    }

    playerHeavy(val, id){
        if(this.alivePlayers[id] != null){
            if (val) {
                Body.setMass(this.alivePlayers[id].body, 6)
                this.alivePlayers[id].heavy = true;
            } else {
                Body.setMass(this.alivePlayers[id].body, 2)
                this.alivePlayers[id].heavy = false;
            }
        }
    }

    getPlayerOnGround(id){
        if(this.alivePlayers[id] != null){
            return this.alivePlayers[id].onGround;
        }
    }
} 

class StoredPlayer {
    constructor(socketID, name, color) {
        this.socketID = socketID;
        this.name = name;
        this.color = color;
        this.points = 0;
    }
}

class Player {
    constructor(socketID, x, y, rad, name, color) {
        this.socketID = socketID;
        this.body = Bodies.circle(x, y, rad, {label: "Player", friction: 0, frictionAir: 0, mass:2, restitution: 0});
        this.ax = 0;
        this.ay = 0;
        this.rad = rad;
        this.onGround = false;
        this.heavy = false;
        this.name = name;
        this.color = color
    }

    addToWorld(engine) {
        Composite.add(engine.world, this.body);
    }
}

class Rectangle {
    constructor(x, y, width, height, rot = 0, bounce=0, color="white"){
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.rot = rot;
        this.bounce = bounce;
        this.color = color;
        this.type = "r";
    }
}

class Circle {
    constructor(x, y, rad, bounce=0, color="white"){
        this.x = x;
        this.y = y;
        this.rad = rad;
        this.bounce = bounce;
        this.color = color;
        this.type = "c";
    }
}

class Map {
    constructor(spawnPoints, shapes, playerRad){
        this.spawnPoints = spawnPoints;
        this.spawnPointsLeft = null;
        this.shapes = shapes;
        this.playerRad = playerRad;
    }

    reset(){
        this.spawnPointsLeft = JSON.parse(JSON.stringify(this.spawnPoints))
    }

    takeSpawn(){
        if(this.spawnPointsLeft.length > 0){
            const ind = getRandomInt(this.spawnPointsLeft.length)
            const spawnPoint = this.spawnPointsLeft[ind];
            this.spawnPointsLeft.splice(ind, 1);
            return spawnPoint;
        }else{
            return null;
        }
    }
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

//1728x1080
const maps = []
var shapes = [
    new Rectangle(0, 1030, 1628, 50),
    new Rectangle(200, 200, 100, 100),
    new Rectangle(-50, 50, 100, 100, rot=45),
    new Rectangle(500, 1010, 100, 80, rot=0, bounce=1),
    new Circle(1000, 1000, 100, bounce=1, color="red")
]
var spawns = [
    Vector.create(20, 900),
    Vector.create(1000, 200),
]
maps[0] = new Map(spawns, shapes, 20);
const shapes2 = [
    new Rectangle(0, 1030, 1728, 50, 0, 0, color="blue"),
    new Rectangle(200, 200, 100, 100, 0, 0, color="blue"),
    new Rectangle(500, 1010, 100, 80, 0, 0, color="blue")
]
const spawns2 = [
    Vector.create(0, 0),
    Vector.create(1000, 200),
]
maps[1] = new Map(spawns2, shapes2, 20);

const shapes3 = [
    new Rectangle(53, 308, 300, 878, 0, 0, color="#646464"),
    new Rectangle(53, 277, 300, 31, 0, 0, color="#00a8ff"),
    new Rectangle(679, 602, 370, 518, 0, 0, color="#646464"),
    new Rectangle(1375, 308, 300, 878, 0, 0, color="#646464"),
    new Rectangle(1375, 277, 300, 31, 0, 0, color="#00a8ff"),
    new Circle(516, 920, 51, bounce=1, color="#afffaf"),
    new Circle(1212, 920, 51, bounce=1, color="#afffaf")
]
const spawns3 = [
    Vector.create(203, 120),
    Vector.create(864, 495),
    Vector.create(1525, 120),
    Vector.create(516, 120),
    Vector.create(1212, 120)
]

maps[2] = new Map(spawns3, shapes3, 30);

function compilePlayers(p){
    var nplayers = {};
    for(const id in p){
        nplayers[id] = {
            x: p[id].body.position.x,
            y: p[id].body.position.y,
            rad: p[id].rad,
            heavy: p[id].heavy,
            name: p[id].name,
            color: p[id].color
        }
    }
    return(nplayers);
}

function compileMap(map){
    var nmap = [];
    for(let i = 0; i < map.shapes.length; i++){
        const shape = map.shapes[i]
        nmap.push({
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            rad: shape.rad,
            rot: shape.rot,
            color: shape.color,
            type: shape.type
        });
    }
    return(nmap);
}

function compilePlayerScores(players) {
    var nplayers = [];
    for (let i = 0; i < players.length; i++) {
        nplayers.push({
            name: players[i].name,
            score: players[i].points
        });
    }
    return (nplayers);
}

function addMap(map, engine, mapBodies){
    for(let i = 0; i < mapBodies.length; i++){
        Composite.remove(engine.world, mapBodies[i]);
    }
    mapBodies = [];
    for(let i = 0; i < map.shapes.length; i++){
        const shape = map.shapes[i]
        if(shape.type == "r"){
            var body = Bodies.rectangle(shape.x + shape.width/2, shape.y + shape.height/2, shape.width, shape.height, {isStatic: true, label:"Ground", friction: 0})
            Body.rotate(body, shape.rot);
            Composite.add(engine.world, body);
            mapBodies.push(body);
        }else if (shape.type == "c"){
            var body = Bodies.circle(shape.x, shape.y, shape.rad, {isStatic: true, label:"Ground", friction: 0})
            Composite.add(engine.world, body);
            mapBodies.push(body);
        }
    }
    return mapBodies;
}

function connectPlayer(socket, serverPutIn){
    socket.on('disconnect', (reason) => {
        console.log("user disconnected")
        serverPutIn.disconnect(socket.id);
        io.sockets.in(serverPutIn.id).emit('updatePlayer', compilePlayers(serverPutIn.alivePlayers))
    })

    socket.on('UpPressed', (val, repeat) => {
        if(serverPutIn.getPlayerOnGround(socket.id)){
            serverPutIn.jumpPlayer(socket.id)
        }
        if (!repeat) {
            if (val) {
                serverPutIn.setPlayerAccY(-0.25, socket.id);
            } else {
                serverPutIn.setPlayerAccY(0, socket.id);
            }
        }
    })
    socket.on('DownPressed', (val, repeat) => {
        if (!repeat) {
            if (val) {
                serverPutIn.setPlayerAccY(0.25, socket.id);
            } else {
                serverPutIn.setPlayerAccY(0, socket.id);
            }
        }
    })
    socket.on('LeftPressed', (val, repeat) => {
        if (!repeat) {
            if (val) {
                serverPutIn.setPlayerAccX(-0.25, socket.id);
            } else {
                serverPutIn.setPlayerAccX(0, socket.id);
            }
        }
    })
    socket.on('RightPressed', (val, repeat) => {
        if (!repeat) {
            if (val) {
                serverPutIn.setPlayerAccX(0.25, socket.id);
            } else {
                serverPutIn.setPlayerAccX(0, socket.id);
            }
        }
    })
    socket.on('ShiftPressed', (val, repeat) => {
        if (!repeat) {
            serverPutIn.playerHeavy(val, socket.id);
        }
    })
}

io.on('connection', (socket) => {
    console.log("A new user has connected");

    socket.on('connectPlayer', (name, color) => {
        var putIn = false;
        var serverPutIn = null;
        for (let i = 0; i < gameServers.length; i++) {
            if (!gameServers[i].isFull()) {
                putIn = true;
                gameServers[i].addPlayer(socket.id, name, color);
                serverPutIn = gameServers[i];
            }
        }
        if (!putIn) {
            serverPutIn = new GameServer(currentId, socket.id, name, color, maps[0])
            serverPutIn.mapBodies = addMap(serverPutIn.map, serverPutIn.engine, serverPutIn.mapBodies);
            serverPutIn.respawn();
            gameServers.push(serverPutIn);
            currentId += 1;
        }
        socket.join(serverPutIn.id);
        io.sockets.in(serverPutIn.id).emit('updatePlayers', compilePlayers(serverPutIn.alivePlayers));
        io.sockets.in(serverPutIn.id).emit('updateMap', compileMap(serverPutIn.map))
        io.sockets.in(serverPutIn.id).emit('updatePoints', compilePlayerScores(serverPutIn.players))
        connectPlayer(socket, serverPutIn);
    })
})

server.listen(3000, () => console.log("Server now availible on http://localhost:3000"));

setInterval(() => {
    for (let i = 0; i < gameServers.length; i++) {
        for (const id in gameServers[i].alivePlayers) {
            const player = gameServers[i].alivePlayers[id];
            Body.applyForce(player.body, player.body.position, Vector.create(player.ax / 200.0, player.ay / 200.0));
            player.onGround = false;
            for (let j = 0; j < gameServers[i].mapBodies.length; j++) {
                const coll = Collision.collides(player.body, gameServers[i].mapBodies[j]);
                if (coll != null) {
                    if (coll.normal.y > 0.1) {
                        player.onGround = true;
                    }
                    if (gameServers[i].map.shapes[j].bounce > 0) {
                        const mag = Vector.magnitude(Body.getVelocity(player.body))
                        //Body.setSpeed(player.body, 0);
                        console.log(mag);
                        //Body.applyForce(player.body, player.body.position, Vector.create(1, -1))
                        //Body.applyForce(player.body, player.body.position, Vector.mult(coll.normal, -gameServers[i].map.shapes[j].bounce * 0.05 * mag));
                        Body.setVelocity(player.body, Vector.mult(coll.normal, -gameServers[i].map.shapes[j].bounce * 2 * Math.max(mag, 1)));
                        Body.setVelocity(player.body, Vector.mult(coll.normal, -gameServers[i].map.shapes[j].bounce * 2 * Math.max(mag, 1)));
                        Body.setVelocity(player.body, Vector.mult(coll.normal, -gameServers[i].map.shapes[j].bounce * 2 * Math.max(mag, 1)));
                    }
                }
            }

            if(player.body.position.y > 1080){
                gameServers[i].kill(player);
            }
        }

        if(gameServers[i].isPlayable()){
            if(gameServers[i].numPlayersAlive() <= 1){
                gameServers[i].mapRotation = (gameServers[i].mapRotation + 1) % maps.length;
                gameServers[i].mapBodies = addMap(maps[gameServers[i].mapRotation], gameServers[i].engine, gameServers[i].mapBodies)
                gameServers[i].map = maps[gameServers[i].mapRotation]
                gameServers[i].playerWin();
                gameServers[i].respawn();
                io.sockets.in(gameServers[i].id).emit('updateMap', compileMap(gameServers[i].map))
                io.sockets.in(gameServers[i].id).emit('updatePoints', compilePlayerScores(gameServers[i].players))
            }
        }else{
            if(gameServers[i].numPlayersAlive() <= 0){
                gameServers[i].mapRotation = (gameServers[i].mapRotation + 1) % maps.length;
                gameServers[i].mapBodies = addMap(maps[gameServers[i].mapRotation], gameServers[i].engine, gameServers[i].mapBodies)
                gameServers[i].map = maps[gameServers[i].mapRotation]
                gameServers[i].respawn();
                io.sockets.in(gameServers[i].id).emit('updatePoints', compilePlayerScores(gameServers[i].players))
                io.sockets.in(gameServers[i].id).emit('updateMap', compileMap(gameServers[i].map))
            }
        }

        Engine.update(gameServers[i].engine, 15, 1)
    }
}, 15)

setInterval(()=> {
    for (let i = 0; i < gameServers.length; i++) {
        io.sockets.in(gameServers[i].id).emit('updatePlayers', compilePlayers(gameServers[i].alivePlayers))
    }
}, 30)
