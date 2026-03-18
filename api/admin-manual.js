const { MongoClient } = require('mongodb');

// Caché de conexión: Evita que Vercel abra y cierre la base de datos a cada rato
let cachedClient = null;

async function connectToDatabase() {
    if (cachedClient) return cachedClient;
    // Llama a la variable de entorno secreta que tienes en Vercel
    const client = new MongoClient(process.env.MONGODB_URI); 
    await client.connect();
    cachedClient = client;
    return client;
}

module.exports = async (req, res) => {
    // Seguridad: Solo permitimos que inserten datos (POST)
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método no permitido. Usa POST.' });
    }

    try {
        const client = await connectToDatabase();
        const db = client.db("carbono"); // Tu base de datos
        const collection = db.collection("raw"); // Tu colección

        const datosAdmin = req.body;

        // 🧠 TRADUCTOR: Formateamos los datos EXACTAMENTE como los lee tu Dashboard
        const documento = {
            facility: datosAdmin.sede,
            activity_type: datosAdmin.actividad,
            date: datosAdmin.fecha,
            scope: Number(datosAdmin.scope),
            co2e_kg: Number(datosAdmin.co2e_kg), // El cálculo que ya hicimos en el frontend
            
            // Datos extra por si luego quieres auditar
            cantidad_bruta: Number(datosAdmin.cantidad),
            unidad: datosAdmin.unidad,
            factor_emision: Number(datosAdmin.factor),
            timestamp: datosAdmin.timestamp,
            metodo_ingreso: "Portal Admin Manual"
        };

        // Inyectamos el dato a MongoDB Atlas
        const result = await collection.insertOne(documento);

        // Le avisamos al frontend que todo salió perfecto
        res.status(200).json({ success: true, id: result.insertedId });
        
    } catch (error) {
        console.error("Error crítico en Base de Datos:", error);
        res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
};