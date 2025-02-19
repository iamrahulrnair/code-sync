const express = require('express')
var colors = require('colors');
const http = require('http')
const connectDB = require('./config/db')
const cors = require('cors')
const dotenv = require('dotenv')
var morgan = require('morgan')
const path = require('path')
var nodemailer = require('nodemailer');

const app = express()
dotenv.config('../.env');
const server = http.createServer(app);
const port = process.env.PORT || 8080
app.set('port', port);
// DB Connection    
connectDB()

// Production API LOG

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Middleware
app.use(
  cors({
    credentials: true,
    origin: true,
    // methods: ["GET", "POST", "PUT", "PATCH"]
  })
);
app.use(express.json());
// Controllers
app.get("/", (req, res) => {
  res.send("API IS RUNNING")
})

app.use('/api',require('./routes/pwd.route'))
app.use('/api/room/', require('./routes/room.route'));
app.use('/api/user/', require('./routes/user.route'));

// Socket.io
const { Server, Socket } = require('socket.io');
const { addUser, getUser, getUsersInRoom, removeUser } = require('./socket.user');
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
    // methods: ["GET", "POST","PUT","PATCH"]
  }
});

io.on('connection', (socket) => {
  let CentralRoomId = 0;
  let CentralUserName = "";
  let UserIdForRemove = '';
  socket.on('joinroom', async ({ roomId, userName, userImg }, callback) => {
    // console.log("Join ROom")
    const { error, user } = await addUser({ id: socket.id, name: userName, room: roomId, userImg });
    if (error) return callback(error);
    CentralRoomId = roomId;
    CentralUserName = userName
    UserIdForRemove = socket.id;
    socket.emit('message', { user: "Admin", text: `${userName}, Welcome to room ${roomId}` })
    socket.broadcast.to(roomId).emit('message', { user: "Admin", text: `${userName} has joined room!`, userImg: "zz" });

    socket.join(roomId);

    let users = getUsersInRoom(roomId)
    console.log("users", users)
    io.to(roomId).emit('numberOfUser', users);

    callback();

  });
  socket.on('sendMessage', (message, roomId) => {
    const user = getUser(socket.id);
    io.to(roomId).emit('message', { user: user.name, userImg: user.userImg, text: message })
  })

  socket.on('canvas-data', (data) => {
    // console.log(data, CentralRoomId)
    socket.broadcast.to(CentralRoomId).emit('canvas-data', data);

  })
  socket.on('updateBody', ({ value, roomId }) => {
    socket.broadcast.to(roomId).emit('updateBody', value);
  });
  socket.on('updateInput', ({ value, roomId }) => {
    socket.broadcast.to(roomId).emit('updateInput', value);
  });
  socket.on('updateLanguage', ({ value, roomId }) => {
    // console.log({ value, roomId })
    socket.broadcast.to(roomId).emit('updateLanguage', value);
  });
  socket.on('updateOutput', ({ value, roomId }) => {
    socket.broadcast.to(roomId).emit('updateOutput', value);
  });
  socket.on('updateRichText', ({ value, roomId }) => {
    socket.broadcast.to(roomId).emit('updateRichText', value);
  });

  socket.on('joinAudioRoom', (roomId, userId) => {
    // console.log({ roomId, userId });
    socket.broadcast.to(roomId).emit('userJoinedAudio', userId);

    socket.on('leaveAudioRoom', () => {
      socket.broadcast.to(roomId).emit('userLeftAudio', userId);
    });
  });
  socket.on('disconnect', ({ userName }) => {
    const user = removeUser(UserIdForRemove)
    let users = getUsersInRoom(CentralRoomId)
    console.log("users", users)
    io.to(CentralRoomId).emit('numberOfUser', users);
    // console.log("User disconnect", user);
  })
});



var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.OUR_EMAIL,
    pass: process.env.EMAIL_PASS
  },
  from : "codesync.live"
});



app.post('/sendMail', (req, res) => {
  const { sendTo ,mailSubject , roomLink , userName ,userEmail} = req.body
  console.log(req.body)
  var mailOptions = {
    from: process.env.OUR_EMAIL,
    to: sendTo,
    cc: "codedeeper.work@gmail.com",
    subject: mailSubject,
    html: `<p>Hello Dear, ${userName} is invite you on CodeSync for write collaboration code.<br />Click <a href="${roomLink}">here</a> to Join the room</p>`,
    text: `<p>Hello Dear, ${userName} is invite you on CodeSync for write collaboration code.<br />Click <a href="${roomLink}">here</a> to Join the room</p>`,
  };
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
      res.status(200).send("error")
    } else {
      res.status(200).send("Email sent")
      console.log('Email sent: ' + info.response);
    }
  });
})


// Production Settings
// if (process.env.NODE_ENV === 'production') {
//   // Set Value
//   app.use(express.static(path.join(__dirname, '/client/build')))

//   app.get('*', (req, res) => {
//     res.sendFile(path.resolve(__dirname,'..', 'client', 'build', 'index.html'));
//   })

// }
server.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
