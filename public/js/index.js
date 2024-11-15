const canvas = document.querySelector('#gameWindow');
const ctx = canvas.getContext('2d');
var multi = 1.0

canvas.width = innerWidth;
canvas.height = innerHeight;

const inputs = []

var socket = null;

var gameStart = false;
var typing = false;
var nameTyping = "";

frontendPlayers = [];
currentMap = [];

class Player {
    constructor(x, y, color, rad, heavy, name) {
        this.x = x
        this.y = y
        this.color = color
        this.rad = rad
        this.heavy = heavy
        this.name = name
    }

    draw(ctx) {
        ctx.beginPath();
        if(!this.heavy){
            ctx.fillStyle = "grey"
        }
        else{
            ctx.fillStyle = "white"
        }
        ctx.arc(this.x * multi, this.y * multi, (this.rad+3) * multi, 0, 2 * Math.PI);
        ctx.fill()

        ctx.beginPath();
        ctx.fillStyle = this.color
        ctx.arc(this.x * multi, this.y * multi, this.rad * multi, 0, 2 * Math.PI);
        ctx.fill()

        ctx.font = "bold italic " + Math.round(17*multi) + "px Arial";
        ctx.fillStyle = "grey";
        ctx.fillText(this.name, (this.x) * multi - ctx.measureText(this.name).width/2, (this.y+this.rad + 17) * multi);
    }
}

class Button {
    constructor(x, y, width, height, color, strokeColor, text, textColor, whatToDo){
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.strokeColor = strokeColor;
        this.text = text;
        this.textColor = textColor;
        this.whatToDo = whatToDo;
    }

