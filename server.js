import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import joi from 'joi';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
dotenv.config();

const server = express();
server.use(cors());
server.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URL);
let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("batePapo");
});

const participantSchema = joi.object({ name: joi.string().required() });
const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid('message', 'private_message').required(),
  User: joi.string().required()
})

server.post('/participants', async (req, res) => {
  const validation = participantSchema.validate(req.body);
  const { name } = req.body;

  if(validation.error) {
    return res.status(422).send(validation.error.details[0].message);
  };

  if(await db.collection('participants').findOne({name: name})) {
    return res.status(409).send("Nome em uso");
  };

  try {
    await db.collection('participants').insertOne({ name, lastStatus: Date.now() });
    await db.collection('messages').insertOne({
      from: name.trim(),
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss')
    });
    res.status(201).send();
  } catch(error) {
    res.send("Algo de errado não está certo!");
  }
});

server.get('/participants', async (req, res) => {
  try {
    const participants = await db.collection('participants').find().toArray();
    res.send(participants);
  } catch(error) {
    res.send("Algo de errado não está certo!");
  }
});

server.post('/messages', async (req, res) => {
  const { to, text, type } = req.body;
  const User = req.header("User");
  const validation = messageSchema.validate({ to, text, type, User });

  if(validation.error) {
    return res.status(422).send(validation.error.details[0].message);
  };

  if(!(await db.collection('participants').findOne({name: User}))) {
    return res.status(422).send("Usuário não encontrado");
  };

  try {
    await db.collection('messages').insertOne({
      from: User,
      to: to,
      text: text.trim(),
      type: type,
      time: dayjs().format('HH:mm:ss')
    });
    res.status(201).send();
  } catch(error) {
    res.send("Algo de errado não está certo!");
  }
});

server.get('/messages', async (req, res) => {
  try {
    const messages = await db.collection('messages').find().toArray();
    const User = req.header("User");
    const limit = parseInt(req.query.limit);
    
    if(limit) {
      return res.send(messages.slice(-limit).filter(message => 
        message.type === "message" || message.to === User || message.from === User || message.to === "Todos"));
    }
    res.send(await messages.filter(message => 
      message.type === "message" || message.to === User || message.from === User || message.to === "Todos"));
  } catch(error) {
    res.send("Algo de errado não está certo!");
  }
});

server.delete('/messages/:messageId', async (req, res) => {
  const User = req.header("User");
  const messageId = req.params.messageId;
  const message = await db.collection('messages').findOne({ _id: new ObjectId(messageId) });
  
  if(message == null) {
    return res.status(404).send();
  };

  try { 
    if(message.from !== User) {
      return res.status(401).send();
    }  

    await db.collection('messages').deleteOne({ _id: new ObjectId(messageId) });
    return res.status(200).send();

  } catch(error) {
    res.send("Algo de errado não está certo!");
  }
});

server.put('/messages/:messageId', async (req, res) => {
  const { to, text, type } = req.body;
  const User = req.header("User");
  const validation = messageSchema.validate({ to, text, type, User });
  const messageId = req.params.messageId;
  const message = await db.collection('messages').findOne({ _id: new ObjectId(messageId) });

  if(validation.error) {
    return res.status(422).send(validation.error.details[0].message);
  };

  if(!(await db.collection('participants').findOne({name: User}))) {
    return res.status(422).send("Usuário não encontrado");
  };

  if(message == null) {
    return res.status(404).send();
  };

  try {
    if(message.from !== User) {
      return res.status(401).send();
    }  

    await db.collection('messages').updateOne(
      {_id: messageId },
      { $set: {text: text, to: to, type: type}}
    );
    res.status(200).send();
  } catch(error) {
    res.send("Algo de errado não está certo!");
  }
});

server.post('/status', async (req, res) => {
  try {
    const User = req.header("User");

    if(await db.collection('participants').findOne({name: User})) {
      await db.collection('participants').updateOne(
        {name: User}, 
        { $set: {lastStatus: Date.now()} }
      );
      return res.status(200).send();
    }
    return res.status(404).send();
  } catch(error) {
    res.send("Algo de errado não está certo!");
  }
});

setInterval(removeIdle, 15000);

async function removeIdle() {
  const participants = await db.collection('participants').find().toArray();
  participants.forEach(participant => {
    if(participant.lastStatus < (Date.now() - 10000)) {
      db.collection('participants').deleteOne(participant);
      db.collection('messages').insertOne({
        from: participant.name,
        to: 'Todos',
        text: 'sai da sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss')
      });
    }
  });
}

server.listen(5000, () => console.log("Server online."));