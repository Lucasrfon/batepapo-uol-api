import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URL);
let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("batePapo");
});

const server = express();
server.use(cors());
server.use(express.json());

server.post('/participants', async (req, res) => {
  const { name } = req.body
  try {
    const teste = await db.collection('participants').insertOne({ name, lastStatus: Date.now() });
    res.status(201).send(teste);
  } catch(error) {
    res.sendStatus(422)
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

server.listen(5000);