    isPressing(mouseX, mouseY){
        if(mouseX < (this.x + this.width)*multi && mouseX > this.x * multi && mouseY < (this.y + this.height)*multi && mouseY > this.y * multi){
            this.whatToDo();
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = "10";
        ctx.rect(this.x * multi, this.y * multi, this.width * multi, this.height*multi);
        ctx.stroke();
        ctx.fill();
        ctx.font = "bold italic " + Math.round(50*multi) + "px Arial";
        ctx.fillStyle = this.textColor
        ctx.fillText(this.text, (this.x+10) * multi, (this.y+45) * multi);
    }
}

function connect(socket) {
    socket.on('updatePlayers', (players) => {
        for (const id in players) {
            const player = players[id];
            frontendPlayers[id] = new Player(player.x, player.y, player.color, player.rad, player.heavy, player.name)
        }
        for (const id in frontendPlayers) {
            if (!players[id]) {
                delete frontendPlayers[id]
            }
        }
    })

    socket.on('updateMap', (map) => {
        currentMap = map;
    })

    window.addEventListener("keydown", (event) => {
        var keyCode = event.key;
        inputs[keyCode] = false
        switch (keyCode) {
            case 'd': //d
                if(!event.repeat){
                    socket.emit("RightPressed", true, event.repeat)
                }
                break;
            case 's': //s
                if(!event.repeat){
                    socket.emit("DownPressed", true, event.repeat)
                }
                break;
            case 'a': //a
                if(!event.repeat){
                    socket.emit("LeftPressed", true, event.repeat)
                }
                break;
            case 'w': //w
                //if(!event.repeat){
                    socket.emit("UpPressed", true, event.repeat)
                //}
                break;
            case 'Shift': //w
                if(!event.repeat){
                    socket.emit("ShiftPressed", true, event.repeat)
                }
                break;
        }
    })

    window.addEventListener("keyup", (event) => {
        var keyCode = event.key;
        inputs[keyCode] = false
        switch (keyCode) {
            case 'd': //d
                if(!event.repeat){
                    socket.emit("RightPressed", false, event.repeat)
                }
                break;
            case 's': //s
                if(!event.repeat){
                    socket.emit("DownPressed", false, event.repeat)
                }
                break;
            case 'a': //a
                if(!event.repeat){
                    socket.emit("LeftPressed", false, event.repeat)
                }
                break;
            case 'w': //w
                if(!event.repeat){
                    socket.emit("UpPressed", false, event.repeat)
                }
                break;
            case 'Shift': //w
                if(!event.repeat){
                    socket.emit("ShiftPressed", false, event.repeat)
                }
                break;
        }
    })
}

var joined = false;
window.addEventListener("keydown", (event) => {
    var keyCode = event.key;
    inputs[keyCode] = false
    if(!joined){
        if(typing){
            if(keyCode == 'Enter'){
                typing = false;
            }if(keyCode == 'Delete' || keyCode == 'Backspace'){
                nameTyping = nameTyping.slice(0, nameTyping.length - 1)
            }else if (keyCode.length <= 1){
                nameTyping += keyCode;
            }
        }
    }
})

window.addEventListener('click', (event) => {
    if(!gameStart){
        const rect = canvas.getBoundingClientRect()
        var x = event.pageX - rect.left;
        var y = event.pageY - rect.top;
        for(let i = 0; i < buttons.length; i++){
            buttons[i].isPressing(x, y);
        }
    }
})

function drawMapRect(x, y, width, height, rot, color) {
    ctx.translate(x * multi + width * multi / 2, y * multi + height * multi / 2);
    ctx.rotate(rot * Math.PI / 180)
    ctx.translate(-x * multi - width * multi / 2, -y * multi - height * multi / 2);
    ctx.fillStyle = color;
    ctx.fillRect(x * multi, y*multi, width * multi, height * multi);
    ctx.translate(x * multi + width * multi / 2, y * multi + height * multi / 2);
    ctx.rotate(-rot * Math.PI / 180)
    ctx.translate(-x * multi - width * multi / 2, -y * multi - height * multi / 2);
}

function drawMapCircle(x, y, rad, color) {
    ctx.beginPath();
    ctx.arc(x * multi, y * multi, rad * multi, 0, 2 * Math.PI);
    ctx.fillStyle = color
    ctx.fill()
}

//68:d, 83:s, 65:a, 87:w
setInterval(() => {
    if ((innerWidth * 0.8) / 1728 < (innerHeight * 0.8) / 1080) {
        canvas.width = innerWidth * 0.8
        canvas.height = 1080 * ((innerWidth * 0.8) / 1728)
        multi = ((innerWidth * 0.8) / 1728)
    } else {
        canvas.width = 1728 * ((innerHeight * 0.8) / 1080)
        canvas.height = innerHeight * 0.8
        multi = ((innerHeight * 0.8) / 1080)
    }

    if (!gameStart) {
        display(canvas, ctx);
    } else {
        update(canvas, ctx);
    }
}, 15);

var buttons = [
    new Button(1000, 500, 500, 65, 'white', 'black', nameTyping, 'black', () => {
        typing = true;
    }),
    new Button(20, 20, 400, 50, 'blue', 'cyan', "Quick Play", 'cyan', () => {
        gameStart = true;
        socket = io();
        if(nameTyping == ""){
            socket.emit("connectPlayer", "New Player", currentColor)
        }
        else{
            socket.emit("connectPlayer", nameTyping, currentColor)
        }
        connect(socket);
    }),
    new Button(900, 200, 100, 100, 'white', 'black', "<", 'black', () => {
        let ind = (colors.indexOf(currentColor)-1);
        let nind = 0;
        if(ind < 0){
            nind = colors.length + ind;
        }else{
            nind = ind;
        }
        currentColor = colors[nind]
    }),
    new Button(1500, 200, 100, 100, 'white', 'black', ">", 'black', () => {
        currentColor = colors[(colors.indexOf(currentColor)+1) % colors.length]
    }),
]

currentColor = "blue"

colors = [
    "blue",
    "white",
    "red",
    "cyan",
    "purple",
    "pink"
]

function display(canvas, ctx) {
    ctx.fillStyle = 'grey';
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for(let i = 0; i < buttons.length; i++){
        buttons[i].draw(ctx);
    }
    ctx.beginPath()
    ctx.fillStyle = currentColor;
    ctx.arc(1250 * multi, 250*multi, 200*multi, 0, 2*Math.PI);
    ctx.fill()
    buttons[0].text = nameTyping;
    /*ctx.font = "bold italic " + Math.round(50*multi) + "px Arial";
    ctx.fillStyle = "grey"
    ctx.fillText(nameTyping, 1210 * multi, Math.round(65*multi));*/
}

function update(canvas, ctx) {
    //68:d, 83:s, 65:a, 87:w
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < currentMap.length; i++) {
        if(currentMap[i].type == "r"){
            drawMapRect(currentMap[i].x, currentMap[i].y, currentMap[i].width, currentMap[i].height, currentMap[i].rot, currentMap[i].color);
        }else if (currentMap[i].type == "c"){
            drawMapCircle(currentMap[i].x, currentMap[i].y, currentMap[i].rad, currentMap[i].color);
        }
    }
    for (const id in frontendPlayers) {
        const p = frontendPlayers[id];
        p.draw(ctx)
    }
}
