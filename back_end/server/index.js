require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const harperSaveMessage = require("./services/harper-save-message");
const harperGetMessages = require("./services/harper-get-message");
const leaveRoom = require('./untils/leave-room')
// const leaveRoom = require('./utils/leave-room');

const { Server } = require("socket.io");

app.use(cors()); // add cors middleware

const server = http.createServer(app);
const CHAT_BOT = "ChatBot";

let chatRoom = ""; //E.G. javascript, node,... etc
let allUsers = []; // all users in current chat room

// create io Server and allow for Cors from 'http://localhost:3000' with GET, POST methods
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// listen for the Client connects via socket.io-client
io.on("connection", function (socket) {
  console.log(`User connected ${socket.id}`);

  // add a user to a room
  socket.on("join_room", (data) => {
    const { username, room } = data; // data sent from client when join_room event emitted
    socket.join(room); // join the user to socket room

    let __createdtime__ = Date.now(); // current timestamp
    // sent messages to all users currently in the room, apart from the user that just joined.
    socket.to(room).emit("receive_message", {
      message: `${username} has joined the chat room`,
      username: CHAT_BOT,
      __createdtime__,
    });

    //send wellcome msg to user that just joined chat only
    socket.emit("receive_message", {
      message: `Welcome ${username}`,
      username: CHAT_BOT,
      __createdtime__,
    });

    // save the new user to the room
    chatRoom = room;
    allUsers.push({ id: socket.id, username, room });
    chatRoomUsers = allUsers.filter((user) => user.room === room);
    socket.to(room).emit("chatroom_users", chatRoomUsers);
    socket.emit("chatroom_users", chatRoomUsers);
    // Get last 100 messages sent in the chat room
    harperGetMessages(room)
    .then((last100Messages) => {
      socket.emit('last_100_messages', last100Messages);
    })
    .catch((err) => console.log(err));
  });

  socket.on("send_message", (data) => {
    const { message, username, room, __createdtime__ } = data;
    io.in(room).emit("receive_message", data); // Send to all users in room, including sender
    harperSaveMessage(message, username, room, __createdtime__) // Save message in db
      .then((response) => console.log(response))
      .catch((err) => console.log(err));
  });
  
  socket.on('leave_room', (data) => {
    const { username, room } = data;
    socket.leave(room);
    const __createdtime__ = Date.now();
    // Remove user from memory
    allUsers = leaveRoom(socket.id, allUsers);
    socket.to(room).emit('chatroom_users', allUsers);
    socket.to(room).emit('receive_message', {
      username: CHAT_BOT,
      message: `${username} has left the chat`,
      __createdtime__,
    });
    console.log(`${username} has left the chat`);
  });

  //disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected from the chat');
    const user = allUsers.find((user) => user.id == socket.id);
    if (user?.username) {
      allUsers = leaveRoom(socket.id, allUsers);
      socket.to(chatRoom).emit('chatroom_users', allUsers);
      socket.to(chatRoom).emit('receive_message', {
        message: `${user.username} has disconnected from the chat.`,
      });
    }
  });
});

server.listen(4000, () => "Server is running on port 3000");
