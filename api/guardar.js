const { MongoClient } = require('mongodb');

// Variable de entorno de Vercel
const uri = process.env.MONGODB_URI; 
const options = {};

let client;
let clientPromise;

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
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const { sede, placa, mes, kilometraje, fecha_ingreso } = req.body;

    const dbClient = await clientPromise;
    const db = dbClient.db('carbono'); 
    const collection = db.collection('raw');

    // --- CÁLCULOS Y TRANSFORMACIÓN ---
    const factor_emision = 0.15; // Factor de Transporte Terrestre
    const co2e_calculado = kilometraje * factor_emision;

    // 1. Diccionario traductor de Meses a Fecha (Día 1 de cada mes)
    const mapaMeses = {
      "Enero": "01-01", "Febrero": "02-01", "Marzo": "03-01", "Abril": "04-01",
      "Mayo": "05-01", "Junio": "06-01", "Julio": "07-01", "Agosto": "08-01",
      "Septiembre": "09-01", "Octubre": "10-01", "Noviembre": "11-01", "Diciembre": "12-01"
    };

    // 2. Extraemos el año en el que estamos (ej. 2026)
    const anioActual = new Date(fecha_ingreso).getFullYear(); 
    
    // 3. Unimos el año con el mes elegido. (Si eligen "Marzo", queda "2026-03-01")
    const fechaFormateada = `${anioActual}-${mapaMeses[mes]}`;

    // --- DOCUMENTO A GUARDAR ---
    const documento = {
      facility: sede,
      date: fechaFormateada, // ¡Ahora esto alimenta la gráfica correctamente!
      activity_type: "Transporte Terrestre",
      activity_amount: kilometraje,
      uom: "km",
      scope: 3,
      emission_factor: factor_emision,
      co2e_kg: co2e_calculado,
      uploaded_by: `Web - ${placa}`, 
      mes_referencia: mes,
      placa_vehiculo: placa 
    };

    // Insertamos en la base de datos
    await collection.insertOne(documento);

    res.status(200).json({ message: 'Registro guardado exitosamente' });
    
  } catch (error) {
    console.error("Error conectando a MongoDB:", error);
    res.status(500).json({ error: 'Error interno del servidor al guardar los datos' });
  }
};
