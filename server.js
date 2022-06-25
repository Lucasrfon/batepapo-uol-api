import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import joi from 'joi';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URL);
let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("batePapo");
});

const participantSchema = joi.object({ name: joi.string().required() });

const server = express();
server.use(cors());
server.use(express.json());

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
      from: name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss')
    })
    res.status(201).send();
  } catch(error) {
    res.sendStatus(500);
  }
});

server.get('/participants', async (req, res) => {
  try {
    const participants = await db.collection('participants').find().toArray();
    res.send(participants);
  } catch(error) {
    res.send("Algo de errado não está certo!")
  }
});

server.delete('/participants', async (req, res) => {
  const {name} = req.body
  try {
    const participants = await db.collection('participants').deleteOne({name: name});
    res.send(participants);
  } catch(error) {
    res.send("Algo de errado não está certo!")
  }
})

server.listen(5000, () => console.log("Server online."));