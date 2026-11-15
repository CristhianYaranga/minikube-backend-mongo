const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();

// Variables de entorno inyectadas desde ConfigMap (app-configmap) y Secret (db-secret)
const APP_PORT = process.env.APP_PORT || 3000;
const DB_HOST = process.env.DB_HOST;
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;

app.get('/', async (req, res) => {
  const uri = `mongodb://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASS)}@${DB_HOST}:27017/${DB_NAME}?authSource=admin`;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

  try {
    await client.connect();
    await client.db(DB_NAME).command({ ping: 1 });

    res.status(200).json({
      status: 'OK',
      mongoStatus: 'Conectado exitosamente a MongoDB',
      database: DB_NAME,
      host: DB_HOST
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      mongoStatus: 'Error al conectar a MongoDB',
      message: error.message
    });
  } finally {
    await client.close();
  }
});

app.listen(APP_PORT, () => {
  console.log(`Backend escuchando en el puerto ${APP_PORT}`);
});
