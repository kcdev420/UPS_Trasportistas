const { MongoClient } = require('mongodb');

// Vercel inyectará esta variable de forma segura desde su panel
const uri = process.env.MONGODB_URI; 
const options = {};

let client;
let clientPromise;

// Lógica para mantener la conexión eficiente en un entorno Serverless
if (!process.env.MONGODB_URI) {
  throw new Error('Falta la variable de entorno MONGODB_URI');
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

module.exports = async (req, res) => {
  // Solo permitir peticiones POST (cuando el formulario envía datos)
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const { sede, placa, mes, kilometraje, fecha_ingreso } = req.body;

    const dbClient = await clientPromise;
    // Conectamos a la misma base de datos y colección que usa tu código en R
    const db = dbClient.db('carbono'); 
    const collection = db.collection('raw');

    // --- TRANSFORMACIÓN DE DATOS ---
    // Adaptamos lo que viene del formulario a la estructura que espera tu Shiny App
    const factor_emision = 0.15; // Factor para Transporte Terrestre según tus reglas
    const co2e_calculado = kilometraje * factor_emision;

    // Solo extraemos la fecha en formato YYYY-MM-DD para que R as.Date() lo lea bien
    const fechaFormateada = new Date(fecha_ingreso).toISOString().split('T')[0];

    const documento = {
      facility: sede,
      date: fechaFormateada,
      activity_type: "Transporte Terrestre",
      activity_amount: kilometraje,
      uom: "km",
      scope: 3,
      emission_factor: factor_emision,
      co2e_kg: co2e_calculado,
      uploaded_by: `Web - ${placa}`, // Para que sepas en R que vino de la app web
      // Campos extra que no rompen R pero te sirven de respaldo
      mes_referencia: mes,
      placa_vehiculo: placa 
    };

    // Insertamos en MongoDB
    await collection.insertOne(documento);

    // Devolvemos mensaje de éxito al frontend
    res.status(200).json({ message: 'Registro guardado exitosamente' });
    
  } catch (error) {
    console.error("Error conectando a MongoDB:", error);
    res.status(500).json({ error: 'Error interno del servidor al guardar los datos' });
  }
};